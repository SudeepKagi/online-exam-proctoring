'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

describe('BUG B — Correct option chosen, but the result says wrong', () => {
  const question = {
    id: 'q-collide-1',
    attemptQuestionId: 'aq-collide-1',
    options: [
      { id: 'opt-c-1111', text: 'C', order: 0 },
      { id: 'opt-a-2222', text: 'A', order: 1 },
      { id: 'opt-d-3333', text: 'D', order: 2 },
      { id: 'opt-b-4444', text: 'B', order: 3 }
    ]
  }

  it('B.1: clicking the 3rd option (letter C, text D) must record exactly option id opt-d-3333, not opt-c-1111', () => {
    const optionsList = question.options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i)
      return { letter, text: opt.text, id: opt.id }
    })

    const thirdOpt = optionsList[2]
    assert.strictEqual(thirdOpt.letter, 'C')
    assert.strictEqual(thirdOpt.text, 'D')
    assert.strictEqual(thirdOpt.id, 'opt-d-3333')

    const { resolveAnswerOptionId, isOptionSelected } = require('./helpers/optionSelection')
    
    // Simulate what happens when student clicks the 3rd option
    const recordedId = resolveAnswerOptionId(question, thirdOpt)
    
    // The recorded ID must be opt-d-3333
    assert.strictEqual(recordedId, 'opt-d-3333', 'Must record exactly option ID opt-d-3333')

    // UI selection check: 1st option (text 'C') must NOT be selected, 3rd option must be selected
    assert.strictEqual(isOptionSelected(optionsList[0], recordedId), false, 'First option with text C must not be selected')
    assert.strictEqual(isOptionSelected(optionsList[2], recordedId), true, 'Third option must be selected')
  })
})
