const { prisma } = require('../../infra/postgres/client')
const { createSeededRng, shuffleArray } = require('./repository')
const { attemptService } = require('./service')
const { logger } = require('../../shared/logging')
const crypto = require('crypto')

class AttemptPrewarmJob {
  /**
   * Pre-warm READY attempts and question permutations for eligible students
   */
  async prewarmExam(examId) {
    logger.info({ examId }, 'Starting attempt pre-warming job for exam')

    // 1. Fetch exam and questions
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!exam) {
      logger.warn({ examId }, 'Cannot prewarm: Exam not found')
      return { prewarmedCount: 0 }
    }

    if (exam.status === 'DRAFT' || exam.questions.length === 0) {
      logger.warn({ examId, status: exam.status, questionCount: exam.questions.length }, 'Cannot prewarm draft or empty exam')
      return { prewarmedCount: 0 }
    }

    // 2. Pre-warm Redis exam content cache
    await attemptService.getExamContentCached(examId).catch(err => {
      logger.warn({ error: err.message, examId }, 'Failed to populate Redis content cache during prewarm')
    })

    // 3. Find eligible students via GIN-indexed SQL query
    const eligibleStudentsSql = `
      SELECT s.id, s.usn, s.department_code, s.semester
      FROM students s
      JOIN exams e ON e.id = $1::uuid
      WHERE s.is_suspended = false
        AND s.approval_status = 'APPROVED'
        AND (cardinality(e.allowed_departments) = 0 OR s.department_code = ANY(e.allowed_departments))
        AND (cardinality(e.allowed_semesters) = 0 OR s.semester = ANY(e.allowed_semesters))
        AND NOT EXISTS (
          SELECT 1 FROM exam_attempts ea
          WHERE ea.exam_id = e.id AND ea.student_id = s.id
        );
    `
    const eligibleStudents = await prisma.$queryRawUnsafe(eligibleStudentsSql, examId)
    logger.info({ examId, eligibleCount: eligibleStudents.length }, 'Found eligible students for pre-warming')

    if (!eligibleStudents || eligibleStudents.length === 0) {
      return { prewarmedCount: 0 }
    }

    const CHUNK_SIZE = 200
    let totalPrewarmed = 0

    // 4. Process in chunks of 200
    for (let i = 0; i < eligibleStudents.length; i += CHUNK_SIZE) {
      const chunk = eligibleStudents.slice(i, i + CHUNK_SIZE)

      await prisma.$transaction(async (tx) => {
        for (const student of chunk) {
          const shuffleSeed = crypto.randomBytes(16).toString('hex')
          const watermarkSeed = crypto.randomBytes(8).toString('hex')

          // Insert READY attempt row
          const insertAttemptSql = `
            INSERT INTO exam_attempts (
              id, exam_id, student_id, status, watermark_seed, shuffle_seed, created_at
            )
            VALUES (
              gen_random_uuid(), $1::uuid, $2::uuid, 'READY', $3, $4, now()
            )
            ON CONFLICT (exam_id, student_id) DO NOTHING
            RETURNING id;
          `
          const inserted = await tx.$queryRawUnsafe(
            insertAttemptSql,
            examId,
            student.id,
            watermarkSeed,
            shuffleSeed
          )

          if (inserted && inserted.length > 0) {
            const attemptId = inserted[0].id
            totalPrewarmed++

            // Shuffle questions and options with deterministic RNG seeded per attempt
            const rng = createSeededRng(shuffleSeed)
            const questions = [...exam.questions]
            if (exam.randomiseQuestions) {
              shuffleArray(questions, rng)
            }

            const selected = (exam.questionsPerStudent > 0 && exam.questionsPerStudent < questions.length)
              ? questions.slice(0, exam.questionsPerStudent)
              : questions

            for (let qIdx = 0; qIdx < selected.length; qIdx++) {
              const q = selected[qIdx]
              const optionOrder = q.options.map((_, idx) => idx)
              if (exam.randomiseOptions) {
                shuffleArray(optionOrder, rng)
              }

              await tx.$executeRawUnsafe(`
                INSERT INTO attempt_questions (id, attempt_id, question_id, display_order, option_order)
                VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4::smallint[])
                ON CONFLICT (attempt_id, question_id) DO NOTHING;
              `, attemptId, q.id, qIdx + 1, optionOrder)
            }
          }
        }
      }, { maxWait: 5000, timeout: 15000 })
    }

    logger.info({ examId, totalPrewarmed }, 'Completed attempt pre-warming job')
    return { prewarmedCount: totalPrewarmed }
  }
}

const attemptPrewarmJob = new AttemptPrewarmJob()

module.exports = {
  AttemptPrewarmJob,
  attemptPrewarmJob
}
