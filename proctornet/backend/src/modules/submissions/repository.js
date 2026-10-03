const { prisma, withTransaction } = require('../../infra/postgres/client')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  GoneError
} = require('../../shared/errors')
const { answerRepository } = require('../answers/repository')

class SubmissionRepository {
  /**
   * Check for previously stored idempotent response
   */
  async findIdempotentResponse(key) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT response_status, response_body
      FROM idempotency_keys
      WHERE key = $1 AND expires_at > now();
    `, key)

    if (rows && rows.length > 0) {
      return {
        status: rows[0].response_status,
        body: rows[0].response_body
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
        FROM exam_attempts
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

      // Check terminal states
      if (['TERMINATED', 'EXPIRED', 'TIMED_OUT'].includes(attempt.status)) {
        throw new ConflictError(
          `Cannot submit attempt: attempt is already in terminal state '${attempt.status}'`,
          'ATTEMPT_TERMINATED',
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

      // 3. Flush optional final dirty answers (answers hard-cut at expires_at)
      if (finalAnswers && finalAnswers.length > 0) {
        await answerRepository.saveBatchAnswers(attemptId, studentId, finalAnswers)
      }

      // 4. Update status to SUBMITTED
      const updatedRows = await tx.$queryRawUnsafe(`
        UPDATE exam_attempts
        SET status = 'SUBMITTED',
            submitted_at = now()
        WHERE id = $1::uuid
        RETURNING *;
      `, attemptId)

      const updated = updatedRows[0]

      const responsePayload = {
        status: 'SUBMITTED',
        submittedAt: updated.submitted_at,
        alreadySubmitted: false
      }

      // 5. Insert outbox event for async evaluation worker
      await tx.$executeRawUnsafe(`
        INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
        VALUES ('attempt.submitted', $1::jsonb, 'PENDING', now());
      `, JSON.stringify({
        attemptId: updated.id,
        examId: updated.exam_id,
        studentId: updated.student_id,
        submittedAt: updated.submitted_at
      }))

      // 6. Record idempotency key in the SAME transaction
      await tx.$executeRawUnsafe(`
        INSERT INTO idempotency_keys (key, request_hash, response_status, response_body, expires_at, created_at)
        VALUES ($1, $2, 200, $3::jsonb, now() + interval '24 hours', now())
        ON CONFLICT (key) DO NOTHING;
      `, idempotencyKey, requestHash, JSON.stringify(responsePayload))

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
