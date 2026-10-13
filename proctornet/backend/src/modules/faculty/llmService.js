/**
 * llmService.js
 * R4 — AI Question Generation via real LLM providers.
 *
 * Supported providers: 'groq' | 'openai' | 'google' | 'anthropic' | 'none'
 * When LLM_PROVIDER=none: throws a visible error (UI should hide the button; this is a defensive guard)
 *
 * Features:
 * - Strict JSON schema output with exactly-one-correct-answer validation
 * - Per-faculty daily rate limit (LLM_RATE_LIMIT_PER_FACULTY_PER_DAY)
 * - Per-faculty daily cost cap (LLM_DAILY_COST_CAP_USD)
 * - In-memory fallback for rate limiting & cost capping when Redis is absent
 * - No generateMockAiQuestions / fallback generation — off means off
 */

'use strict'

const crypto = require('crypto')
const config = require('../../shared/config')
const { redis } = require('../../infra/redis/client')
const { logger } = require('../../shared/logging')
const { ValidationError } = require('../../shared/errors')
const { validateMcqQuestion } = require('../questions/validation')

// ── Cost estimates (USD per 1k tokens, rough) ─────────────────────────────────
const COST_PER_1K_TOKENS = {
  'llama-3.3-70b-versatile': 0.00059,
  'llama-3.1-70b-versatile': 0.00059,
  'llama-3.1-8b-instant': 0.00005,
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'gpt-4-turbo': 0.01,
  'gpt-3.5-turbo': 0.0005,
  'gemini-1.5-pro': 0.00125,
  'gemini-1.5-flash': 0.000075,
  'gemini-1.5-flash-latest': 0.000075,
  'gemini-2.0-flash': 0.000075,
  'gemini-2.5-flash': 0.000075,
  'gemini-2.0-flash-lite': 0.00005,
  'claude-3-5-sonnet-20241022': 0.003,
  'claude-3-haiku-20240307': 0.00025,
  default: 0.0005,
}

function estimateCost(model, estimatedTokens) {
  const rate = COST_PER_1K_TOKENS[model] ?? COST_PER_1K_TOKENS.default
  return (estimatedTokens / 1000) * rate
}

// ── Rate-limit & cost-cap helpers (Redis-backed, fallback to in-memory) ───────
const memRateLimit = new Map() // key: facultyId:day -> { callCount, totalCost, expiresAt }

function _rateLimitKey(facultyId) {
  const day = new Date().toISOString().slice(0, 10)
  return `pn:v1:llm:rate:${facultyId}:${day}`
}
function _costKey(facultyId) {
  const day = new Date().toISOString().slice(0, 10)
  return `pn:v1:llm:cost:${facultyId}:${day}`
}

async function _incrementAndCheck(facultyId, estimatedCostUsd) {
  const rateKey = _rateLimitKey(facultyId)
  const costKey = _costKey(facultyId)
  const ttlSeconds = 86400 // expires at midnight + buffer

  let callCount
  let totalCost

  // Try Redis first if connected and ready
  if (redis.client && redis.client.status === 'ready') {
    try {
      callCount = await redis.client.incr(rateKey)
      await redis.client.expire(rateKey, ttlSeconds)

      const costCents = Math.round(estimatedCostUsd * 100_000) // μ-cents
      const totalCostCents = await redis.client.incrby(costKey, costCents)
      await redis.client.expire(costKey, ttlSeconds)

      totalCost = totalCostCents / 100_000
      return { callCount, totalCost }
    } catch (rErr) {
      logger.warn(
        { facultyId, err: rErr.message },
        'Redis LLM tracking error, falling back to in-memory'
      )
    }
  }

  // In-memory fallback
  const now = Date.now()
  const memKey = `${facultyId}:${new Date().toISOString().slice(0, 10)}`
  const existing = memRateLimit.get(memKey)

  if (!existing || existing.expiresAt <= now) {
    const entry = {
      callCount: 1,
      totalCost: estimatedCostUsd,
      expiresAt: now + ttlSeconds * 1000,
    }
    memRateLimit.set(memKey, entry)
    return { callCount: entry.callCount, totalCost: entry.totalCost }
  }

  existing.callCount += 1
  existing.totalCost += estimatedCostUsd
  return { callCount: existing.callCount, totalCost: existing.totalCost }
}

