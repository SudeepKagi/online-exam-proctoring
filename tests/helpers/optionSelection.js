'use strict'

/**
 * Option selection logic mirroring QuestionPanel.jsx and ExamInterface.jsx
 */

// Mirrors QuestionPanel.jsx line 124 onClick and ExamInterface.jsx line 639-646 setAnswer
function resolveAnswerOptionIdBuggy(question, val) {
  if (!question || !question.options) return val
  const matchOpt = question.options.find((opt, i) => {
    const letter = String.fromCharCode(65 + i)
    return opt.id === val || opt.text === val || letter === val
  })
  return matchOpt ? matchOpt.id : val
}

function isOptionSelectedBuggy(opt, currentAnswer) {
  return currentAnswer === opt.letter || currentAnswer === opt.text || (opt.id && currentAnswer === opt.id)
}

// Fixed option selection logic: strictly by option id
function resolveAnswerOptionIdFixed(question, val) {
  if (!question || !question.options) return val
  const matchOpt = question.options.find(opt => opt.id === val)
  return matchOpt ? matchOpt.id : null
}

function isOptionSelectedFixed(opt, currentAnswer) {
  return Boolean(opt.id && currentAnswer === opt.id)
}

module.exports = {
  resolveAnswerOptionId: (question, clickedOption) => {
    // Fixed QuestionPanel passes opt.id
    return resolveAnswerOptionIdFixed(question, clickedOption.id)
  },
  isOptionSelected: isOptionSelectedFixed,
  resolveAnswerOptionIdFixed,
  isOptionSelectedFixed
}
