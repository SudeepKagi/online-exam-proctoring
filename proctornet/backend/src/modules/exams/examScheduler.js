const { examRepository } = require('./repository')
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
        hasLock = await examRepository.tryAdvisoryLock(EXAM_LIFECYCLE_LOCK_ID)
        if (!hasLock) {
          return { isLeader: false, prewarmedCount: 0, liveCount: 0, endedCount: 0, evaluatedCount: 0 }
        }
      }

      // Step 1: Pre-warming trigger at (start_time - ATTEMPT_PREWARM_MINUTES)
      const examsToPrewarm = await examRepository.findExamsReadyForPrewarm(this.prewarmMinutes)
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
      const liveExams = await examRepository.transitionPublishedToLive()
      const liveCount = liveExams ? liveExams.length : 0
      if (liveCount > 0) {
        logger.info({ count: liveCount }, 'Guarded transition: exams moved to LIVE')
      }

      // Step 3: Guarded transition LIVE -> ENDED at end_time
      const endedExams = await examRepository.transitionLiveToEnded()
      const endedCount = endedExams ? endedExams.length : 0
      if (endedCount > 0) {
        logger.info({ count: endedCount }, 'Guarded transition: exams moved to ENDED')
      }

      // Step 3.1 (§P9 F3): Process absent students and suspended attempts for all ENDED exams
      try {
        const { resultRepository } = require('../results/repository')
        const { prisma } = require('../../infra/postgres/client')

        // Process absent students for all exams in ENDED that still have READY attempts
        const endedExamsWithReady = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT e.id
          FROM exams e
          JOIN exam_attempts ea ON ea.exam_id = e.id
          WHERE e.status = 'ENDED' AND ea.status = 'READY';
        `)
        if (endedExamsWithReady && endedExamsWithReady.length > 0) {
          for (const e of endedExamsWithReady) {
            await resultRepository.createAbsentResultsForEndedExam(e.id)
            logger.info({ examId: e.id }, 'Generated absent results for unstarted READY attempts')
          }
        }

        // Expire SUSPENDED attempts at end_time + grace and enqueue evaluation (§P9 F3/F8)
        const { EXAM_CLOCK_CONFIG } = require('./examClock')
        const graceSeconds = EXAM_CLOCK_CONFIG.endGrace
        const expiredSuspendedAttempts = await prisma.$queryRawUnsafe(`
          UPDATE exam_attempts ea
          SET status = 'EXPIRED',
              status_reason = 'Suspended attempt expired at exam end'
          FROM exams e
          WHERE ea.exam_id = e.id
            AND ea.status = 'SUSPENDED'
            AND e.status IN ('ENDED', 'LIVE')
            AND now() >= (e.end_time + ($1 || ' seconds')::interval)
          RETURNING ea.id, ea.exam_id, ea.student_id;
        `, graceSeconds.toString())

        if (expiredSuspendedAttempts && expiredSuspendedAttempts.length > 0) {
          logger.info({ count: expiredSuspendedAttempts.length }, 'Expired SUSPENDED attempts past end_time + grace')
          for (const att of expiredSuspendedAttempts) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
              VALUES ('attempt.expired', $1::jsonb, 'PENDING', now());
            `, JSON.stringify({
              attemptId: att.id,
              examId: att.exam_id,
              studentId: att.student_id,
              status: 'EXPIRED',
              reason: 'Suspended attempt expired at exam end'
            })).catch(() => {})
          }
        }
      } catch (lifecycleErr) {
        logger.error({ error: lifecycleErr.message }, 'Error in examScheduler absent/suspended resolution')
      }

      // Step 4: Guarded transition ENDED -> EVALUATED when all terminal attempts have results
      const evaluatedExams = await examRepository.transitionEndedToEvaluated()
      const evaluatedCount = evaluatedExams ? evaluatedExams.length : 0
      if (evaluatedCount > 0) {
        logger.info({ count: evaluatedCount }, 'Guarded transition: exams moved to EVALUATED')
        const { resultRepository } = require('../results/repository')
        for (const evalExam of evaluatedExams) {
          try {
            await resultRepository.updateRanksForExam(evalExam.id)
            logger.info({ examId: evalExam.id }, 'Computed ranks for evaluated exam')
          } catch (rankErr) {
            logger.warn({ examId: evalExam.id, error: rankErr.message }, 'Failed rank computation for evaluated exam')
          }
        }
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
        await examRepository.releaseAdvisoryLock(EXAM_LIFECYCLE_LOCK_ID)
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
