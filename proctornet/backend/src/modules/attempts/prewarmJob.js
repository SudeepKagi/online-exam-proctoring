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

    const CHUNK_SIZE = 15
    let totalPrewarmed = 0

    // 4. Process in safe chunks of 15 with explicit timeout to avoid interactive transaction timeouts
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

            if (selected.length > 0) {
              const valuePlaceholders = []
              const params = [attemptId]
              let paramIdx = 2

              for (let qIdx = 0; qIdx < selected.length; qIdx++) {
                const q = selected[qIdx]
                const optionOrder = q.options.map((_, idx) => idx)
                if (exam.randomiseOptions) {
                  shuffleArray(optionOrder, rng)
                }

                valuePlaceholders.push(`(gen_random_uuid(), $1::uuid, $${paramIdx}::uuid, $${paramIdx + 1}, $${paramIdx + 2}::smallint[])`)
                params.push(q.id, qIdx + 1, optionOrder)
                paramIdx += 3
              }

              await tx.$executeRawUnsafe(`
                INSERT INTO attempt_questions (id, attempt_id, question_id, display_order, option_order)
                VALUES ${valuePlaceholders.join(',\n')}
                ON CONFLICT (attempt_id, question_id) DO NOTHING;
              `, ...params)
            }

            // Pre-provision VPN peer during pre-warm if VPN is enabled (P8 Task 6)
            if (process.env.VPN_ENABLED === 'true' || exam.vpnRequired) {
              try {
                const rawIp = await tx.$queryRawUnsafe(`
                  UPDATE vpn_ip_pool
                  SET attempt_id = $1::uuid, leased_at = now(), released_at = null
                  WHERE ip = (
                    SELECT ip FROM vpn_ip_pool
                    WHERE attempt_id IS NULL
                    ORDER BY ip
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                  )
                  RETURNING ip;
                `, attemptId)
                if (rawIp && rawIp.length > 0) {
                  const { vpnKeyService } = require('../vpn/keyService')
                  const { publicKey } = vpnKeyService.generateKeyPair()
                  await tx.vpnPeer.create({
                    data: {
                      attemptId,
                      studentId: student.id,
                      ipAddress: rawIp[0].ip,
                      publicKey,
                      isActive: true
                    }
                  })
                  await tx.$executeRawUnsafe(`
                    INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
                    VALUES ('vpn.peer.add', $1::jsonb, 'PENDING', now());
                  `, JSON.stringify({
                    attemptId,
                    studentId: student.id,
                    publicKey,
                    ipAddress: rawIp[0].ip
                  }))
                }
              } catch (vpnErr) {
                logger.warn({ error: vpnErr.message, attemptId }, 'Failed to pre-provision VPN during prewarm')
              }
            }
          }
        }
      }, { maxWait: 10000, timeout: 30000 })
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
