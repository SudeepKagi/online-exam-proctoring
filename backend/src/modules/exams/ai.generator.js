'use strict'

const axios = require('axios')

/**
 * Deterministic fallback domain questions when LLM is unavailable or unconfigured
 */
function generateFallbackQuestions(topic = 'General Computing', syllabusText = '', difficulty = 'MEDIUM', count = 5) {
  const seedKeywords = (syllabusText + ' ' + topic)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)

  const subject = topic || 'Computer Science'
  const templates = [
    {
      q: (kw) => `What is the primary architectural purpose of ${kw} in ${subject}?`,
      opts: [
        (kw) => `Enables deterministic abstraction and optimized throughput for ${kw}`,
        () => 'Increases memory consumption without performance guarantees',
        () => 'Bypasses standard runtime validation and access control',
        () => 'Forces synchronous blocking across all independent threads'
      ],
      correct: 0
    },
    {
      q: (kw) => `Which of the following best characterizes time and space complexity considerations for ${kw}?`,
      opts: [
        () => 'Requires unconstrained heap memory with linear degradation',
        (kw) => `Yields bounded overhead when properly indexed or partitioned according to ${kw} standards`,
        () => 'Operates in O(1) time regardless of physical hardware constraints',
        () => 'Invalidates cache hierarchies across all virtual cores'
      ],
      correct: 1
    },
    {
      q: (kw) => `In high-concurrency environments, how does ${kw} prevent synchronization bottlenecks?`,
      opts: [
        () => 'By acquiring global exclusive locks on every data modification',
        () => 'By dropping unprocessed write transactions automatically',
        (kw) => `By leveraging non-blocking atomic primitives and immutable isolation boundaries for ${kw}`,
        () => 'By disabling hardware interrupts during peak traffic'
      ],
      correct: 2
    },
    {
      q: (kw) => `What is a critical failure mode when deploying ${kw} without adequate safety boundaries?`,
      opts: [
        () => 'Predictable linear throughput scaling across nodes',
        () => 'Automatic healing and self-contained recovery cascades',
        () => 'Strict cryptographic signature verification passes',
        (kw) => `Cascading contention, starvation, or resource exhaustion under unexpected ${kw} spikes`
      ],
      correct: 3
    },
    {
      q: (kw) => `Which protocol or standard is most commonly associated with robust ${kw} integration?`,
      opts: [
        (kw) => `Industry-standard interfaces ensuring interoperability and idempotent state transitions for ${kw}`,
        () => 'Proprietary unencrypted point-to-point UDP streaming without verification',
        () => 'Legacy synchronous RPC requiring persistent physical serial lines',
        () => 'Stateless multicast broadcasts ignoring delivery receipts'
      ],
      correct: 0
    }
  ]

  const questions = []
  const n = Math.min(Math.max(1, parseInt(count, 10) || 5), 20)

  for (let i = 0; i < n; i++) {
    const kw = seedKeywords[i % Math.max(1, seedKeywords.length)] || `${subject} Component ${i + 1}`
    const tmpl = templates[i % templates.length]
    questions.push({
      questionText: tmpl.q(kw),
      options: tmpl.opts.map(fn => fn(kw)),
      correctOptionIndex: tmpl.correct,
      marks: difficulty.toUpperCase() === 'HARD' ? 2 : 1,
      negativeMarks: 0,
      difficulty: difficulty.toUpperCase()
    })
  }

  return questions
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' }
  }, { timeout: 25000 })
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
  return JSON.parse(text)
}

async function callOpenAI(apiKey, prompt) {
  const url = 'https://api.openai.com/v1/chat/completions'
  const res = await axios.post(url, {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 25000
  })
  const text = res.data?.choices?.[0]?.message?.content
  return JSON.parse(text)
}

function normalizeGeneratedQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return []
  return rawQuestions.map((q, idx) => {
    let opts = q.options || []
    let correctIdx = q.correctOptionIndex
    if (Array.isArray(opts) && typeof opts[0] === 'object') {
      const found = opts.findIndex(o => o.isCorrect)
      if (found !== -1) correctIdx = found
      opts = opts.map(o => o.text || o.optionText || String(o))
    }
    if (typeof correctIdx === 'string') {
      const u = correctIdx.toUpperCase()
      if (['A', 'B', 'C', 'D'].includes(u)) correctIdx = u.charCodeAt(0) - 65
      else correctIdx = parseInt(correctIdx, 10)
    }
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) correctIdx = 0
    while (opts.length < 4) opts.push(`Option ${opts.length + 1}`)
    opts = opts.slice(0, 4)

    return {
      questionText: q.questionText || q.prompt || `Question ${idx + 1}`,
      options: opts,
      correctOptionIndex: correctIdx,
      marks: Number(q.marks) || 1,
      negativeMarks: Number(q.negativeMarks) || 0,
      difficulty: q.difficulty || 'MEDIUM'
    }
  })
}

async function generateExamQuestions({ topic, syllabusText = '', difficulty = 'MEDIUM', count = 5 }) {
  const numQuestions = Math.min(Math.max(1, parseInt(count, 10) || 5), 20)
  const geminiKey = process.env.GEMINI_API_KEY
  const openAiKey = process.env.OPENAI_API_KEY

  const prompt = `You are an expert examination creator. Generate exactly ${numQuestions} multiple choice questions (MCQs) for the topic "${topic}".
Syllabus / Notes context: "${syllabusText.slice(0, 1500)}".
Difficulty level: ${difficulty}.
CRITICAL REQUIREMENTS:
- Return ONLY valid JSON format: { "questions": [ { "questionText": "...", "options": ["Choice A", "Choice B", "Choice C", "Choice D"], "correctOptionIndex": 0, "marks": 1, "negativeMarks": 0, "difficulty": "${difficulty}" } ] }
- Each question MUST have exactly 4 choices in "options".
- "correctOptionIndex" MUST be an integer from 0 to 3 indicating the single correct choice.
- Questions should be clear, professional, and academically rigorous.`

  if (geminiKey) {
    try {
      const res = await callGemini(geminiKey, prompt)
      const list = res.questions || (Array.isArray(res) ? res : [])
      const normalized = normalizeGeneratedQuestions(list)
      if (normalized.length > 0) return { questions: normalized, source: 'gemini' }
    } catch (_) {}
  }

  if (openAiKey) {
    try {
      const res = await callOpenAI(openAiKey, prompt)
      const list = res.questions || (Array.isArray(res) ? res : [])
      const normalized = normalizeGeneratedQuestions(list)
      if (normalized.length > 0) return { questions: normalized, source: 'openai' }
    } catch (_) {}
  }

  const fallback = generateFallbackQuestions(topic, syllabusText, difficulty, numQuestions)
  return { questions: fallback, source: 'deterministic-fallback' }
}

module.exports = {
  generateExamQuestions,
  generateFallbackQuestions,
  normalizeGeneratedQuestions
}
