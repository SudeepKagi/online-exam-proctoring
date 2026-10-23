'use strict'

const attemptsSql = require('./attempts.sql')
const examsSql = require('../exams/exams.sql')
const { prisma } = require('../../infra/postgres/client')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { logger } = require('../../shared/logging')

function httpErr(msg, status = 400, code = null) {
  const err = new Error(msg)
  err.status = status
  if (code) err.code = code
  return err
}

async function suspendAttempt(attemptId, invigilatorId, reason = 'Administrative suspension') {
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

async function resumeAttempt(attemptId, invigilatorId) {
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

async function terminateAttempt(attemptId, invigilatorId, reason = 'Invigilator termination') {
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

async function autoSubmitExpiredAttempts() {
  const expired = await prisma.examAttempt.findMany({
    where: { status: 'IN_PROGRESS', expiresAt: { lt: new Date() } },
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

module.exports = {
  suspendAttempt,
  resumeAttempt,
  terminateAttempt,
  autoSubmitExpiredAttempts
}