// ── JSON schema prompt builder ────────────────────────────────────────────────
function buildPrompt(topic, count, difficulty) {
  return `You are an expert exam question writer for a university course.
Generate exactly ${count} multiple-choice questions about: "${topic}".
Difficulty level: ${difficulty} (EASY | MEDIUM | HARD).

STRICT OUTPUT FORMAT — return ONLY a valid JSON object with a "questions" key containing the array:
{
  "questions": [
    {
      "questionText": "string (the question, >= 20 chars)",
      "marks": 2,
      "negativeMarks": 0.5,
      "difficulty": "${difficulty}",
      "options": [
        { "text": "string (correct answer)", "isCorrect": true, "order": 0 },
        { "text": "string (wrong answer)", "isCorrect": false, "order": 1 },
        { "text": "string (wrong answer)", "isCorrect": false, "order": 2 },
        { "text": "string (wrong answer)", "isCorrect": false, "order": 3 }
      ]
    }
  ]
}

Rules:
1. Each question must have EXACTLY 4 options.
2. EXACTLY 1 option must have isCorrect: true.
3. All options must be plausible and non-trivial.
4. No duplicate questions.
5. Return ONLY the JSON object — no explanation, no markdown fences.`
}

// ── Groq driver ───────────────────────────────────────────────────────────────
async function callGroq(prompt, model) {
  const { default: axios } = require('axios')
  const m = model || 'llama-3.3-70b-versatile'
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: m,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert exam question writer. You must return valid JSON only containing a "questions" array of multiple choice questions.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 3000,
    },
    {
      headers: {
        Authorization: `Bearer ${config.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  )
  const text = res.data?.choices?.[0]?.message?.content || '{}'
  const usage = res.data?.usage?.total_tokens || 500
  return { text, estimatedTokens: usage }
}

// ── OpenAI driver ─────────────────────────────────────────────────────────────
async function callOpenAI(prompt, model) {
  const { default: axios } = require('axios')
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    },
    {
      headers: { Authorization: `Bearer ${config.llmApiKey}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  )
  const text = res.data?.choices?.[0]?.message?.content || '{}'
  const usage = res.data?.usage?.total_tokens || 500
  return { text, estimatedTokens: usage }
}

// ── Google Gemini driver ──────────────────────────────────────────────────────
async function callGoogle(prompt, model) {
  const { default: axios } = require('axios')
  const candidateModels = [
    model,
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ].filter(Boolean)

  let lastErr
  for (const m of Array.from(new Set(candidateModels))) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
            responseMimeType: 'application/json',
          },
        },
        {
          headers: {
            'x-goog-api-key': config.llmApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 25_000,
        }
      )
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const tokens = res.data?.usageMetadata?.totalTokenCount || 500
      return { text, estimatedTokens: tokens }
    } catch (err) {
      lastErr = err
      const isRecoverableStatus =
        err.response &&
        (err.response.status === 404 || err.response.status === 503 || err.response.status === 429)
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
      if (isRecoverableStatus || isTimeout) {
        logger.warn(
          { model: m, error: err.message, status: err.response?.status },
          'Gemini model attempt failed, trying fallback model'
        )
        continue
      }
      throw err
    }
  }
  throw lastErr
}

// ── Anthropic driver ─────────────────────────────────────────────────────────
async function callAnthropic(prompt, model) {
  const { default: axios } = require('axios')
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': config.llmApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  )
  const text = res.data?.content?.[0]?.text || '{}'
  const tokens = (res.data?.usage?.input_tokens || 250) + (res.data?.usage?.output_tokens || 250)
  return { text, estimatedTokens: tokens }
}

// ── JSON parser + schema validation ──────────────────────────────────────────
function parseAndValidate(rawText, count) {
  let parsed
  try {
    let cleaned = rawText.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    } else {
      const firstBrace = cleaned.indexOf('{')
      const lastBrace = cleaned.lastIndexOf('}')
      const firstBracket = cleaned.indexOf('[')
      const lastBracket = cleaned.lastIndexOf(']')

      if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)
      ) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1)
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        cleaned = cleaned.slice(firstBracket, lastBracket + 1)
      }
    }

    const json = JSON.parse(cleaned)
    if (Array.isArray(json)) {
      parsed = json
    } else if (json && Array.isArray(json.questions)) {
      parsed = json.questions
    } else if (json && typeof json === 'object') {
      parsed = Object.values(json).find(v => Array.isArray(v))
    }
  } catch {
    throw new ValidationError('LLM returned invalid JSON. Please try again.')
  }

  if (!Array.isArray(parsed)) throw new ValidationError('LLM response was not a JSON array')
  if (parsed.length === 0) throw new ValidationError('LLM returned no questions')

  const validated = []
  const errors = []

  for (let i = 0; i < Math.min(parsed.length, count); i++) {
    const q = parsed[i]
    try {
      // Validate exactly-one-correct
      const correctCount = (q.options || []).filter(o => o.isCorrect === true).length
      if (correctCount !== 1) {
        errors.push({
          index: i,
          error: `Question ${i + 1} has ${correctCount} correct answers (must be exactly 1)`,
        })
        continue
      }
      // Run through MCQ validator
      validated.push(validateMcqQuestion(q))
    } catch (err) {
      errors.push({ index: i, error: err.message })
    }
  }

  if (validated.length === 0) {
    throw new ValidationError(
      `LLM returned ${parsed.length} questions but none passed validation: ${errors.map(e => e.error).join('; ')}`
    )
  }

  return { questions: validated, validationErrors: errors }
}

