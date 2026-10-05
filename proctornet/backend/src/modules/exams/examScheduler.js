const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { attemptPrewarmJob } = require('../attempts/prewarmJob')

const EXAM_LIFECYCLE_LOCK_ID = 987654322

class ExamScheduler {
  constructor() {
    this.timer = null
    this.isRunning = false
    this.prewarmMinutes = parseInt(process.env.ATTEMPT_PREWARM_MINUTES, 10) || 15
  }

  start(intervalMs = 15000) {
    if (this.isRunning) return
    this.isRunning = true
    logger.info({ intervalMs }, 'ExamScheduler started')

    this.timer = setInterval(() => {
      this.tick().catch(err => {
        logger.error({ error: err.message }, 'Error in ExamScheduler cycle')
      })
    }, intervalMs)

    // Run first tick immediately
    this.tick().catch(err => {
      logger.error({ error: err.message }, 'Error in initial ExamScheduler run')
    })
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
    logger.info('ExamScheduler stopped')
  }

  /**
   * Leader-elected lifecycle transition step
   */
  async tick(force = false) {
    let hasLock = false
    try {
      if (!force) {
        const lockRes = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock($1) AS acquired;`, EXAM_LIFECYCLE_LOCK_ID)
        hasLock = lockRes && lockRes[0] && lockRes[0].acquired
        if (!hasLock) {
          return { isLeader: false, prewarmedCount: 0, liveCount: 0, endedCount: 0, evaluatedCount: 0 }
        }
      }

      // Step 1: Pre-warming trigger at (start_time - ATTEMPT_PREWARM_MINUTES)
      const prewarmSql = `
        SELECT id FROM exams
        WHERE status = 'PUBLISHED'
          AND start_time - ($1 || ' minutes')::interval <= now()
          AND start_time > now();
      `
      const examsToPrewarm = await prisma.$queryRawUnsafe(prewarmSql, this.prewarmMinutes)
      let prewarmedCount = 0
      if (examsToPrewarm && examsToPrewarm.length > 0) {
        for (const e of examsToPrewarm) {
          try {
            await attemptPrewarmJob.prewarmExam(e.id)
            prewarmedCount++
          } catch (err) {
            logger.warn({ examId: e.id, error: err.message }, 'Prewarm failed for exam in scheduler')
          }
        }
      }

      // Step 2: Guarded transition PUBLISHED -> LIVE at start_time
      const toLiveSql = `
        UPDATE exams
        SET status = 'LIVE'
        WHERE status = 'PUBLISHED'
          AND start_time <= now()
          AND end_time > now()
        RETURNING id, title;
      `
      const liveExams = await prisma.$queryRawUnsafe(toLiveSql)
      const liveCount = liveExams ? liveExams.length : 0
      if (liveCount > 0) {
        logger.info({ count: liveCount }, 'Guarded transition: exams moved to LIVE')
      }

      // Step 3: Guarded transition LIVE -> ENDED at end_time
      const toEndedSql = `
        UPDATE exams
        SET status = 'ENDED'
        WHERE status = 'LIVE'
          AND end_time <= now()
        RETURNING id, title;
      `
      const endedExams = await prisma.$queryRawUnsafe(toEndedSql)
      const endedCount = endedExams ? endedExams.length : 0
      if (endedCount > 0) {
        logger.info({ count: endedCount }, 'Guarded transition: exams moved to ENDED')
      }

      // Step 4: Guarded transition ENDED -> EVALUATED when all submitted/expired attempts have results
      const toEvaluatedSql = `
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
      `
      const evaluatedExams = await prisma.$queryRawUnsafe(toEvaluatedSql)
      const evaluatedCount = evaluatedExams ? evaluatedExams.length : 0
      if (evaluatedCount > 0) {
        logger.info({ count: evaluatedCount }, 'Guarded transition: exams moved to EVALUATED')
      }

      return {
        isLeader: true,
        prewarmedCount,
        liveCount,
        endedCount,
        evaluatedCount
      }
    } finally {
      if (hasLock) {
        await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock($1);`, EXAM_LIFECYCLE_LOCK_ID).catch(() => {})
      }
    }
  }
}

const examScheduler = new ExamScheduler()

module.exports = {
  ExamScheduler,
  examScheduler,
  EXAM_LIFECYCLE_LOCK_ID
}
