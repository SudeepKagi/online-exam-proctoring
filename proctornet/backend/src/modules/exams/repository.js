const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')

class ExamRepository {
  /**
   * Find a single exam by ID, optionally including questions+options.
   */
  async findById(examId, { includeQuestions = false } = {}) {
    return prisma.exam.findUnique({
      where: { id: examId },
      include: includeQuestions
        ? { questions: { include: { options: true } } }
        : undefined
    })
  }

  /**
   * Find a single exam by ID including the owning faculty.
   */
  async findByIdWithFaculty(examId) {
    return prisma.exam.findUnique({
      where: { id: examId },
      include: {
        faculty: {
          select: { id: true, name: true, email: true, departmentCode: true }
        }
      }
    })
  }

  /**
   * Create a new exam record.
   */
  async create(data) {
    const payload = {
      id: data.id || crypto.randomUUID(),
      ...data
    }
    return prisma.exam.create({ data: payload })
  }

  /**
   * Transition an exam's status field.
   */
  async updateStatus(examId, status) {
    return prisma.exam.update({
      where: { id: examId },
      data: { status }
    })
  }

  /**
   * Update mutable exam fields (DRAFT only).
   */
  async update(examId, data) {
    return prisma.exam.update({
      where: { id: examId },
      data
    })
  }

  // ---------------------------------------------------------------------------
  // Scheduler — advisory lock & guarded lifecycle transitions
  // ---------------------------------------------------------------------------

  /**
   * Try to acquire a PostgreSQL session-level advisory lock.
   * Returns true if acquired, false if another session holds it.
   */
  async tryAdvisoryLock(lockId) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1) AS acquired;`,
      lockId
    )
    return Boolean(rows?.[0]?.acquired)
  }

  /**
   * Release a previously acquired advisory lock.
   */
  async releaseAdvisoryLock(lockId) {
    return prisma.$executeRawUnsafe(
      `SELECT pg_advisory_unlock($1);`,
      lockId
    )
  }

  /**
   * Find PUBLISHED exams whose pre-warm window has opened.
   */
  async findExamsReadyForPrewarm(prewarmMinutes) {
    return prisma.$queryRawUnsafe(`
      SELECT id FROM exams
      WHERE status = 'PUBLISHED'
        AND start_time - ($1 || ' minutes')::interval <= now()
        AND start_time > now();
    `, prewarmMinutes)
  }

  /**
   * Guarded transition PUBLISHED → LIVE. Returns promoted exam rows.
   */
  async transitionPublishedToLive() {
    return prisma.$queryRawUnsafe(`
      UPDATE exams
      SET status = 'LIVE'
      WHERE status = 'PUBLISHED'
        AND start_time <= now()
        AND end_time > now()
      RETURNING id, title;
    `)
  }

  /**
   * Guarded transition LIVE → ENDED. Returns ended exam rows.
   */
  async transitionLiveToEnded() {
    return prisma.$queryRawUnsafe(`
      UPDATE exams
      SET status = 'ENDED'
      WHERE status = 'LIVE'
        AND end_time <= now()
      RETURNING id, title;
    `)
  }

  /**
   * Guarded transition ENDED → EVALUATED.
   * Only fires when every attempt in the exam has a result row.
   * Returns evaluated exam rows.
   */
  async transitionEndedToEvaluated() {
    return prisma.$queryRawUnsafe(`
      UPDATE exams e
      SET status = 'EVALUATED'
      WHERE e.status = 'ENDED'
        AND EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.exam_id = e.id)
        AND NOT EXISTS (
          SELECT 1 FROM exam_attempts ea
          WHERE ea.exam_id = e.id
            AND ea.status IN ('READY', 'ACTIVE', 'SUSPENDED')
        )
        AND NOT EXISTS (
          SELECT 1 FROM exam_attempts ea
          WHERE ea.exam_id = e.id
            AND ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
            AND NOT EXISTS (
              SELECT 1 FROM exam_results er
              WHERE er.attempt_id = ea.id
            )
        )
      RETURNING e.id, e.title;
    `)
  }
}

module.exports = {
  ExamRepository,
  examRepository: new ExamRepository()
}
