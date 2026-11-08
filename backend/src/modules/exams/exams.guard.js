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
  if (!startTime || !endTime) {
    const err = new Error('Exam start time and end time are required.')
    err.status = 400
    err.code = 'INVALID_EXAM_WINDOW'
    throw err
  }

  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    const err = new Error('Exam end time must be strictly after start time.')
    err.status = 400
    err.code = 'INVALID_EXAM_WINDOW'
    throw err
  }

  const dur = Number(durationMinutes !== undefined ? durationMinutes : 60)
  if (isNaN(dur) || dur <= 0) {
    const err = new Error('Exam duration must be greater than 0.')
    err.status = 400
    err.code = 'INVALID_DURATION'
    throw err
  }

  const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
  if (dur > windowMinutes) {
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

const ALLOWED_PROCTORING_CONFIG_KEYS = new Set([
  'sebRequired',
  'sebConfigKey',
  'sebFileKey',
  'clearSebConfigKey',
  'allowCalculator',
  'maxViolations',
  'description',
  'department',
  'semester',
  'examCode',
  'invigilatorCredentials',
  'cameraRequired',
  'screenShareRequired',
  'fullScreenMode',
  'browserLock',
  'allowedBrowserExamKeys'
])

function sanitizeProctoringConfigInput(input, { isUpdate = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }

  const sanitized = {}
  for (const [key, value] of Object.entries(input)) {
    if (ALLOWED_PROCTORING_CONFIG_KEYS.has(key)) {
      sanitized[key] = value
    }
  }

  if (sanitized.sebRequired !== undefined) {
    sanitized.sebRequired = Boolean(sanitized.sebRequired)
  }

  if (sanitized.sebFileKey !== undefined) {
    sanitized.sebFileKey = sanitized.sebFileKey === null ? null : String(sanitized.sebFileKey)
  }

  if (sanitized.clearSebConfigKey !== undefined) {
    const shouldClear = Boolean(sanitized.clearSebConfigKey)
    delete sanitized.clearSebConfigKey
    if (shouldClear) {
      sanitized.sebConfigKey = null
    }
  }

  if (sanitized.sebConfigKey !== undefined && sanitized.sebConfigKey !== null) {
    const rawVal = String(sanitized.sebConfigKey).trim()
    if (rawVal === '') {
      sanitized.sebConfigKey = isUpdate ? undefined : null
    } else if (rawVal.startsWith('•')) {
      if (!isUpdate) {
        const err = new Error('SEB Config Key must be exactly 64 hex characters.')
        err.status = 400
        err.code = 'INVALID_SEB_KEY'
        throw err
      }
      sanitized.sebConfigKey = undefined
    } else {
      if (!/^[0-9a-fA-F]{64}$/.test(rawVal)) {
        const err = new Error('SEB Config Key must be exactly 64 hex characters.')
        err.status = 400
        err.code = 'INVALID_SEB_KEY'
        throw err
      }
      sanitized.sebConfigKey = rawVal.toLowerCase()
    }
  }

  return sanitized
}

module.exports = {
  checkExamMutability,
  validateScheduleWindow,
  validateQuestionsList,
  sanitizeProctoringConfigInput,
  ALLOWED_PROCTORING_CONFIG_KEYS
}
