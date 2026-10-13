const crypto = require('crypto')
const { submissionRepository } = require('./repository')
const { toSubmissionResponseDTO } = require('./dto')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { UnprocessableEntityError, ServiceUnavailableError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

class SubmissionService {
  /**
   * Submit exam attempt with composite idempotency key and outbox event (C-11, Kills B-03/B-13)
   */
  async submitAttempt(attemptId, studentId, idempotencyKey, finalAnswers = []) {
    // 1. Composite key + request hash over the payload body (C-11)
    const compositeKey = `submit:${attemptId}:${idempotencyKey}`
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(finalAnswers || []))
      .digest('hex')
    const requestHash = crypto
      .createHash('sha256')
      .update(`${studentId}:${attemptId}:${payloadHash}`)
      .digest('hex')

    // Fast replay check on composite key or naked key
    const existing = (await submissionRepository.findIdempotentResponse(compositeKey)) ||
                     (await submissionRepository.findIdempotentResponse(idempotencyKey))

    if (existing) {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new UnprocessableEntityError(
          'Idempotency key reused with a different request body',
          'IDEMPOTENCY_MISMATCH',
          { idempotencyKey }
        )
      }
      logger.info({ attemptId, idempotencyKey }, 'Returning idempotent replay for exam submit')
      return existing.body
    }

    const { EXAM_CLOCK_CONFIG } = require('../exams/examClock')
    const submitGraceSeconds = EXAM_CLOCK_CONFIG.submitGrace

    // 2. Execute transactional submit with row locking
    let result
    try {
      result = await submissionRepository.submitAttemptTransaction(
        attemptId,
        studentId,
        compositeKey,
        requestHash,
        finalAnswers,
        submitGraceSeconds
      )
    } catch (err) {
      if (
        err.code === 'P2028' ||
        err.code === 'P2034' ||
        err.message?.includes('Unable to start a transaction') ||
        err.message?.includes('could not obtain lock') ||
        err.message?.includes('deadlock detected') ||
        err.message?.includes('Transaction timed out')
      ) {
        throw new ServiceUnavailableError(
          'Database transaction busy under concurrent lock contention, please retry submission',
          2
        )
      }
      throw err
    }

    const response = toSubmissionResponseDTO(result.attempt, result.alreadySubmitted)

    // 3. Best-effort WS notify outside transaction via Redis Emitter (C-06: inv:{examId} only)
    try {
      const examId = result.attempt.exam_id || result.attempt.examId
      if (examId) {
        socketEmitter.emitToInvigilators(examId, 'student:submitted', {
          attemptId: result.attempt.id,
          studentId
        })
      }
    } catch (wsErr) {
      logger.warn({ error: wsErr.message }, 'Failed to send post-submit WS notification')
    }

    return response
  }
}

module.exports = {
  SubmissionService,
  submissionService: new SubmissionService()
}
