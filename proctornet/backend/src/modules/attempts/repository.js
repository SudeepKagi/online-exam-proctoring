const { prisma } = require('../../infra/postgres/client')
const { SQL_ELIGIBILITY_WHERE } = require('../exams/eligibility')
const { EXAM_CLOCK_CONFIG } = require('../exams/examClock')
const crypto = require('crypto')

class AttemptRepository {
  /**
   * Atomic start-or-resume attempt in SQL
   * 1 round trip: updates READY -> ACTIVE returning the row.
   */
  async activateReadyAttempt(examId, studentId) {
    const graceSeconds = EXAM_CLOCK_CONFIG.endGrace
    const sql = `
      WITH updated_attempt AS (
        UPDATE exam_attempts ea
        SET status = 'ACTIVE',
            status_reason = 'Guarded start',
            started_at = now(),
            expires_at = LEAST(
              now() + (e.duration || ' minutes')::interval,
              e.end_time + ($3 || ' seconds')::interval
            )
        FROM exams e
        WHERE ea.exam_id = e.id
          AND ea.exam_id = $1::uuid
          AND ea.student_id = $2::uuid
          AND ea.status = 'READY'
          AND (
            e.device_agent_policy != 'REQUIRED'
            OR EXISTS (
              SELECT 1 FROM device_agent_waivers daw WHERE daw.attempt_id = ea.id
            )
            OR EXISTS (
              SELECT 1 FROM agent_sessions ags
              WHERE ags.attempt_id = ea.id
                AND ags.state = 'HEALTHY'
                AND NOT EXISTS (
                  SELECT 1 FROM agent_findings agf
                  JOIN agent_rules agr ON agr.id = agf.rule_id
                  WHERE agf.session_id = ags.id
                    AND agf.cleared_at IS NULL
                    AND agr.action = 'BLOCK_START'
                )
            )
          )
        RETURNING ea.*
      ),
      inserted_audit AS (
        INSERT INTO audit_logs (attempt_id, actor_role, action, metadata, timestamp)
        SELECT 
          ua.id, 
          'student', 
          'ATTEMPT_STATE_CHANGE_ACTIVE', 
          '{"from":"READY","to":"ACTIVE","guarded":true}'::jsonb, 
          now()
        FROM updated_attempt ua
        RETURNING id
      )
      SELECT * FROM updated_attempt;
    `
    const rows = await prisma.$queryRawUnsafe(sql, examId, studentId, graceSeconds.toString())
    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Find attempt by exam ID and student ID
   */
  async findByExamAndStudent(examId, studentId) {
    return prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId
        }
      },
      include: {
        exam: true
      }
    })
  }

  /**
   * Find attempt by ID (with student and exam relations)
   */
  async findById(attemptId) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        student: true
      }
    })
  }

  /**
   * Create an on-demand attempt for late joiners
   */
  async createOnDemandAttempt(examId, studentId, exam, questions) {
    return this.createReadyAttempt(examId, studentId, exam, questions)
  }


  /**
   * Create an idempotent READY attempt for pre-check readiness (never starts the clock)
   */
  async createReadyAttempt(examId, studentId, exam, questions) {
    return prisma.$transaction(async (tx) => {
      // 1. Double check attempt existence with lock
      const existing = await tx.examAttempt.findUnique({
        where: { examId_studentId: { examId, studentId } },
        include: { exam: true }
      })
      if (existing) return existing

      const shuffleSeed = crypto.randomBytes(16).toString('hex')
      const watermarkSeed = crypto.randomBytes(8).toString('hex')

      // Insert attempt with READY status (never starts clock)
      const createdRows = await tx.$queryRawUnsafe(`
        INSERT INTO exam_attempts (
          id, exam_id, student_id, status, started_at, expires_at,
          watermark_seed, shuffle_seed, created_at
        )
        VALUES (
          gen_random_uuid(), $1::uuid, $2::uuid, 'READY', null, null,
          $3, $4, now()
        )
        ON CONFLICT (exam_id, student_id) DO NOTHING
        RETURNING *;
      `, examId, studentId, watermarkSeed, shuffleSeed)

      let attempt = createdRows && createdRows.length > 0 ? createdRows[0] : null
      if (!attempt) {
        return tx.examAttempt.findUnique({
          where: { examId_studentId: { examId, studentId } },
          include: { exam: true }
        })
      }

      // Generate shuffled attempt questions
      if (questions && questions.length > 0) {
        const rng = createSeededRng(shuffleSeed)
        const shuffledQuestions = [...questions]
        shuffleArray(shuffledQuestions, rng)

        const selectedQuestions = (exam.questionsPerStudent > 0 && exam.questionsPerStudent < shuffledQuestions.length)
          ? shuffledQuestions.slice(0, exam.questionsPerStudent)
          : shuffledQuestions

        if (selectedQuestions.length > 0) {
          const valuePlaceholders = []
          const params = [attempt.id]
          let paramIdx = 2

          for (let i = 0; i < selectedQuestions.length; i++) {
            const q = selectedQuestions[i]
            const optionOrder = (q.options || []).map((_, idx) => idx)
            if (exam.randomiseOptions) {
              shuffleArray(optionOrder, rng)
            }

            valuePlaceholders.push(`(gen_random_uuid(), $1::uuid, $${paramIdx}::uuid, $${paramIdx + 1}, $${paramIdx + 2}::smallint[])`)
            params.push(q.id, i + 1, optionOrder)
            paramIdx += 3
          }

          const sql = `
            INSERT INTO attempt_questions (id, attempt_id, question_id, display_order, option_order)
            VALUES ${valuePlaceholders.join(',\n')}
            ON CONFLICT (attempt_id, question_id) DO NOTHING;
          `
          await tx.$executeRawUnsafe(sql, ...params)
        }
      }

      attempt.exam = exam
      return attempt
    }, { maxWait: 5000, timeout: 15000 })
  }

  /**
   * Fetch attempt questions with stored answers for student session
   */
  async getAttemptQuestionsWithAnswers(attemptId) {
    const sql = `
      SELECT
        aq.id AS "attemptQuestionId",
        aq.question_id AS "questionId",
        aq.display_order AS "displayOrder",
        aq.option_order AS "optionOrder",
        a.selected_option_id AS "selectedOptionId",
        COALESCE(a.revision, 0) AS revision
      FROM attempt_questions aq
      LEFT JOIN answers a ON a.attempt_question_id = aq.id
      WHERE aq.attempt_id = $1::uuid
      ORDER BY aq.display_order ASC;
    `
    return prisma.$queryRawUnsafe(sql, attemptId)
  }

  /**
   * Query raw questions for exam content caching (no answers or correctness)
   */
  async getExamQuestionsForCache(examId) {
    return prisma.question.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        questionText: true,
        imageKey: true,
        marks: true,
        negativeMarks: true,
        difficulty: true,
        options: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            order: true
            // Invariant: isCorrect is deliberately EXCLUDED
          }
        }
      }
    })
  }

  /**
   * Check student eligibility using SQL array operators matching GIN indexes
   */
  async checkStudentEligibility(examId, studentId) {
    const sql = `
      SELECT s.id, s.usn, s.department_code, s.semester,
             e.id AS exam_id, e.status AS exam_status, e.start_time, e.end_time, e.duration
      FROM students s
      JOIN exams e ON e.id = $1::uuid
      WHERE s.id = $2::uuid
        AND ${SQL_ELIGIBILITY_WHERE};
    `
    const rows = await prisma.$queryRawUnsafe(sql, examId, studentId)
    return rows && rows.length > 0 ? rows[0] : null
  }
}

/**
 * Deterministic pseudo-random generator seeded from string for Fisher-Yates
 */
function createSeededRng(seedStr) {
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0
  }
  return function () {
    hash = Math.imul(48271, hash) % 2147483647
    return (hash & 2147483647) / 2147483647
  }
}

function shuffleArray(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

module.exports = {
  AttemptRepository,
  attemptRepository: new AttemptRepository(),
  createSeededRng,
  shuffleArray
}
