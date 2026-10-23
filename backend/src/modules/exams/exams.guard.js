'use strict'

const examsSql = require('./exams.sql')
const { prisma } = require('../../infra/postgres/client')

async function checkExamMutability(examId, _isQuestionMutation = false) {
  const exam = await examsSql.findExamById(examId)
  if (!exam) {
    const err = new Error('Exam not found')
    err.status = 404
    throw err
  }

  const serverNow = new Date()
  const hasStarted = exam.startTime && serverNow >= new Date(exam.startTime)
  const hasEnded = exam.endTime && serverNow > new Date(exam.endTime)

  if (exam.status !== 'DRAFT' && (hasStarted || hasEnded)) {
    const err = new Error('Exam cannot be edited or deleted once it has started or ended.')
    err.status = 409
    err.code = 'EXAM_IMMUTABLE_ACTIVE_OR_ENDED'
    throw err
  }

  let attemptCount
  try {
    attemptCount = await prisma.examAttempt.count({ where: { examId } })
  } catch (_) {
    attemptCount = 0
  }

  if (attemptCount > 0) {
    const err = new Error('Exam cannot be modified because student attempts already exist.')
    err.status = 409
    err.code = 'EXAM_HAS_ATTEMPTS'
    throw err
  }

  return exam
}

function validateScheduleWindow(startTime, endTime, durationMinutes) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    const err = new Error('Exam end time must be strictly after start time.')
    err.status = 400
    err.code = 'INVALID_EXAM_WINDOW'
    throw err
  }

  const dur = Number(durationMinutes || 60)
  const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
  if (dur <= 0 || dur > windowMinutes) {
    const err = new Error('Exam duration must be greater than 0 and cannot exceed scheduled window.')
    err.status = 400
    err.code = 'DURATION_EXCEEDS_WINDOW'
    throw err
  }
}

function validateQuestionsList(questions) {
  if (!questions || questions.length === 0) {
    const err = new Error('Cannot publish exam without questions.')
    err.status = 400
    err.code = 'EXAM_INCOMPLETE'
    throw err
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const text = q.questionText || q.prompt || ''
    if (!text.trim()) {
      const err = new Error(`Question ${i + 1} has empty text prompt.`)
      err.status = 400
      err.code = 'EXAM_INCOMPLETE'
      throw err
    }
    let opts = q.options
    if (opts && typeof opts === 'object' && !Array.isArray(opts) && Array.isArray(opts.choices)) {
      opts = opts.choices
    }
    if (!Array.isArray(opts) || opts.length < 2) {
      const err = new Error(`Question ${i + 1} must have at least 2 options.`)
      err.status = 400
      err.code = 'EXAM_INCOMPLETE'
      throw err
    }
    const marks = Number(q.marks ?? 1)
    if (isNaN(marks) || marks <= 0) {
      const err = new Error(`Question ${i + 1} must have positive marks (> 0).`)
      err.status = 400
      err.code = 'EXAM_INCOMPLETE'
      throw err
    }
    const cIdx = Number(q.correctOptionIndex)
    if (isNaN(cIdx) || cIdx < 0 || cIdx >= opts.length) {
      const err = new Error(`Question ${i + 1} has invalid correct option index.`)
      err.status = 400
      err.code = 'EXAM_INCOMPLETE'
      throw err
    }
  }
}

module.exports = {
  checkExamMutability,
  validateScheduleWindow,
  validateQuestionsList
}
