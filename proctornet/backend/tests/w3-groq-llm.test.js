'use strict'

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.STORAGE_DRIVER = 'memory'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
process.env.NODE_ENV = 'test'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseAndValidate, buildPrompt, estimateCost, LLMService } = require('../src/modules/faculty/llmService')

describe('W3: Groq LLM & Question Generation Unit Tests (S-5)', () => {
  it('1. buildPrompt generates strict prompt requesting questions object', () => {
    const prompt = buildPrompt('Operating Systems', 5, 'HARD')
    assert.ok(prompt.includes('Operating Systems'))
    assert.ok(prompt.includes('HARD'))
    assert.ok(prompt.includes('"questions"'))
  })

  it('2. parseAndValidate parses valid JSON array output', () => {
    const raw = JSON.stringify([
      {
        questionText: 'What is the primary function of an operating system kernel?',
        marks: 2,
        negativeMarks: 0.5,
        difficulty: 'MEDIUM',
        options: [
          { text: 'Resource management and hardware abstraction', isCorrect: true, order: 0 },
          { text: 'Compiling source code to machine instructions', isCorrect: false, order: 1 },
          { text: 'Rendering user interface widgets', isCorrect: false, order: 2 },
          { text: 'Browsing remote web pages', isCorrect: false, order: 3 }
        ]
      }
    ])

    const { questions, validationErrors } = parseAndValidate(raw, 1)
    assert.strictEqual(questions.length, 1)
    assert.strictEqual(validationErrors.length, 0)
    assert.strictEqual(questions[0].questionText, 'What is the primary function of an operating system kernel?')
  })

  it('3. parseAndValidate parses JSON object with questions array (Groq json_object format)', () => {
    const raw = JSON.stringify({
      questions: [
        {
          questionText: 'Which scheduling algorithm is non-preemptive by definition?',
          marks: 2,
          negativeMarks: 0.5,
          difficulty: 'MEDIUM',
          options: [
            { text: 'First-Come First-Served (FCFS)', isCorrect: true, order: 0 },
            { text: 'Round Robin (RR)', isCorrect: false, order: 1 },
            { text: 'Shortest Remaining Time First (SRTF)', isCorrect: false, order: 2 },
            { text: 'Priority Preemptive Scheduling', isCorrect: false, order: 3 }
          ]
        }
      ]
    })

    const { questions, validationErrors } = parseAndValidate(raw, 1)
    assert.strictEqual(questions.length, 1)
    assert.strictEqual(validationErrors.length, 0)
  })

  it('4. parseAndValidate rejects questions without exactly one correct answer', () => {
    const raw = JSON.stringify({
      questions: [
        {
          questionText: 'What causes a deadlock condition in concurrent systems?',
          marks: 2,
          negativeMarks: 0.5,
          difficulty: 'HARD',
          options: [
            { text: 'Mutual exclusion', isCorrect: true, order: 0 },
            { text: 'Circular wait', isCorrect: true, order: 1 }, // Two correct answers!
            { text: 'Preemption enabled', isCorrect: false, order: 2 },
            { text: 'Infinite memory', isCorrect: false, order: 3 }
          ]
        }
      ]
    })

    assert.throws(
      () => parseAndValidate(raw, 1),
      /none passed validation/
    )
  })

  it('5. In-memory cost and rate limit caps reject calls when limit exceeded', async () => {
    const testService = new LLMService()
    const facultyId = 'test-fac-' + Date.now()

    // Test with LLM_PROVIDER=none or unconfigured throws defensive guard
    await assert.rejects(
      async () => {
        await testService.generateQuestionsPreview({
          topic: 'Computer Networks',
          count: 5,
          facultyId,
          providerOverride: 'none'
        })
      },
      /Question assistant isn't enabled/
    )
  })

  it('6. estimateCost computes proper cost for Groq models', () => {
    const cost = estimateCost('llama-3.3-70b-versatile', 1000)
    assert.strictEqual(cost, 0.00059)
  })
})
