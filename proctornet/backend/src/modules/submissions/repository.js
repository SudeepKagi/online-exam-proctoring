const { prisma, withTransaction } = require('../../infra/postgres/client')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  GoneError
} = require('../../shared/errors')
const { logger } = require('../../shared/logging')
const { answerRepository } = require('../answers/repository')

class SubmissionRepository {
  /**
   * Check for previously stored idempotent response
   */
  async findIdempotentResponse(key) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT response_status, response_body, request_hash
      FROM public.idempotency_keys
      WHERE key = $1 AND expires_at > now();
    `, key)

    if (rows && rows.length > 0) {
      return {
        status: rows[0].response_status,
        body: rows[0].response_body,
        requestHash: rows[0].request_hash
      }
    }
    return null
  }

  /**
   * Submit exam attempt in a single isolated transaction with row lock
   */
  async submitAttemptTransaction(attemptId, studentId, idempotencyKey, requestHash, finalAnswers = [], submitGraceSeconds = 10) {
    return withTransaction(async (tx) => {
      // 1. Acquire exclusive row lock on exam attempt
      const rows = await tx.$queryRawUnsafe(`
        SELECT id, exam_id, student_id, status, expires_at, submitted_at
        FROM public.exam_attempts
        WHERE id = $1::uuid
        FOR UPDATE;
      `, attemptId)

      if (!rows || rows.length === 0) {
        throw new NotFoundError(`Attempt '${attemptId}' not found`)
      }

      const attempt = rows[0]

      // BOLA check: student must own this attempt
      if (attempt.student_id !== studentId) {
        throw new ForbiddenError('You do not own this attempt')
      }

      // Check if already submitted (idempotent submission replay)
      if (attempt.status === 'SUBMITTED') {
        return {
          alreadySubmitted: true,
          attempt
        }
      }

      // Check terminal and suspended states
      if (['TERMINATED', 'EXPIRED', 'TIMED_OUT'].includes(attempt.status)) {
        throw new ConflictError(
          `Cannot submit attempt: attempt is already in terminal state '${attempt.status}'`,
          'ATTEMPT_TERMINATED',
          { status: attempt.status }
        )
      }

      if (attempt.status === 'SUSPENDED') {
        throw new ForbiddenError(
          'Cannot submit attempt: attempt is currently suspended by proctor',
          'ATTEMPT_SUSPENDED',
          { status: attempt.status }
        )
      }

      // 2. Server deadline enforcement with submit grace window
      if (attempt.expires_at) {
        const graceMs = submitGraceSeconds * 1000
        const deadlineWithGrace = new Date(new Date(attempt.expires_at).getTime() + graceMs)
        if (new Date() > deadlineWithGrace) {
          throw new GoneError('Submission deadline expired (including grace period)')
        }
      }

      // 3. Flush optional final dirty answers (guaranteed save with grace period and force flag)
      if (finalAnswers && finalAnswers.length > 0) {
        try {
          await answerRepository.saveBatchAnswers(attemptId, studentId, finalAnswers, tx, submitGraceSeconds, true)
        } catch (saveErr) {
          logger.warn({ error: saveErr.message, attemptId }, 'Non-blocking final dirty answer save warning during submission')
        }
      }

      // 4. Update status to SUBMITTED
      const updated = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date()
        }
      })

      const responsePayload = {
        status: 'SUBMITTED',
        submittedAt: updated.submittedAt ? updated.submittedAt.toISOString() : new Date().toISOString(),
        alreadySubmitted: false,
        message: 'Exam submitted successfully'
      }

      // 5. Insert outbox event for async evaluation worker
      await tx.outboxEvent.create({
        data: {
          eventType: 'attempt.submitted',
          payload: {
            attemptId: updated.id,
            examId: updated.examId,
            studentId: updated.studentId,
            submittedAt: updated.submittedAt
          },
          status: 'PENDING'
        }
      })

      // 6. Record idempotency key in the SAME transaction
      await tx.idempotencyKey.upsert({
        where: {
          scope_key: {
            scope: 'global',
            key: idempotencyKey
          }
        },
        update: {},
        create: {
          scope: 'global',
          key: idempotencyKey,
          requestHash,
          responseStatus: 200,
          responseBody: responsePayload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      })

      return {
        alreadySubmitted: false,
        attempt: updated
      }
    })
  }
}

module.exports = {
  SubmissionRepository,
  submissionRepository: new SubmissionRepository()
}