// ── Main service function ─────────────────────────────────────────────────────
class LLMService {
  /**
   * Generate MCQ question preview via LLM.
   * Throws if LLM_PROVIDER=none — UI must hide the button.
   */
  async generateQuestionsPreview({
    topic,
    count = 5,
    difficulty = 'MEDIUM',
    facultyId,
    providerOverride,
  }) {
    let provider = (providerOverride || config.llmProvider || 'none').toLowerCase().trim()
    if (provider === 'gemini') provider = 'google'
    if (!provider || provider === 'none' || !config.llmApiKey) {
      throw new ValidationError(
        "Question assistant isn't enabled — ask the administrator (LLM_PROVIDER is set to 'none' or unconfigured)."
      )
    }

    const model = config.llmModel || ''
    const cappedCount = Math.min(Math.max(1, count), 20) // 1–20 per call
    const prompt = buildPrompt(topic || 'Computer Science', cappedCount, difficulty.toUpperCase())

    // Estimate cost before calling
    const estimatedTokens = prompt.length / 4 + cappedCount * 200 // rough estimate
    const estimatedCost = estimateCost(model, estimatedTokens)

    // Rate limit and cost cap check
    if (facultyId) {
      const { callCount, totalCost } = await _incrementAndCheck(facultyId, estimatedCost)

      if (callCount > config.llmRateLimitPerFacultyPerDay) {
        throw new ValidationError(
          `Daily AI generation limit reached (${config.llmRateLimitPerFacultyPerDay} calls/day). ` +
            'Please try again tomorrow.'
        )
      }

      if (totalCost > config.llmDailyCostCapUsd) {
        throw new ValidationError(
          `Daily AI cost cap of $${config.llmDailyCostCapUsd} reached. ` +
            'Please try again tomorrow or contact your administrator.'
        )
      }
    }

    let rawText
    let actualTokens

    try {
      if (provider === 'groq') {
        const r = await callGroq(prompt, model)
        rawText = r.text
        actualTokens = r.estimatedTokens
      } else if (provider === 'openai') {
        const r = await callOpenAI(prompt, model)
        rawText = r.text
        actualTokens = r.estimatedTokens
      } else if (provider === 'google') {
        const r = await callGoogle(prompt, model)
        rawText = r.text
        actualTokens = r.estimatedTokens
      } else if (provider === 'anthropic') {
        const r = await callAnthropic(prompt, model)
        rawText = r.text
        actualTokens = r.estimatedTokens
      } else {
        throw new ValidationError(
          `Unknown LLM_PROVIDER: "${provider}". Valid values: groq, openai, google, anthropic, none.`
        )
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err
      const reqId = crypto.randomUUID().slice(0, 8)
      const providerErrMsg =
        err.response?.data?.error?.message || err.response?.data?.message || err.message
      logger.error(
        { reqId, error: providerErrMsg, provider, status: err.response?.status },
        'LLM API call failed'
      )

      let userFriendlyMsg = 'Question generation failed — please try again'
      if (err.response?.status === 429) {
        userFriendlyMsg =
          'AI provider quota or rate limit exceeded. Please try again in a few moments.'
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        userFriendlyMsg = 'AI provider authentication failed — check your API key configuration.'
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        userFriendlyMsg =
          'AI question generation timed out — please try with fewer questions or shorter content.'
      } else if (providerErrMsg && !providerErrMsg.includes('Request failed with status code')) {
        userFriendlyMsg = `AI generation failed: ${providerErrMsg}`
      }
      throw new ValidationError(`${userFriendlyMsg} (ref: ${reqId})`)
    }

    logger.info(
      {
        facultyId,
        provider,
        count: cappedCount,
        tokens: actualTokens,
        estimatedCost: estimateCost(model, actualTokens).toFixed(6),
      },
      'LLM question generation completed'
    )

    const { questions, validationErrors } = parseAndValidate(rawText, cappedCount)
    return { questions, validationErrors, provider, tokensUsed: actualTokens }
  }
}

const llmService = new LLMService()

module.exports = {
  llmService,
  LLMService,
  parseAndValidate,
  buildPrompt,
  estimateCost,
}
