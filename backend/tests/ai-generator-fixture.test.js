'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  validateAndRepairExamPayload,
  normalizeGeneratedQuestions,
  generateFallbackQuestions,
  examExtractionSchema
} = require('../src/modules/exams/ai.generator')

describe('AI Generator Fixture & Validation Suite', () => {
  it('1. Successfully validates a well-formed LLM response with Zod', () => {
    const raw = {
      title: 'Digital Signal Processing Assessment',
      courseCode: '22EC71',
      description: 'Mid-term evaluation covering DFT and FFT algorithms.',
      suggestedDuration: 60,
      questions: [
        {
          questionText: 'What is the twiddle factor in an 8-point radix-2 FFT?',
          options: ['e^(-j*2*pi/8)', 'e^(j*pi/4)', 'e^(-j*pi)', '1'],
          correctOptionIndex: 0,
          marks: 1,
          negativeMarks: 0,
          difficulty: 'MEDIUM',
          confidence: 0.95,
          sourcePage: 1
        }
      ]
    }

    const validated = validateAndRepairExamPayload(raw)
    assert.equal(validated.valid, true)
    assert.equal(validated.data.title, 'Digital Signal Processing Assessment')
    assert.equal(validated.data.questions.length, 1)
    assert.equal(validated.data.questions[0].correctOptionIndex, 0)
    assert.equal(validated.data.questions[0].confidence, 0.95)
  })

  it('2. Normalizes non-standard option formats (objects with isCorrect)', () => {
    const nonStandard = [
      {
        questionText: 'Which protocol is connection-oriented?',
        options: [
          { text: 'TCP', isCorrect: true },
          { text: 'UDP', isCorrect: false },
          { text: 'ICMP', isCorrect: false },
          { text: 'ARP', isCorrect: false }
        ]
      }
    ]

    const normalized = normalizeGeneratedQuestions(nonStandard)
    assert.equal(normalized.length, 1)
    assert.equal(normalized[0].options[0], 'TCP')
    assert.equal(normalized[0].correctOptionIndex, 0)
    assert.equal(normalized[0].options.length, 4)
  })

  it('3. Normalizes letter-based correctOptionIndex (A, B, C, D)', () => {
    const raw = [
      {
        questionText: 'Which layer is IP in the OSI model?',
        options: ['Application', 'Transport', 'Network', 'Physical'],
        correctOptionIndex: 'C'
      }
    ]

    const normalized = normalizeGeneratedQuestions(raw)
    assert.equal(normalized.length, 1)
    assert.equal(normalized[0].correctOptionIndex, 2) // 'C' -> index 2
  })

  it('4. Deterministic fallback produces valid 4-option questions with bounded marks', () => {
    const fallback = generateFallbackQuestions('Operating Systems', 'Kernel memory paging', 'HARD', 5)
    assert.equal(fallback.length, 5)
    for (const q of fallback) {
      assert.ok(q.questionText.length > 10)
      assert.equal(q.options.length, 4)
      assert.ok(q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3)
      assert.equal(q.marks, 2) // HARD -> 2 marks
      assert.equal(q.negativeMarks, 0)
    }
  })

  it('5. Flags low confidence questions (< 0.7) for review', () => {
    const raw = {
      title: 'Chemistry Exam',
      questions: [
        {
          questionText: 'What is the atomic number of Carbon?',
          options: ['6', '12', '14', '8'],
          correctOptionIndex: 0,
          confidence: 0.5
        }
      ]
    }

    const validated = validateAndRepairExamPayload(raw)
    assert.equal(validated.valid, true)
    assert.equal(validated.data.questions[0].needsReview, true)
  })
})

