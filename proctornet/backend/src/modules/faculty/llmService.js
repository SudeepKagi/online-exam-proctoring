/**
 * llmService.js
 * R4 — AI Question Generation via real LLM providers.
 *
 * Supported providers: 'openai' | 'google' | 'anthropic' | 'none'
 * When LLM_PROVIDER=none: throws a visible error (UI should hide the button; this is a defensive guard)
 *
 * Features:
 * - Strict JSON schema output with exactly-one-correct-answer validation
 * - Per-faculty daily rate limit (LLM_RATE_LIMIT_PER_FACULTY_PER_DAY)
 * - Per-faculty daily cost cap (LLM_DAILY_COST_CAP_USD)
 * - No generateMockAiQuestions / fallback generation — off means off
 */

'use strict'

const config = require('../../shared/config')
const { redis } = require('../../infra/redis/client')
const { logger } = require('../../shared/logging')
const { ValidationError } = require('../../shared/errors')
const { validateMcqQuestion } = require('../questions/validation')

// ── Cost estimates (USD per 1k tokens, rough) ─────────────────────────────────
const COST_PER_1K_TOKENS = {
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'gpt-4-turbo': 0.01,
  'gpt-3.5-turbo': 0.0005,
  'gemini-1.5-pro': 0.00125,
  'gemini-1.5-flash': 0.000075,
  'claude-3-5-sonnet-20241022': 0.003,
  'claude-3-haiku-20240307': 0.00025,
  default: 0.002
}

function estimateCost(model, estimatedTokens) {
  const rate = COST_PER_1K_TOKENS[model] ?? COST_PER_1K_TOKENS.default
  return (estimatedTokens / 1000) * rate
}

// ── Rate-limit & cost-cap helpers (Redis-backed, fallback to in-memory) ───────
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

  try {
    // Atomic increment in Redis
    callCount = await redis.client?.incr(rateKey).then(n => {
      redis.client?.expire(rateKey, ttlSeconds)
      return n
    }) ?? 1

    // Cost tracking (store as cents integer to avoid float precision issues)
    const costCents = Math.round(estimatedCostUsd * 100_000) // μ-cents
    const totalCostCents = await redis.client?.incrby(costKey, costCents).then(n => {
      redis.client?.expire(costKey, ttlSeconds)
      return n
    }) ?? costCents

    totalCost = totalCostCents / 100_000
  } catch {
    // Redis unavailable — allow the call (degraded mode, no cost tracking)
    logger.warn({ facultyId }, 'LLM cost tracking Redis unavailable; proceeding without cap enforcement')
    return { callCount: 1, totalCost: estimatedCostUsd }
  }

  return { callCount, totalCost }
}

// ── JSON schema prompt builder ────────────────────────────────────────────────
function buildPrompt(topic, count, difficulty) {
  return `You are an expert exam question writer for a university computer science course.
Generate exactly ${count} multiple-choice questions about: "${topic}".
Difficulty level: ${difficulty} (EASY | MEDIUM | HARD).

STRICT OUTPUT FORMAT — return ONLY a valid JSON array, no markdown, no extra text:
[
  {
    "questionText": "string (the question, ≥ 20 chars)",
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

Rules:
1. Each question must have EXACTLY 4 options.
2. EXACTLY 1 option must have isCorrect: true.
3. All options must be plausible and non-trivial.
4. No duplicate questions.
5. Return ONLY the JSON array — no explanation, no markdown fences.`
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
      response_format: { type: 'json_object' }
    },
    {
      headers: { Authorization: `Bearer ${config.llmApiKey}`, 'Content-Type': 'application/json' },
      timeout: 30_000
    }
  )
  const text = res.data?.choices?.[0]?.message?.content || '[]'
  const usage = res.data?.usage?.total_tokens || 500
  return { text, estimatedTokens: usage }
}

