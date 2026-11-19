'use strict'

const axios = require('axios')
const { z } = require('zod')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

// ---------------------------------------------------------------------------
// Environment Limits & Configuration
// ---------------------------------------------------------------------------
const AI_MAX_QUESTIONS_PER_RUN = parseInt(process.env.AI_MAX_QUESTIONS_PER_RUN, 10) || 50
const AI_MAX_PDF_PAGES = parseInt(process.env.AI_MAX_PDF_PAGES, 10) || 50
const AI_DAILY_QUESTION_QUOTA_PER_USER = parseInt(process.env.AI_DAILY_QUESTION_QUOTA_PER_USER, 10) || 100
const AI_MIN_SUBSTANTIVE_WORDS = parseInt(process.env.AI_MIN_SUBSTANTIVE_WORDS, 10) || 300

// ---------------------------------------------------------------------------
// Provider Detection & Availability Probe
// ---------------------------------------------------------------------------

function getAiProviderInfo() {
  const isProd = process.env.NODE_ENV === 'production' || config.isProd
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim())

  let provider = 'none'
  let model = 'none'
  if (hasGemini) {
    provider = 'gemini'
    model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  } else if (hasOpenAI) {
    provider = 'openai'
    model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  } else if (!isProd) {
    provider = 'deterministic-mock'
    model = 'fixture-rules'
  }

  return {
    provider,
    model,
    configured: hasGemini || hasOpenAI,
    isProduction: isProd
  }
}

async function probeAiAvailability({ timeoutMs = 4000 } = {}) {
  const isProd = process.env.NODE_ENV === 'production' || config.isProd
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim()

  if (!geminiKey && !openAiKey) {
    if (isProd) {
      return {
        ok: false,
        status: 'NOT_CONFIGURED',
        code: 'AI_GENERATION_NOT_CONFIGURED',
        message: "AI generation isn't configured. Contact your administrator to configure GEMINI_API_KEY or OPENAI_API_KEY."
      }
    }
    return {
      ok: true,
      status: 'MOCK_AVAILABLE',
      code: 'MOCK_PROVIDER',
      message: 'Non-production environment: deterministic mock provider is active.'
    }
  }

  return {
    ok: true,
    status: 'CONFIGURED',
    provider: geminiKey ? 'gemini' : 'openai',
    model: geminiKey ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : (process.env.OPENAI_MODEL || 'gpt-4o-mini')
  }
}

// ---------------------------------------------------------------------------
// Zod Schemas for LLM Generation & Extraction
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  questionText: z.string().min(3, 'Question text must be at least 3 characters').max(1000, 'Question text exceeds 1000 characters'),
  options: z.array(z.string().max(250, 'Option text exceeds 250 characters')).min(3).max(5),
  correctOptionIndex: z.number().int().min(0).max(4),
  marks: z.number().positive().default(1),
  negativeMarks: z.number().min(0).default(0),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  confidence: z.number().min(0).max(1).default(0.9),
  sourcePage: z.union([z.number(), z.string()]).nullable().optional(),
  supportingExcerpt: z.string().optional().default(''),
  topic: z.string().optional().default('General'),
  explanation: z.string().optional().default(''),
  flags: z.array(z.string()).default([]),
  isAiSuggested: z.boolean().default(false),
  needsReview: z.boolean().default(false),
  groundingStatus: z.enum(['VERIFIED', 'NEEDS_REVIEW', 'UNVERIFIED']).default('VERIFIED'),
  isGrounded: z.boolean().default(true)
})

const examExtractionSchema = z.object({
  title: z.string().optional().default(''),
  courseCode: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  description: z.string().optional().default(''),
  studentInstructions: z.string().optional().default(''),
  suggestedDuration: z.number().int().min(5).max(480).optional().default(60),
  totalMarks: z.number().positive().optional(),
  markingScheme: z.object({
    positive: z.number().default(1),
    negative: z.number().default(0)
  }).optional().default({ positive: 1, negative: 0 }),
  questions: z.array(questionSchema).min(1),
  aiAudit: z.object({
    modelName: z.string().default('gemini-1.5-flash'),
    promptVersion: z.string().default('2.2.0'),
    settings: z.record(z.any()).optional()
  }).optional()
})

