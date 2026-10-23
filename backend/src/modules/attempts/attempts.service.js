const attemptsSql = require('./attempts.sql')
const examsSql = require('../exams/exams.sql')
const { prisma } = require('../../infra/postgres/client')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { ROLES, normalizeRole } = require('../../shared/roles')
const { logger } = require('../../shared/logging')
const { ATTEMPT_STATUS, TERMINAL_STATES, ALLOWED_TRANSITIONS } = require('./attempts.constants')

function httpErr(msg, status = 400, code = null) {
  const err = new Error(msg)
  err.status = status
  if (code) err.code = code
  return err
}

class AttemptService {
  async getReadiness(examId, studentId) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) throw httpErr('Exam not found', 404)
    if (['ENDED', 'EVALUATED'].includes(exam.status)) throw httpErr('Exam session has closed', 403)

    let attempt = await attemptsSql.findAttemptByExamAndStudent(examId, studentId)
    if (!attempt) attempt = await attemptsSql.createOrGetReadinessAttempt(examId, studentId)
    return attempt
  }

  async startAttempt(examId, studentId) {
    const exam = await examsSql.findExamById(examId)
    if (!exam) throw httpErr('Exam not found', 404)

    const now = new Date()
    if (exam.startTime && now < new Date(exam.startTime)) throw httpErr('Exam is not open yet', 403, 'EXAM_NOT_OPEN')
    if (exam.endTime && now > new Date(exam.endTime)) throw httpErr('Exam window has ended', 403, 'EXAM_ENDED')

    let attempt = await attemptsSql.findAttemptByExamAndStudent(examId, studentId)
    if (!attempt) attempt = await attemptsSql.createOrGetReadinessAttempt(examId, studentId)

    if (['SUBMITTED', 'TIMED_OUT'].includes(attempt.status)) {
      throw httpErr('Attempt is already finalized', 409, 'ATTEMPT_ALREADY_FINALIZED')
    }

    if (attempt.status === 'NOT_STARTED') {
      attempt = await attemptsSql.startAttempt(attempt.id, exam.duration || exam.durationMinutes, exam.endTime)
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
    let attempt = await attemptsSql.findAttemptById(attemptId)
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

    if (attempt.status === 'IN_PROGRESS' && attempt.expiresAt && new Date() > new Date(attempt.expiresAt)) {
      await attemptsSql.submitAndGradeAttempt(attemptId)
      attempt = await prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: 'TIMED_OUT' },
        include: { exam: true }
      })
    }

    const answers = await attemptsSql.getAttemptAnswers(attemptId)
    return { attempt, answers: answers || [] }
  }

  async saveAnswer(attemptId, studentId, questionId, selectedOptionIndex, isBookmarked) {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) {
      throw httpErr('Attempt not found', 404)
    }

    if (attempt.studentId !== studentId) {
      throw httpErr('Unauthorized attempt mutation', 403)
    }

    if (attempt.violationCount >= 3) {
      throw httpErr('Attempt has been terminated due to excessive violations.', 409, 'ATTEMPT_TERMINATED')
    }

    if (attempt.status === 'SUSPENDED') {
      throw httpErr('Exam attempt is suspended by invigilator.', 409, 'ATTEMPT_SUSPENDED')
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw httpErr(`Attempt is not active (current status: ${attempt.status})`, 409, 'ATTEMPT_NOT_ACTIVE')
    }

    if (attempt.expiresAt && new Date() > new Date(attempt.expiresAt)) {
      await attemptsSql.updateAttemptStatus(attemptId, 'TIMED_OUT')
      throw httpErr('Exam attempt duration has expired', 409, 'ATTEMPT_EXPIRED')
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
      throw httpErr('Attempt not found', 404)
    }

    if (attempt.studentId !== studentId) {
      throw httpErr('Unauthorized attempt submission', 403)
    }

    if (attempt.status === 'SUSPENDED') {
      throw httpErr('Cannot submit a suspended attempt.', 409, 'ATTEMPT_SUSPENDED')
    }

    if (attempt.status === 'SUBMITTED' || attempt.status === 'TIMED_OUT') {
      return { attempt, alreadySubmitted: true }
    }

    const claimed = await prisma.examAttempt.updateMany({
      where: { id: attemptId, status: { not: 'SUBMITTED' } },
      data: { status: 'SUBMITTED' }
    })

    if (claimed.count === 0) {
      const latest = await attemptsSql.findAttemptById(attemptId)
      return { attempt: latest, alreadySubmitted: true }
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
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) throw httpErr('Attempt not found', 404)

    if (['SUBMITTED', 'TIMED_OUT'].includes(attempt.status) || attempt.violationCount >= 3) {
      throw httpErr('Cannot modify a finalized exam attempt.', 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw httpErr(`Attempt cannot be suspended from status ${attempt.status}`, 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    const updated = await attemptsSql.updateAttemptStatus(attemptId, 'SUSPENDED')
    try {
      socketEmitter.emitToAttempt(attemptId, 'attempt:suspended', { reason, by: invigilatorId })
    } catch (_) {}
    return updated
  }

  async resumeAttempt(attemptId, invigilatorId) {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) throw httpErr('Attempt not found', 404)

    if (['SUBMITTED', 'TIMED_OUT'].includes(attempt.status) || attempt.violationCount >= 3) {
      throw httpErr('Cannot modify a finalized exam attempt.', 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    if (attempt.status !== 'SUSPENDED') {
      throw httpErr(`Attempt cannot be resumed from status ${attempt.status}`, 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    const exam = await examsSql.findExamById(attempt.examId)
    const serverNow = new Date()
    if (exam && exam.endTime && serverNow >= new Date(exam.endTime)) {
      throw httpErr('Cannot resume attempt after exam end time.', 409, 'EXAM_ENDED')
    }

    const updated = await attemptsSql.updateAttemptStatus(attemptId, 'IN_PROGRESS')
    try {
      socketEmitter.emitToAttempt(attemptId, 'attempt:resumed', { by: invigilatorId })
    } catch (_) {}
    return updated
  }

  async terminateAttempt(attemptId, invigilatorId, reason = 'Invigilator termination') {
    const attempt = await attemptsSql.findAttemptById(attemptId)
    if (!attempt) throw httpErr('Attempt not found', 404)

    if (['SUBMITTED', 'TIMED_OUT'].includes(attempt.status)) {
      throw httpErr('Cannot modify a finalized exam attempt.', 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'SUSPENDED') {
      throw httpErr(`Cannot terminate attempt with status ${attempt.status}`, 409, 'INVALID_ATTEMPT_TRANSITION')
    }

    const graded = await attemptsSql.submitAndGradeAttempt(attemptId)
    try {
      socketEmitter.emitToAttempt(attemptId, 'attempt:terminated', { reason, by: invigilatorId, attemptId })
      socketEmitter.emitToInvigilators(attempt.examId, 'student:terminated', { attemptId, studentId: attempt.studentId, by: invigilatorId })
    } catch (_) {}
    return graded || attempt
  }

  async autoSubmitExpiredAttempts() {
    const expired = await prisma.examAttempt.findMany({
      where: {
        status: 'IN_PROGRESS',
        expiresAt: { lt: new Date() }
      },
      select: { id: true, studentId: true, examId: true }
    })

    const results = []
    for (const att of expired) {
      try {
        const graded = await attemptsSql.submitAndGradeAttempt(att.id)
        await prisma.examAttempt.update({
          where: { id: att.id },
          data: { status: 'TIMED_OUT' }
        })
        try {
          socketEmitter.emitToInvigilators(att.examId, 'student:auto_submitted', {
            attemptId: att.id,
            studentId: att.studentId,
            score: graded.score
          })
        } catch (_) {}
        results.push({ id: att.id, score: graded.score })
      } catch (e) {
        logger.error({ attemptId: att.id, err: e.message }, 'Failed to auto-submit expired attempt')
      }
    }
    return results
  }
}

const attemptService = new AttemptService()

// Background Expiration Worker: checks every 10s for expired attempts
const expirationInterval = setInterval(() => {
  attemptService.autoSubmitExpiredAttempts().catch(() => {})
}, 10000)
if (expirationInterval.unref) expirationInterval.unref()

module.exports = {
  attemptService,
  AttemptService,
  ATTEMPT_STATUS,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS
}