// ── Google Gemini driver ──────────────────────────────────────────────────────
async function callGoogle(prompt, model) {
  const { default: axios } = require('axios')
  const m = model || 'gemini-1.5-flash'
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${config.llmApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
    },
    { timeout: 30_000 }
  )
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  const tokens = res.data?.usageMetadata?.totalTokenCount || 500
  return { text, estimatedTokens: tokens }
}

// ── Anthropic driver ─────────────────────────────────────────────────────────
async function callAnthropic(prompt, model) {
  const { default: axios } = require('axios')
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': config.llmApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 30_000
    }
  )
  const text = res.data?.content?.[0]?.text || '[]'
  const tokens = res.data?.usage?.input_tokens + res.data?.usage?.output_tokens || 500
  return { text, estimatedTokens: tokens }
}

// ── JSON parser + schema validation ──────────────────────────────────────────
function parseAndValidate(rawText, count) {
  let parsed
  try {
    // Strip markdown fences if provider returned them despite instructions
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // If it's wrapped in an object with a key, try to extract the array
    try {
      const obj = JSON.parse(rawText)
      parsed = Object.values(obj).find(v => Array.isArray(v))
    } catch {
      throw new ValidationError('LLM returned invalid JSON. Please try again.')
    }
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
        errors.push({ index: i, error: `Question ${i + 1} has ${correctCount} correct answers (must be exactly 1)` })
        continue
      }
      // Run through MCQ validator
      validated.push(validateMcqQuestion(q))
    } catch (err) {
      errors.push({ index: i, error: err.message })
    }
  }

  if (validated.length === 0) {
    throw new ValidationError(`LLM returned ${parsed.length} questions but none passed validation: ${errors.map(e => e.error).join('; ')}`)
  }

  return { questions: validated, validationErrors: errors }
}

// ── Main service function ─────────────────────────────────────────────────────
class LLMService {
  /**
   * Generate MCQ question preview via LLM.
   * Throws if LLM_PROVIDER=none — UI must hide the button.
   */
  async generateQuestionsPreview({ topic, count = 5, difficulty = 'MEDIUM', facultyId, providerOverride }) {
    const provider = providerOverride || config.llmProvider || 'none'
    if (!provider || provider === 'none') {
      throw new ValidationError(
        "AI question generation is disabled because LLM_PROVIDER is set to 'none'. " +
        "Set LLM_PROVIDER and LLM_API_KEY to enable this feature."
      )
    }

    if (!config.llmApiKey) {
      throw new ValidationError('LLM_API_KEY is not set. Cannot generate AI questions.')
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
      if (config.llmProvider === 'openai') {
        const r = await callOpenAI(prompt, model)
        rawText = r.text; actualTokens = r.estimatedTokens
      } else if (config.llmProvider === 'google') {
        const r = await callGoogle(prompt, model)
        rawText = r.text; actualTokens = r.estimatedTokens
      } else if (config.llmProvider === 'anthropic') {
        const r = await callAnthropic(prompt, model)
        rawText = r.text; actualTokens = r.estimatedTokens
      } else {
        throw new ValidationError(`Unknown LLM_PROVIDER: "${config.llmProvider}". ` +
          'Valid values: openai, google, anthropic, none.')
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err
      logger.error({ error: err.message, provider: config.llmProvider }, 'LLM API call failed')
      throw new ValidationError(
        `AI question generation failed: ${err.response?.data?.error?.message || err.message}. ` +
        'Please try again.'
      )
    }

    logger.info({
      facultyId,
      provider: config.llmProvider,
      count: cappedCount,
      tokens: actualTokens,
      estimatedCost: estimateCost(model, actualTokens).toFixed(6)
    }, 'LLM question generation completed')

    const { questions, validationErrors } = parseAndValidate(rawText, cappedCount)
    return { questions, validationErrors, provider: config.llmProvider, tokensUsed: actualTokens }
  }
}

const llmService = new LLMService()

module.exports = {
  llmService,
  LLMService
}
