const crypto = require('crypto')
const { submissionRepository } = require('./repository')
const { toSubmissionResponseDTO } = require('./dto')
const { logger } = require('../../shared/logging')

class SubmissionService {
  /**
   * Submit exam attempt with idempotency key and outbox event (Kills B-03/B-13)
   */
  async submitAttempt(attemptId, studentId, idempotencyKey, finalAnswers = []) {
    // 1. Idempotency Key check (Fast replay)
    const existing = await submissionRepository.findIdempotentResponse(idempotencyKey)
    if (existing) {
      logger.info({ attemptId, idempotencyKey }, 'Returning idempotent replay for exam submit')
      return existing.body
    }

    const requestHash = crypto
      .createHash('sha256')
      .update(`${studentId}:${attemptId}:${idempotencyKey}`)
      .digest('hex')

    const submitGraceSeconds = parseInt(process.env.SUBMIT_GRACE_SECONDS || '10', 10)

    // 2. Execute transactional submit with row locking
    const result = await submissionRepository.submitAttemptTransaction(
      attemptId,
      studentId,
      idempotencyKey,
      requestHash,
      finalAnswers,
      submitGraceSeconds
    )

    const response = toSubmissionResponseDTO(result.attempt, result.alreadySubmitted)

    // 3. Best-effort WS notify outside transaction
    try {
      if (global.io) {
        global.io.to(`exam:${result.attempt.exam_id || result.attempt.examId}`).emit('student:submitted', {
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
