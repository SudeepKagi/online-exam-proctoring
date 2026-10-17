const attemptsSql = require('./attempts.sql')
const examsSql = require('../exams/exams.sql')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { ROLES, normalizeRole } = require('../../shared/roles')

class AttemptService {
  async getReadiness(examId, studentId) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    if (['ENDED', 'EVALUATED'].includes(exam.status)) {
      const err = new Error('Exam session has closed')
      err.status = 403
      throw err
    }

    let attempt = await attemptsSql.findAttemptByExamAndStudent(examId, studentId)
    if (!attempt) {
      attempt = await attemptsSql.createOrGetReadinessAttempt(examId, studentId)
    }

    return attempt
  }

  async startAttempt(examId, studentId) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    let attempt = await attemptsSql.findAttemptByExamAndStudent(examId, studentId)
    if (!attempt) {
      attempt = await attemptsSql.createOrGetReadinessAttempt(examId, studentId)
    }

    if (['SUBMITTED', 'TIMED_OUT'].includes(attempt.status)) {
      const err = new Error('Attempt is already finalized')
      err.status = 409
      throw err
    }

    if (attempt.status === 'NOT_STARTED') {
      attempt = await attemptsSql.startAttempt(attempt.id, exam.duration)
    }

    const questions = await examsSql.getQuestionsByExamId(examId, false)
    const answers = await attemptsSql.getAttemptAnswers(attempt.id)

    return {
      attempt,
      exam,
      questions,
      answers: answers || []
    }
  }

  async getAttemptState(attemptId, userId, role) {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) {
      const err = new Error('Attempt not found')
      err.status = 404
      throw err
    }

    if (normalizeRole(role) === ROLES.STUDENT && attempt.studentId !== userId) {
      const err = new Error('Access denied to this attempt')
      err.status = 403
      throw err
    }

    const answers = await attemptsSql.getAttemptAnswers(attemptId)
    return { attempt, answers: answers || [] }
  }

  async saveAnswer(attemptId, studentId, questionId, selectedOptionIndex, isBookmarked) {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) {
      const err = new Error('Attempt not found')
      err.status = 404
      throw err
    }

    if (attempt.studentId !== studentId) {
      const err = new Error('Unauthorized attempt mutation')
      err.status = 403
      throw err
    }

    if (attempt.status !== 'IN_PROGRESS') {
      const err = new Error(`Attempt is not active (current status: ${attempt.status})`)
      err.status = 409
      throw err
    }

    if (attempt.expiresAt && new Date() > new Date(attempt.expiresAt)) {
      await attemptsSql.updateAttemptStatus(attemptId, 'TIMED_OUT')
      const err = new Error('Exam attempt duration has expired')
      err.status = 410
      throw err
    }

    return attemptsSql.upsertAnswer(attemptId, questionId, selectedOptionIndex, isBookmarked)
  }

  async batchSaveAnswers(attemptId, studentId, answersInput = []) {
    let list = []
    if (Array.isArray(answersInput)) {
      list = answersInput
    } else if (answersInput && typeof answersInput === 'object') {
      list = Object.entries(answersInput).map(([qId, val]) => ({
        questionId: qId,
        selectedOptionIndex: typeof val === 'object' ? val?.selectedOptionIndex : val,
        isBookmarked: typeof val === 'object' ? Boolean(val?.isBookmarked) : false
      }))
    }
    const results = []
    for (const item of list) {
      if (item && item.questionId) {
        const res = await this.saveAnswer(attemptId, studentId, item.questionId, item.selectedOptionIndex, item.isBookmarked)
        results.push(res)
      }
    }
    return results
  }

  async submitAttempt(attemptId, studentId) {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) {
      const err = new Error('Attempt not found')
      err.status = 404
      throw err
    }

    if (attempt.studentId !== studentId) {
      const err = new Error('Unauthorized attempt submission')
      err.status = 403
      throw err
    }

    if (attempt.status === 'SUBMITTED') {
      return { attempt, alreadySubmitted: true }
    }

    const gradedAttempt = await attemptsSql.submitAndGradeAttempt(attemptId)

    try {
      socketEmitter.emitToInvigilators(gradedAttempt.examId, 'student:submitted', {
        attemptId,
        studentId,
        score: gradedAttempt.score
      })
    } catch (_) {}

    return { attempt: gradedAttempt, alreadySubmitted: false }
  }

  async suspendAttempt(attemptId, invigilatorId, reason = 'Administrative suspension') {
    const updated = await attemptsSql.updateAttemptStatus(attemptId, 'SUSPENDED')
    try {
      socketEmitter.emitToAttempt(attemptId, 'attempt:suspended', { reason, by: invigilatorId })
    } catch (_) {}
    return updated
  }

  async resumeAttempt(attemptId, invigilatorId) {
    const updated = await attemptsSql.updateAttemptStatus(attemptId, 'IN_PROGRESS')
    try {
      socketEmitter.emitToAttempt(attemptId, 'attempt:resumed', { by: invigilatorId })
    } catch (_) {}
    return updated
  }
}

const ATTEMPT_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  SUSPENDED: 'SUSPENDED',
  TIMED_OUT: 'TIMED_OUT'
})

const TERMINAL_STATES = Object.freeze(['SUBMITTED', 'TIMED_OUT'])

const ALLOWED_TRANSITIONS = Object.freeze({
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUSPENDED', 'SUBMITTED', 'TIMED_OUT'],
  SUSPENDED: ['IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT'],
  SUBMITTED: [],
  TIMED_OUT: []
})

const attemptService = new AttemptService()
module.exports = {
  attemptService,
  AttemptService,
  ATTEMPT_STATUS,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS
}
