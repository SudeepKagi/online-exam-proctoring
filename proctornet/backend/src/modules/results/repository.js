const { prisma } = require('../../infra/postgres/client')

class ResultRepository {
  /**
   * Set-based idempotent evaluation of an exam attempt (Section 4.7 / C-07)
   * - Evaluates ONLY for terminal statuses: SUBMITTED | EXPIRED | TERMINATED
   * - Preserves negative scores when negative marking is enabled
   */
  async evaluateAttemptSetBased(attemptId) {
    const sql = `
      INSERT INTO exam_results (
        id, attempt_id, exam_id, score, total_marks, correct_count, wrong_count,
        unanswered_count, percentage, time_taken, flag_count, status, is_released, created_at
      )
      SELECT
        gen_random_uuid(),
        s.attempt_id,
        s.exam_id,
        CASE
          WHEN s.negative_marking = true THEN s.calculated_score
          ELSE GREATEST(0, s.calculated_score)
        END,
        s.total_marks,
        s.correct_count,
        s.wrong_count,
        s.unanswered_count,
        CASE
          WHEN s.total_marks > 0 THEN
            ROUND((
              (CASE WHEN s.negative_marking = true THEN s.calculated_score ELSE GREATEST(0, s.calculated_score) END)::numeric
              / s.total_marks::numeric
            ) * 100, 2)
          ELSE 0
        END,
        s.time_taken,
        s.flag_count,
        CASE
          WHEN s.flag_count >= 5 THEN 'FLAGGED'::"ResultStatus"
          ELSE 'CLEAN'::"ResultStatus"
        END,
        s.results_released,
        now()
      FROM (
        SELECT
          at.id AS attempt_id,
          at.exam_id,
          at.flag_count,
          e.negative_marking,
          e.results_released,
          COALESCE(SUM(q.marks), 0) AS total_marks,
          COUNT(aq.id) FILTER (WHERE o.is_correct = true) AS correct_count,
          COUNT(aq.id) FILTER (WHERE a.selected_option_id IS NOT NULL AND (o.is_correct IS NULL OR o.is_correct = false)) AS wrong_count,
          COUNT(aq.id) FILTER (WHERE a.selected_option_id IS NULL) AS unanswered_count,
          SUM(CASE
            WHEN o.is_correct = true THEN q.marks
            WHEN a.selected_option_id IS NOT NULL AND (o.is_correct IS NULL OR o.is_correct = false) AND e.negative_marking = true
              THEN -COALESCE(NULLIF(q.negative_marks, 0), e.negative_value, 0)
            ELSE 0
          END) AS calculated_score,
          GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(at.submitted_at, now()) - COALESCE(at.started_at, now())))::int) AS time_taken
        FROM exam_attempts at
        JOIN exams e ON e.id = at.exam_id
        JOIN attempt_questions aq ON aq.attempt_id = at.id
        JOIN questions q ON q.id = aq.question_id
        LEFT JOIN answers a ON a.attempt_question_id = aq.id
        LEFT JOIN question_options o ON o.id = a.selected_option_id
        WHERE at.id = $1::uuid
          AND at.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
        GROUP BY at.id, at.exam_id, at.flag_count, e.negative_marking, e.results_released, e.negative_value, at.submitted_at, at.started_at
      ) s
      ON CONFLICT (attempt_id) DO NOTHING
      RETURNING *;
    `

    const rows = await prisma.$queryRawUnsafe(sql, attemptId)
    if (rows && rows.length > 0) {
      return rows[0]
    }

    // Attempt already evaluated: read existing result
    return prisma.examResult.findUnique({
      where: { attemptId }
    })
  }

  /**
   * Create ABSENT / NOT_STARTED results for attempts that never started when exam ends (C-07)
   */
  async createAbsentResultsForEndedExam(examId) {
    const insertSql = `
      INSERT INTO exam_results (
        id, attempt_id, exam_id, score, total_marks, correct_count, wrong_count,
        unanswered_count, percentage, time_taken, flag_count, status, is_released, created_at
      )
      SELECT
        gen_random_uuid(),
        ea.id,
        ea.exam_id,
        0,
        COALESCE(e.total_marks, 0),
        0,
        0,
        (SELECT COUNT(*)::int FROM attempt_questions WHERE attempt_id = ea.id),
        0,
        0,
        ea.flag_count,
        'CLEAN'::"ResultStatus",
        e.results_released,
        now()
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.exam_id = $1::uuid
        AND ea.status = 'READY'
      ON CONFLICT (attempt_id) DO NOTHING
      RETURNING *;
    `

    const rows = await prisma.$queryRawUnsafe(insertSql, examId)

    // Mark those attempts as EXPIRED with status_reason = 'NOT_STARTED'
    await prisma.$executeRawUnsafe(`
      UPDATE exam_attempts
      SET status = 'EXPIRED',
          status_reason = 'NOT_STARTED'
      WHERE exam_id = $1::uuid
        AND status = 'READY';
    `, examId)

    return rows
  }

  /**
   * Lazily calculate / refresh ranks for an exam using window function
   */
  async updateRanksForExam(examId) {
    const sql = `
      WITH ranked AS (
        SELECT id, RANK() OVER (ORDER BY score DESC, time_taken ASC) as computed_rank
        FROM exam_results
        WHERE exam_id = $1::uuid
      )
      UPDATE exam_results er
      SET rank = ranked.computed_rank
      FROM ranked
      WHERE er.id = ranked.id;
    `
    await prisma.$executeRawUnsafe(sql, examId)
  }

  async findByAttempt(attemptId) {
    return prisma.examResult.findUnique({
      where: { attemptId },
      include: {
        exam: true,
        attempt: {
          include: { student: true }
        }
      }
    })
  }

  async findByExam(examId) {
    return prisma.examResult.findMany({
      where: { examId },
      include: {
        attempt: {
          include: { student: true }
        }
      },
      orderBy: [
        { score: 'desc' },
        { timeTaken: 'asc' }
      ]
    })
  }
}

module.exports = {
  ResultRepository,
  resultRepository: new ResultRepository()
}
