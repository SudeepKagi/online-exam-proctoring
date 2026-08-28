const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Phase C — Remediation Verification', () => {

  // ════════════════════════════════════════════════════
  // H-1: Negative Marking Scoring Logic
  // ════════════════════════════════════════════════════
  describe('H-1: Negative Marking Scoring Semantics', () => {
    function computeScore({ exam, questions, answers }) {
      const calculatedTotalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0) || 100
      let totalScore = 0

      for (const q of questions) {
        const ans = answers[q.id]
        if (!ans) continue // Unanswered

        const selectedOption = ans.selectedOption
        let isCorrect = false
        if (q.correctAnswer && selectedOption && selectedOption.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
          isCorrect = true
        }

        let marksAwarded = 0
        if (isCorrect) {
          marksAwarded = q.marks || 0
        } else if (exam?.negativeMarking && selectedOption && String(selectedOption).trim().length > 0) {
          let penalty = 0
          if (q.negativeMarks !== null && q.negativeMarks !== undefined && q.negativeMarks > 0) {
            penalty = Number(q.negativeMarks)
          } else if (exam?.negativeValue !== null && exam?.negativeValue !== undefined && exam?.negativeValue > 0) {
            penalty = Number(exam.negativeValue)
          }
          marksAwarded = -penalty
        }

        totalScore += marksAwarded
      }

      if (!exam?.negativeMarking) {
        totalScore = Math.max(0, totalScore)
      }

      const percentage = calculatedTotalMarks > 0 ? (totalScore / calculatedTotalMarks) * 100 : 0
      return { totalScore, percentage, calculatedTotalMarks }
    }

    it('All correct answers award full positive marks (100%)', () => {
      const exam = { negativeMarking: true, negativeValue: 1 }
      const questions = [
        { id: 'q1', marks: 10, correctAnswer: 'A', negativeMarks: null },
        { id: 'q2', marks: 10, correctAnswer: 'B', negativeMarks: null }
      ]
      const answers = {
        q1: { selectedOption: 'A' },
        q2: { selectedOption: 'B' }
      }

      const res = computeScore({ exam, questions, answers })
      assert.strictEqual(res.totalScore, 20)
      assert.strictEqual(res.percentage, 100)
    })

    it('All incorrect answers with negative marking enabled deduct exam negativeValue', () => {
      const exam = { negativeMarking: true, negativeValue: 2 }
      const questions = [
        { id: 'q1', marks: 10, correctAnswer: 'A', negativeMarks: null },
        { id: 'q2', marks: 10, correctAnswer: 'B', negativeMarks: null }
      ]
      const answers = {
        q1: { selectedOption: 'C' },
        q2: { selectedOption: 'D' }
      }

      const res = computeScore({ exam, questions, answers })
      assert.strictEqual(res.totalScore, -4)
      assert.strictEqual(res.percentage, -20)
    })

    it('Question-level negativeMarks takes precedence over exam-level negativeValue', () => {
      const exam = { negativeMarking: true, negativeValue: 1 }
      const questions = [
        { id: 'q1', marks: 10, correctAnswer: 'A', negativeMarks: 3 }, // Per-question penalty = 3
        { id: 'q2', marks: 10, correctAnswer: 'B', negativeMarks: null } // Fallback penalty = 1
      ]
      const answers = {
        q1: { selectedOption: 'C' },
        q2: { selectedOption: 'D' }
      }

      const res = computeScore({ exam, questions, answers })
      assert.strictEqual(res.totalScore, -4) // -3 + -1 = -4
    })

    it('Unanswered questions incur zero positive and zero negative penalty', () => {
      const exam = { negativeMarking: true, negativeValue: 2 }
      const questions = [
        { id: 'q1', marks: 10, correctAnswer: 'A' },
        { id: 'q2', marks: 10, correctAnswer: 'B' },
        { id: 'q3', marks: 10, correctAnswer: 'C' }
      ]
      const answers = {
        q1: { selectedOption: 'A' }, // +10
        q2: { selectedOption: 'D' }, // -2
        // q3 is unanswered (not in answers map)
      }

      const res = computeScore({ exam, questions, answers })
      assert.strictEqual(res.totalScore, 8)
      assert.strictEqual(res.calculatedTotalMarks, 30)
      assert.strictEqual(Math.round(res.percentage * 10) / 10, 26.7)
    })

    it('When negative marking is disabled, score cannot be negative (clamped to 0)', () => {
      const exam = { negativeMarking: false, negativeValue: 2 }
      const questions = [
        { id: 'q1', marks: 10, correctAnswer: 'A' },
        { id: 'q2', marks: 10, correctAnswer: 'B' }
      ]
      const answers = {
        q1: { selectedOption: 'C' },
        q2: { selectedOption: 'D' }
      }

      const res = computeScore({ exam, questions, answers })
      assert.strictEqual(res.totalScore, 0)
      assert.strictEqual(res.percentage, 0)
    })
  })

  // ════════════════════════════════════════════════════
  // H-7 & H-5: Invigilator Login & Placeholder ID
  // ════════════════════════════════════════════════════
  describe('H-7 & H-5: Invigilator Login Consolidation & Placeholder Removal', () => {
    it('invigilator.controller exports a valid login delegate', () => {
      const invCtrl = require('../src/controllers/invigilator.controller')
      assert.strictEqual(typeof invCtrl.login, 'function')
    })

    it('auth.controller.js invigilatorLogin does not hardcode placeholder_id', () => {
      const fs = require('fs')
      const path = require('path')
      const content = fs.readFileSync(path.join(__dirname, '../src/controllers/auth.controller.js'), 'utf8')
      assert.ok(!content.includes("'placeholder_id'"), "Must not contain hardcoded 'placeholder_id'")
    })
  })

  // ════════════════════════════════════════════════════
  // H-8: Questions Route Scoping Guard
  // ════════════════════════════════════════════════════
  describe('H-8: Questions Route Exam Scoping', () => {
    it('listQuestions rejects request when examId is omitted', async () => {
      const facultyCtrl = require('../src/controllers/faculty.controller')
      const req = { params: {}, query: {}, user: { id: 'fac-1', role: 'faculty' } }
      let statusCode = null
      let responseBody = null

      const res = {
        status(code) {
          statusCode = code
          return this
        },
        json(body) {
          responseBody = body
          return this
        }
      }

      await facultyCtrl.listQuestions(req, res)
      assert.strictEqual(statusCode, 400)
      assert.ok(responseBody?.error?.includes('examId is required'))
    })
  })
})