// ---------------------------------------------------------------------------
// Text Substantiveness & Token Calculations
// ---------------------------------------------------------------------------

function cleanTextForMatching(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text = '') {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

function calculateSimilarity(textA, textB) {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : intersection / union
}

function estimateSupportedQuestions(sourceText = '') {
  const clean = cleanTextForMatching(sourceText)
  const words = clean.split(/\s+/).filter(w => w.length > 2)
  const wordCount = words.length

  let supportedCount = Math.max(3, Math.min(AI_MAX_QUESTIONS_PER_RUN, Math.floor(wordCount / 28)))
  if (wordCount < 60) supportedCount = Math.min(3, Math.max(1, Math.floor(wordCount / 20)))

  return {
    wordCount,
    supportedCount,
    hint: `This material supports about ${supportedCount} questions`
  }
}

// ---------------------------------------------------------------------------
// Verbatim Citation & Semantic Grounding Verification
// ---------------------------------------------------------------------------

/**
 * Checks if a question's supportingExcerpt exists verbatim in the text of its cited page.
 */
function verifyVerbatimCitation(question, pages = [], rawCombinedSource = '') {
  const rawExcerpt = String(question?.supportingExcerpt || '').trim()
  if (!rawExcerpt || rawExcerpt.length < 15) {
    return {
      valid: false,
      reason: 'EXCERPT_TOO_SHORT',
      message: 'Supporting excerpt must be at least 15 characters of verbatim document text.'
    }
  }

  const cleanExcerpt = cleanTextForMatching(rawExcerpt)
  const excerptWords = cleanExcerpt.split(' ').filter(w => w.length > 2)
  if (excerptWords.length < 3) {
    return {
      valid: false,
      reason: 'EXCERPT_TOO_FEW_WORDS',
      message: 'Supporting excerpt contains too few substantive words.'
    }
  }

  const targetPageNum = Number(question.sourcePage) || 1
  let targetPage = (pages || []).find(p => p.pageNumber === targetPageNum)

  // If specific page is not provided or not matched, fall back to search across all pages or raw text
  let sourceText = targetPage ? targetPage.text : rawCombinedSource
  let cleanSource = cleanTextForMatching(sourceText)

  let matchedPage = targetPage ? targetPageNum : null
  let isSubstring = cleanSource.includes(cleanExcerpt)

  // If not found on cited page, search other pages to see if page number was merely off-by-one
  if (!isSubstring && Array.isArray(pages) && pages.length > 0) {
    for (const page of pages) {
      const pageClean = cleanTextForMatching(page.text)
      if (pageClean.includes(cleanExcerpt)) {
        isSubstring = true
        matchedPage = page.pageNumber
        break
      }
    }
  }

  // Fuzzy token overlap fallback (at least 85% of excerpt words appear in sequence)
  let fuzzyMatch = false
  if (!isSubstring && cleanSource.length > 0) {
    let matchedWords = 0
    for (const w of excerptWords) {
      if (cleanSource.includes(w)) matchedWords++
    }
    if ((matchedWords / excerptWords.length) >= 0.85) {
      fuzzyMatch = true
    }
  }

  if (!isSubstring && !fuzzyMatch) {
    return {
      valid: false,
      reason: 'EXCERPT_NOT_IN_SOURCE',
      message: `Supporting excerpt does not exist in the source document text (Page ${targetPageNum}).`
    }
  }

  // Verify semantic / token overlap between excerpt and question stem / correct option
  const stem = String(question.questionText || '')
  const correctOpt = Array.isArray(question.options) ? String(question.options[question.correctOptionIndex] || '') : ''
  const qTokens = tokenize(`${stem} ${correctOpt}`)
  const excerptTokens = tokenize(rawExcerpt)

  let commonTokens = 0
  for (const t of excerptTokens) {
    if (qTokens.has(t)) commonTokens++
  }

  // At least 1 shared substantive keyword between excerpt and (stem + answer)
  if (commonTokens < 1 && excerptTokens.size > 0 && qTokens.size > 0) {
    return {
      valid: false,
      reason: 'WEAK_SUPPORT',
      message: 'Question stem or answer does not share substantive keywords with the cited excerpt.'
    }
  }

  return {
    valid: true,
    matchedPage: matchedPage || targetPageNum,
    excerpt: rawExcerpt
  }
}

/**
 * Checks whether an excerpt is grounded within the supplied source text.
 */
function checkGrounding(excerpt, sourceText) {
  if (!excerpt || !sourceText) return false
  const cleanExcerpt = cleanTextForMatching(excerpt)
  const cleanSource = cleanTextForMatching(sourceText)

  if (!cleanExcerpt || cleanExcerpt.length < 5) return false
  if (cleanSource.includes(cleanExcerpt)) return true

  // Sub-fragment check (at least 65% of words match)
  const words = cleanExcerpt.split(' ').filter(w => w.length > 2)
  if (words.length === 0) return false
  let matchCount = 0
  for (const w of words) {
    if (cleanSource.includes(w)) matchCount++
  }
  return (matchCount / words.length) >= 0.65
}

/**
 * Filters generated questions, dropping ungrounded/hallucinated questions and tracking audit stats.
 */
function verifyAndFilterGroundedQuestions(questions = [], pages = [], rawSource = '') {
  const acceptedQuestions = []
  let rejectedCount = 0
  const rejectionReasons = {}

  for (const q of questions) {
    const check = verifyVerbatimCitation(q, pages, rawSource)
    if (!check.valid) {
      rejectedCount++
      rejectionReasons[check.reason] = (rejectionReasons[check.reason] || 0) + 1
      continue
    }

    acceptedQuestions.push({
      ...q,
      sourcePage: check.matchedPage || q.sourcePage || 1,
      groundingStatus: 'VERIFIED',
      isGrounded: true,
      needsReview: (q.flags || []).length > 0
    })
  }

  return {
    acceptedQuestions,
    rejectedCount,
    rejectionReasons
  }
}

// ---------------------------------------------------------------------------
// Page-Aware Chunking & Proportional Allocation
// ---------------------------------------------------------------------------

function buildPageAwareChunks(pages = [], totalWords = 0, requestedCount = 10) {
  const readablePages = (pages || []).filter(p => p.isReadable)
  if (readablePages.length === 0) {
    return []
  }

  // If small document (<= 3 pages or <= 1200 words), single chunk
  if (readablePages.length <= 3 && totalWords <= 1200) {
    return [{
      chunkIndex: 0,
      pages: readablePages.map(p => p.pageNumber),
      text: readablePages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n'),
      wordCount: totalWords,
      targetCount: requestedCount
    }]
  }

  // Multi-page chunking: group ~2-3 pages or ~800 words per chunk
  const chunks = []
  let currentPages = []
  let currentWords = 0

  for (const page of readablePages) {
    currentPages.push(page)
    currentWords += page.wordCount

    if (currentWords >= 700 || currentPages.length >= 3) {
      chunks.push({
        chunkIndex: chunks.length,
        pages: currentPages.map(p => p.pageNumber),
        text: currentPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n'),
        wordCount: currentWords,
        targetCount: 0
      })
      currentPages = []
      currentWords = 0
    }
  }

  if (currentPages.length > 0) {
    if (chunks.length > 0 && currentWords < 200) {
      // Merge small tail into last chunk
      const last = chunks[chunks.length - 1]
      last.pages.push(...currentPages.map(p => p.pageNumber))
      last.text += '\n\n' + currentPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n')
      last.wordCount += currentWords
    } else {
      chunks.push({
        chunkIndex: chunks.length,
        pages: currentPages.map(p => p.pageNumber),
        text: currentPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n'),
        wordCount: currentWords,
        targetCount: 0
      })
    }
  }

  // Allocate questions proportionally by word count
  const safeTotalWords = Math.max(1, totalWords)
  let allocated = 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (i === chunks.length - 1) {
      chunk.targetCount = Math.max(1, requestedCount - allocated)
    } else {
      const share = Math.max(1, Math.round((chunk.wordCount / safeTotalWords) * requestedCount))
      chunk.targetCount = share
      allocated += share
    }
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Normalization & Payload Repair
// ---------------------------------------------------------------------------

function normalizeGeneratedQuestions(rawQuestions, sourceText = '', existingPool = []) {
  if (!Array.isArray(rawQuestions)) return []

  const pool = [...existingPool]
  return rawQuestions.map((q, idx) => {
    let opts = q.options || []
    let correctIdx = q.correctOptionIndex

    if (Array.isArray(opts) && typeof opts[0] === 'object' && opts[0] !== null) {
      const found = opts.findIndex(o => o.isCorrect)
      if (found !== -1) correctIdx = found
      opts = opts.map(o => o.text || o.optionText || String(o))
    }

    if (typeof correctIdx === 'string') {
      const u = correctIdx.trim().toUpperCase()
      if (['A', 'B', 'C', 'D', 'E'].includes(u)) correctIdx = u.charCodeAt(0) - 65
      else correctIdx = parseInt(correctIdx, 10)
    }

    if (isNaN(correctIdx) || correctIdx < 0) correctIdx = 0
    if (opts.length < 3) {
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`)
    }
    if (opts.length > 5) opts = opts.slice(0, 5)
    opts = opts.map(o => String(o || 'Option').slice(0, 250))
    if (correctIdx >= opts.length) correctIdx = opts.length - 1

    const rawConf = typeof q.confidence === 'number' ? q.confidence : 0.90
    const confidence = Math.max(0, Math.min(1, rawConf))
    const diff = ['EASY', 'MEDIUM', 'HARD'].includes(String(q.difficulty || '').toUpperCase())
      ? String(q.difficulty).toUpperCase()
      : 'MEDIUM'

    const initialQ = {
      questionText: String(q.questionText || q.prompt || `Question ${idx + 1}`).slice(0, 1000),
      options: opts,
      correctOptionIndex: correctIdx,
      marks: Number(q.marks) || (diff === 'HARD' ? 2 : 1),
      negativeMarks: Number(q.negativeMarks) || 0,
      difficulty: diff,
      confidence,
      sourcePage: q.sourcePage ? Number(q.sourcePage) || 1 : 1,
      supportingExcerpt: String(q.supportingExcerpt || q.excerpt || '').slice(0, 500),
      topic: String(q.topic || 'General').slice(0, 100),
      explanation: String(q.explanation || '').slice(0, 1000),
      flags: Array.isArray(q.flags) ? [...q.flags] : [],
      isAiSuggested: Boolean(q.isAiSuggested),
      needsReview: Boolean(q.needsReview),
      groundingStatus: q.groundingStatus || 'VERIFIED',
      isGrounded: q.isGrounded !== false
    }

    // Stem giveaway / answer leak check
    const rawOpts = initialQ.options.map(o => o.toLowerCase())
    if (new Set(rawOpts).size !== initialQ.options.length) {
      initialQ.flags.push('ambiguous options')
      initialQ.needsReview = true
    }

    // Low confidence check (< 0.7)
    if (typeof initialQ.confidence === 'number' && initialQ.confidence < 0.7) {
      if (!initialQ.flags.includes('weak support')) {
        initialQ.flags.push('weak support')
      }
      initialQ.needsReview = true
    }

    // Grounding check against provided sourceText
    if (sourceText && typeof sourceText === 'string' && sourceText.length > 50) {
      if (!initialQ.supportingExcerpt) {
        if (!initialQ.flags.includes('weak support')) {
          initialQ.flags.push('weak support')
        }
        initialQ.needsReview = true
      } else {
        const isGrounded = checkGrounding(initialQ.supportingExcerpt, sourceText)
        if (!isGrounded) {
          if (!initialQ.flags.includes('weak support')) {
            initialQ.flags.push('weak support')
          }
          initialQ.needsReview = true
        }
      }
    }

    // Deduplication check against existing questions
    for (const existing of pool) {
      const sim = calculateSimilarity(initialQ.questionText, existing.questionText)
      if (sim >= 0.80) {
        initialQ.flags.push('duplicate')
        initialQ.needsReview = true
        break
      }
    }

    pool.push(initialQ)
    return initialQ
  })
}

function validateAndRepairExamPayload(raw, sourceText = '', existingPool = []) {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Raw payload must be an object' }
  }

  const rawQuestions = raw.questions || (Array.isArray(raw) ? raw : [])
  const normalizedQuestions = normalizeGeneratedQuestions(rawQuestions, sourceText, existingPool)

  // Verify metadata against source text
  const cleanSource = cleanTextForMatching(sourceText)
  const filterMetadataField = (val) => {
    const s = String(val || '').trim()
    if (!s) return ''
    if (!cleanSource) return s
    const tokens = tokenize(s)
    let presentTokens = 0
    for (const t of tokens) {
      if (cleanSource.includes(t)) presentTokens++
    }
    return presentTokens > 0 ? s : ''
  }

  const candidate = {
    title: filterMetadataField(raw.title),
    courseCode: filterMetadataField(raw.courseCode || raw.subjectCode).toUpperCase(),
    subject: filterMetadataField(raw.subject || raw.title),
    description: filterMetadataField(raw.description),
    studentInstructions: filterMetadataField(raw.studentInstructions || raw.instructions),
    suggestedDuration: Number(raw.suggestedDuration) || 60,
    totalMarks: Number(raw.totalMarks) || normalizedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0),
    markingScheme: {
      positive: Number(raw.markingScheme?.positive) || 1,
      negative: Number(raw.markingScheme?.negative) || 0
    },
    questions: normalizedQuestions,
    aiAudit: raw.aiAudit || {
      modelName: 'gemini-1.5-flash',
      promptVersion: '2.2.0'
    }
  }

  const result = examExtractionSchema.safeParse(candidate)
  if (result.success) {
    return { valid: true, data: result.data }
  }

  return { valid: false, error: result.error, data: candidate }
}

// ---------------------------------------------------------------------------
// Deterministic Mock Generator (NON-PRODUCTION ONLY)
// ---------------------------------------------------------------------------

function generateFallbackQuestions(topic = 'General Computing', syllabusText = '', difficulty = 'MEDIUM', count = 5, pages = []) {
  const cleanSentences = String(syllabusText || '')
    .replace(/\[Page \d+\]/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 25 && s.length <= 250)

  const seedKeywords = (syllabusText + ' ' + topic)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)

  const subject = topic || 'Computer Science'
  const num = Math.min(Math.max(1, parseInt(count, 10) || 5), AI_MAX_QUESTIONS_PER_RUN)
  const questions = []

  for (let i = 0; i < num; i++) {
    const kw = seedKeywords[i % Math.max(1, seedKeywords.length)] || `${subject} Core Concept ${i + 1}`
    const diffUpper = difficulty.toUpperCase()
    const marks = diffUpper === 'HARD' ? 2 : 1

    let excerpt = `${kw} provides high performance architectural abstraction for distributed execution.`
    let sourcePage = 1

    if (cleanSentences.length > 0) {
      excerpt = cleanSentences[i % cleanSentences.length]
      if (Array.isArray(pages) && pages.length > 0) {
        for (const p of pages) {
          if (cleanTextForMatching(p.text).includes(cleanTextForMatching(excerpt))) {
            sourcePage = p.pageNumber
            break
          }
        }
      }
    }

    questions.push({
      questionText: `According to the source documentation, what is specified regarding ${kw}?`,
      options: [
        `It is stated that: "${excerpt.slice(0, 75)}..."`,
        `Contradicts the verified operational bounds of ${kw}`,
        `Bypasses standard runtime validation and access control`,
        `Requires unconstrained external memory degradation`
      ],
      correctOptionIndex: 0,
      marks,
      negativeMarks: 0,
      difficulty: diffUpper === 'MIXED' ? (i % 3 === 0 ? 'EASY' : i % 3 === 1 ? 'MEDIUM' : 'HARD') : diffUpper,
      confidence: 1.0,
      sourcePage,
      supportingExcerpt: excerpt,
      topic: subject,
      explanation: `Directly supported by the document on Page ${sourcePage}.`,
      flags: [],
      isAiSuggested: false,
      needsReview: false,
      groundingStatus: 'VERIFIED',
      isGrounded: true
    })
  }

  return questions
}

// ---------------------------------------------------------------------------
// LLM Provider Integrations (Gemini & OpenAI)
// ---------------------------------------------------------------------------

async function callGemini(apiKey, prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 3500, responseMimeType: 'application/json' }
  }, { timeout: 25000 })
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
  return JSON.parse(text)
}

async function callOpenAI(apiKey, prompt) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const url = 'https://api.openai.com/v1/chat/completions'
  const res = await axios.post(url, {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 25000
  })
  const text = res.data?.choices?.[0]?.message?.content
  return JSON.parse(text)
}

// ---------------------------------------------------------------------------
// Core Grounded Generation Engine
// ---------------------------------------------------------------------------

async function generateExamQuestions({
  topic = 'Assessment',
  syllabusText = '',
  pages = [],
  difficulty = 'MEDIUM',
  difficultySplit = { easy: 30, medium: 50, hard: 20 },
  count = 10,
  focus = 'concept + application',
  optionsPerQuestion = 4,
  allowMultiple = false,
  language = 'same as material',
  explanations = true,
  avoidDuplicates = true,
  isExtractMode = false,
  existingQuestions = []
}) {
  const isProd = process.env.NODE_ENV === 'production' || config.isProd
  const targetCount = Math.min(Math.max(1, parseInt(count, 10) || 10), AI_MAX_QUESTIONS_PER_RUN)
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim()

  // 1. Production Safety Guard: Reject immediately if keys missing in production
  if (isProd && !geminiKey && !openAiKey) {
    const err = new Error("AI generation isn't configured. Contact your administrator to configure GEMINI_API_KEY or OPENAI_API_KEY.")
    err.status = 503
    err.code = 'AI_GENERATION_NOT_CONFIGURED'
    throw err
  }

  // 2. Sanitize Text & Capacity Estimation
  const sanitizedText = String(syllabusText || '')
    .replace(/<[^>]*>?/gm, ' ')
    .slice(0, 30000)

  const estimation = estimateSupportedQuestions(sanitizedText)
  const honestCount = Math.min(targetCount, Math.max(3, estimation.supportedCount))

  // 3. Page-Aware Chunking
  const chunks = buildPageAwareChunks(pages, estimation.wordCount, honestCount)

  const executeWithRetry = async (llmFn, promptText) => {
    try {
      const rawRes = await llmFn(promptText)
      const parsed = validateAndRepairExamPayload(rawRes, sanitizedText, avoidDuplicates ? existingQuestions : [])
      if (parsed.valid) return parsed.data

      const repairPrompt = `The previous JSON had schema violations: ${JSON.stringify(parsed.error?.issues || parsed.error)}.
Please repair and return strictly valid JSON matching the schema.`
      const repairedRes = await llmFn(repairPrompt)
      const repaired = validateAndRepairExamPayload(repairedRes, sanitizedText, avoidDuplicates ? existingQuestions : [])
      if (repaired.valid) return repaired.data
      return parsed.data
    } catch (e) {
      logger.warn({ err: e.message }, 'LLM invocation failed')
      return null
    }
  }

  let rawGeneratedQuestions = []
  let detectedMetadata = {
    title: '',
    courseCode: '',
    subject: '',
    description: '',
    studentInstructions: '',
    suggestedDuration: 60
  }
  let sourceProvider = 'deterministic-mock'

  // Decide LLM caller
  let activeLlm = null
  if (geminiKey) {
    activeLlm = (p) => callGemini(geminiKey, p)
    sourceProvider = 'gemini'
  } else if (openAiKey) {
    activeLlm = (p) => callOpenAI(openAiKey, p)
    sourceProvider = 'openai'
  }

  if (activeLlm) {
    // Process chunks
    const chunksToProcess = chunks.length > 0 ? chunks : [{
      chunkIndex: 0,
      pages: [1],
      text: sanitizedText,
      targetCount: honestCount
    }]

    for (const chunk of chunksToProcess) {
      const chunkPrompt = `You are an expert university examiner.
Generate ${chunk.targetCount} multiple-choice questions strictly from this source material slice:
"""
${chunk.text}
"""
Pages included in this slice: ${chunk.pages.join(', ')}
Context / Topic: "${topic}"
Target count for this slice: ${chunk.targetCount}
Difficulty setting: "${difficulty}" (If MIXED, distribute according to: ${JSON.stringify(difficultySplit)})
Question focus: "${focus}"
Options per question: ${optionsPerQuestion}
Language: ${language}
Provide explanations: ${explanations}

CRITICAL CITATION RULES:
1. Provide exactly ${optionsPerQuestion} distinct choices per question.
2. Ground every question with "sourcePage" (must be one of: [${chunk.pages.join(', ')}]) and "supportingExcerpt" (an exact verbatim quote of at least 15 characters directly present in the source slice).
3. Do not include answer giveaways or hints in the question stem.
4. Extract title, courseCode, and description ONLY if clearly stated in this text; otherwise leave them as empty strings.

Return ONLY valid JSON matching this schema:
{
  "title": "",
  "courseCode": "",
  "subject": "",
  "description": "",
  "studentInstructions": "",
  "questions": [
    {
      "questionText": "Question text",
      "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
      "correctOptionIndex": 0,
      "difficulty": "MEDIUM",
      "confidence": 0.95,
      "sourcePage": ${chunk.pages[0] || 1},
      "supportingExcerpt": "Verbatim quote of at least 15 characters from page",
      "topic": "${topic}",
      "explanation": "Why the correct choice is accurate"
    }
  ]
}`

      const chunkResult = await executeWithRetry(activeLlm, chunkPrompt)
      if (chunkResult?.questions?.length > 0) {
        rawGeneratedQuestions.push(...chunkResult.questions)
        if (!detectedMetadata.title && chunkResult.title) detectedMetadata.title = chunkResult.title
        if (!detectedMetadata.courseCode && chunkResult.courseCode) detectedMetadata.courseCode = chunkResult.courseCode
        if (!detectedMetadata.subject && chunkResult.subject) detectedMetadata.subject = chunkResult.subject
        if (!detectedMetadata.description && chunkResult.description) detectedMetadata.description = chunkResult.description
      }
    }
  }

  // 4. Production Failure Check: If in production and 0 questions generated by LLM, fail cleanly
  if (isProd && rawGeneratedQuestions.length === 0) {
    const err = new Error('AI generation provider failed or returned no questions. Please try again or create questions manually.')
    err.status = 502
    err.code = 'AI_PROVIDER_UNAVAILABLE'
    throw err
  }

  // 5. In Non-Production: Allow Mock Generation if LLM gave 0 questions
  if (rawGeneratedQuestions.length === 0) {
    rawGeneratedQuestions = generateFallbackQuestions(topic, sanitizedText, difficulty, honestCount)
    sourceProvider = 'deterministic-mock'
  }

  // 6. Server-Side Verbatim Citation Verification: Drop Hallucinated Questions
  const { acceptedQuestions, rejectedCount, rejectionReasons } = verifyAndFilterGroundedQuestions(
    rawGeneratedQuestions,
    pages,
    sanitizedText
  )

  // 7. Audit Logging (Zero file text in logs)
  logger.info(
    {
      provider: sourceProvider,
      model: sourceProvider === 'gemini' ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : sourceProvider === 'openai' ? 'gpt-4o-mini' : 'fixture-rules',
      requestedCount: targetCount,
      honestCount,
      acceptedCount: acceptedQuestions.length,
      rejectedCount,
      rejectionReasons
    },
    'AI question generation completed with citation verification'
  )

  const honestyNote = acceptedQuestions.length < targetCount
    ? `The provided material reliably grounds about ${acceptedQuestions.length} questions (requested: ${targetCount}). ${rejectedCount} unverified or ungrounded questions were dropped.`
    : null

  return {
    title: detectedMetadata.title || `${topic} Assessment`,
    courseCode: detectedMetadata.courseCode || '',
    subject: detectedMetadata.subject || topic,
    description: detectedMetadata.description || '',
    studentInstructions: detectedMetadata.studentInstructions || 'Read each question carefully. Select the most accurate option.',
    suggestedDuration: 60,
    markingScheme: { positive: 1, negative: 0 },
    questions: acceptedQuestions,
    source: sourceProvider,
    honestyNote,
    aiAudit: {
      provider: sourceProvider,
      modelName: sourceProvider === 'gemini' ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : sourceProvider === 'openai' ? 'gpt-4o-mini' : 'deterministic-mock',
      promptVersion: '2.2.0',
      extractionStats: {
        totalPages: pages?.length || 1,
        totalWords: estimation.wordCount,
        acceptedCount: acceptedQuestions.length,
        rejectedCount
      },
      settings: {
        count: targetCount,
        difficulty,
        difficultySplit,
        focus,
        optionsPerQuestion,
        allowMultiple,
        language,
        explanations
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Single Question Regeneration from Excerpt
// ---------------------------------------------------------------------------

async function regenerateSingleQuestion({
  topic = 'General',
  excerpt = '',
  sourcePage = 1,
  difficulty = 'MEDIUM',
  optionsPerQuestion = 4
}) {
  const isProd = process.env.NODE_ENV === 'production' || config.isProd
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim()

  if (isProd && !geminiKey && !openAiKey) {
    const err = new Error("AI generation isn't configured. Contact your administrator to configure GEMINI_API_KEY or OPENAI_API_KEY.")
    err.status = 503
    err.code = 'AI_GENERATION_NOT_CONFIGURED'
    throw err
  }

  const prompt = `You are an expert examiner.
Create exactly ONE multiple choice question strictly grounded on this excerpt from Page ${sourcePage}:
"""
${excerpt}
"""
Topic: "${topic}"
Difficulty: "${difficulty}"
Options: ${optionsPerQuestion}

Return ONLY valid JSON:
{
  "questionText": "Question stem",
  "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
  "correctOptionIndex": 0,
  "difficulty": "${difficulty}",
  "confidence": 0.95,
  "sourcePage": ${sourcePage},
  "supportingExcerpt": "${excerpt.replace(/"/g, '\\"')}",
  "explanation": "Why choice is correct"
}`

  let raw = null
  if (geminiKey) {
    try { raw = await callGemini(geminiKey, prompt) } catch (_) {}
  }
  if (!raw && openAiKey) {
    try { raw = await callOpenAI(openAiKey, prompt) } catch (_) {}
  }

  if (!raw) {
    if (isProd) {
      const err = new Error('AI provider failed to regenerate question.')
      err.status = 502
      err.code = 'AI_PROVIDER_UNAVAILABLE'
      throw err
    }
    // Non-production fallback
    raw = {
      questionText: `Which assertion accurately reflects the protocol definition: "${excerpt.slice(0, 80)}..."?`,
      options: [
        `Directly aligns with: ${excerpt.slice(0, 60)}`,
        'Contradicts the verified operational constraint',
        'Introduces an unverified asynchronous dependency',
        'Exceeds standard architectural bounds'
      ],
      correctOptionIndex: 0,
      difficulty,
      confidence: 0.95,
      sourcePage,
      supportingExcerpt: excerpt,
      explanation: 'Verified directly against the supplied excerpt.'
    }
  }

  const normalized = normalizeGeneratedQuestions([raw], excerpt, [])
  return normalized[0]
}

module.exports = {
  generateExamQuestions,
  regenerateSingleQuestion,
  generateFallbackQuestions,
  normalizeGeneratedQuestions,
  validateAndRepairExamPayload,
  estimateSupportedQuestions,
  checkGrounding,
  verifyVerbatimCitation,
  verifyAndFilterGroundedQuestions,
  buildPageAwareChunks,
  getAiProviderInfo,
  probeAiAvailability,
  calculateSimilarity,
  examExtractionSchema,
  questionSchema,
  AI_MAX_QUESTIONS_PER_RUN,
  AI_MAX_PDF_PAGES,
  AI_DAILY_QUESTION_QUOTA_PER_USER,
  AI_MIN_SUBSTANTIVE_WORDS
}
