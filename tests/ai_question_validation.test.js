const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  validateMcqQuestion,
  normalizeExcelQuestionRow
} = require(path.join(__dirname, '../proctornet/backend/src/modules/questions/validation'))

describe('BUG-E07: AI Question Preview Validation', () => {
  it('rejects question with missing unambiguous correct option (0 correct)', () => {
    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: 'What is 2 + 2?',
          options: [
            { text: '3', isCorrect: false },
            { text: '4', isCorrect: false },
            { text: '5', isCorrect: false }
          ],
          marks: 2
        })
      },
      (err) => {
        assert.match(err.message, /must have exactly one correct option/i)
        return true
      }
    )
  })

  it('rejects question with multiple correct options (>1 correct)', () => {
    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: 'Which are primary colors?',
          options: [
            { text: 'Red', isCorrect: true },
            { text: 'Blue', isCorrect: true },
            { text: 'Green', isCorrect: false }
          ],
          marks: 2
        })
      },
      (err) => {
        assert.match(err.message, /must have exactly one correct option/i)
        return true
      }
    )
  })

  it('rejects question with fewer than 2 options or more than 6 options', () => {
    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: 'Single option question?',
          options: [{ text: 'Only one', isCorrect: true }]
        })
      },
      (err) => {
        assert.match(err.message, /between 2 and 6 options/i)
        return true
      }
    )

    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: 'Too many options question?',
          options: [
            { text: '1', isCorrect: true },
            { text: '2', isCorrect: false },
            { text: '3', isCorrect: false },
            { text: '4', isCorrect: false },
            { text: '5', isCorrect: false },
            { text: '6', isCorrect: false },
            { text: '7', isCorrect: false }
          ]
        })
      },
      (err) => {
        assert.match(err.message, /between 2 and 6 options/i)
        return true
      }
    )
  })

  it('rejects empty question text and invalid marks', () => {
    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: '   ',
          options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }]
        })
      },
      (err) => {
        assert.match(err.message, /Question text is required/i)
        return true
      }
    )

    assert.throws(
      () => {
        validateMcqQuestion({
          questionText: 'Negative marks overflow?',
          marks: 2,
          negativeMarks: 5,
          options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }]
        })
      },
      (err) => {
        assert.match(err.message, /Negative marks.*cannot exceed positive marks/i)
        return true
      }
    )
  })

  it('correctly normalizes Excel question row with letter-based correct option', () => {
    const row = {
      Question: 'What is the capital of France?',
      OptionA: 'London',
      OptionB: 'Paris',
      OptionC: 'Berlin',
      OptionD: 'Madrid',
      CorrectOption: 'B',
      Marks: 3,
      NegativeMarks: 1,
      Difficulty: 'EASY'
    }

    const validated = normalizeExcelQuestionRow(row, 1)
    assert.equal(validated.questionText, 'What is the capital of France?')
    assert.equal(validated.marks, 3)
    assert.equal(validated.negativeMarks, 1)
    assert.equal(validated.difficulty, 'EASY')
    assert.equal(validated.options.length, 4)

    const correct = validated.options.filter(o => o.isCorrect)
    assert.equal(correct.length, 1)
    assert.equal(correct[0].text, 'Paris')
  })
})
