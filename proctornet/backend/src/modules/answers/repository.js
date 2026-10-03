const { prisma } = require('../../infra/postgres/client')

class AnswerRepository {
  /**
   * Single-statement revision-protected autosave with guarded CTE
   */
  async saveAnswer(attemptId, studentId, attemptQuestionId, selectedOptionId, expectedRevision) {
    const sql = `
      WITH guard AS (
        SELECT aq.id AS attempt_question_id, a.id AS attempt_id
        FROM exam_attempts a
        JOIN attempt_questions aq ON aq.attempt_id = a.id
        WHERE a.id = $1::uuid
          AND a.student_id = $2::uuid
          AND a.status = 'ACTIVE'
          AND a.expires_at > now()
          AND aq.id = $3::uuid
          AND ($4::uuid IS NULL OR EXISTS (
            SELECT 1 FROM question_options o
            WHERE o.id = $4::uuid AND o.question_id = aq.question_id
          ))
      )
      INSERT INTO answers (id, attempt_id, attempt_question_id, selected_option_id, revision, saved_at)
      SELECT gen_random_uuid(), attempt_id, attempt_question_id, $4::uuid, 1, now()
      FROM guard
      ON CONFLICT (attempt_question_id) DO UPDATE
        SET selected_option_id = EXCLUDED.selected_option_id,
            revision = answers.revision + 1,
            saved_at = now()
        WHERE answers.revision = $5::int
      RETURNING answers.revision;
    `

    const rows = await prisma.$queryRawUnsafe(
      sql,
      attemptId,
      studentId,
      attemptQuestionId,
      selectedOptionId,
      expectedRevision
    )

    return rows && rows.length > 0 ? rows[0].revision : null
  }

  /**
   * Diagnostic query executed ONLY when saveAnswer returns 0 rows (single round-trip diagnosis)
   */
  async diagnoseSaveFailure(attemptId, studentId, attemptQuestionId, selectedOptionId, expectedRevision) {
    const sql = `
      SELECT
        a.id AS attempt_id,
        a.student_id,
        a.status,
        a.expires_at,
        (a.expires_at <= now()) AS is_expired,
        aq.id AS question_exists,
        aq.question_id,
        ans.revision AS current_revision,
        CASE
          WHEN $4::uuid IS NULL THEN true
          ELSE EXISTS (
            SELECT 1 FROM question_options o
            WHERE o.id = $4::uuid AND o.question_id = aq.question_id
          )
        END AS valid_option
      FROM exam_attempts a
      LEFT JOIN attempt_questions aq ON aq.attempt_id = a.id AND aq.id = $3::uuid
      LEFT JOIN answers ans ON ans.attempt_question_id = aq.id
      WHERE a.id = $1::uuid;
    `
    const rows = await prisma.$queryRawUnsafe(
      sql,
      attemptId,
      studentId,
      attemptQuestionId,
      selectedOptionId
    )

    if (!rows || rows.length === 0) {
      return { failure: 'NOT_FOUND', message: `Attempt '${attemptId}' not found` }
    }

    const diag = rows[0]

    // Ownership check (BOLA)
    if (diag.student_id !== studentId) {
      return { failure: 'FORBIDDEN', message: 'You do not own this attempt' }
    }

    // Status check
    if (diag.status !== 'ACTIVE') {
      return { failure: 'INVALID_STATE', message: `Attempt is in state '${diag.status}', not ACTIVE`, currentStatus: diag.status }
    }

    // Deadline check
    if (diag.is_expired) {
      return { failure: 'EXPIRED', message: 'Exam attempt time has expired', expiresAt: diag.expires_at }
    }

    // Question existence check
    if (!diag.question_exists) {
      return { failure: 'QUESTION_NOT_FOUND', message: `Question '${attemptQuestionId}' does not belong to this attempt` }
    }

    // Option validity check
    if (!diag.valid_option) {
      return { failure: 'INVALID_OPTION', message: `Option '${selectedOptionId}' is not valid for this question` }
    }

    // Stale revision check
    if (diag.current_revision !== null && diag.current_revision !== expectedRevision) {
      return {
        failure: 'STALE_REVISION',
        message: `Stale answer revision: expected ${expectedRevision}, current is ${diag.current_revision}`,
        currentRevision: diag.current_revision,
        expectedRevision
      }
    }

    return { failure: 'UNKNOWN', message: 'Autosave condition check failed' }
  }

  /**
   * Batch save dirty answers (<= 100 items) using unnest
   */
  async saveBatchAnswers(attemptId, studentId, items) {
    if (!items || items.length === 0) return []

    const qIds = items.map(i => i.attemptQuestionId)
    const optIds = items.map(i => i.optionId || null)
    const revs = items.map(i => i.revision)

    const sql = `
      WITH input AS (
        SELECT * FROM unnest(
          $3::uuid[],
          $4::uuid[],
          $5::int[]
        ) AS t(attempt_question_id, selected_option_id, expected_revision)
      ),
      guard AS (
        SELECT
          i.attempt_question_id,
          a.id AS attempt_id,
          i.selected_option_id,
          i.expected_revision
        FROM input i
        JOIN attempt_questions aq ON aq.id = i.attempt_question_id
        JOIN exam_attempts a ON a.id = aq.attempt_id
        WHERE a.id = $1::uuid
          AND a.student_id = $2::uuid
          AND a.status = 'ACTIVE'
          AND a.expires_at > now()
          AND (i.selected_option_id IS NULL OR EXISTS (
            SELECT 1 FROM question_options o
            WHERE o.id = i.selected_option_id AND o.question_id = aq.question_id
          ))
      )
      INSERT INTO answers (id, attempt_id, attempt_question_id, selected_option_id, revision, saved_at)
      SELECT gen_random_uuid(), g.attempt_id, g.attempt_question_id, g.selected_option_id, 1, now()
      FROM guard g
      ON CONFLICT (attempt_question_id) DO UPDATE
        SET selected_option_id = EXCLUDED.selected_option_id,
            revision = answers.revision + 1,
            saved_at = now()
        WHERE answers.revision = (
          SELECT g2.expected_revision FROM guard g2
          WHERE g2.attempt_question_id = answers.attempt_question_id
        )
      RETURNING answers.attempt_question_id, answers.revision;
    `

    const updatedRows = await prisma.$queryRawUnsafe(
      sql,
      attemptId,
      studentId,
      qIds,
      optIds,
      revs
    )

    const updatedMap = new Map((updatedRows || []).map(r => [r.attempt_question_id, r.revision]))

    // Construct per-item results
    const results = []
    for (const item of items) {
      if (updatedMap.has(item.attemptQuestionId)) {
        results.push({
          attemptQuestionId: item.attemptQuestionId,
          success: true,
          revision: updatedMap.get(item.attemptQuestionId)
        })
      } else {
        // Individual diagnostic for failed item
        const diag = await this.diagnoseSaveFailure(
          attemptId,
          studentId,
          item.attemptQuestionId,
          item.optionId,
          item.revision
        )
        results.push({
          attemptQuestionId: item.attemptQuestionId,
          success: false,
          error: diag
        })
      }
    }

    return results
  }
}

module.exports = {
  AnswerRepository,
  answerRepository: new AnswerRepository()
}
