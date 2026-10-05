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

      // Step 4: Guarded transition ENDED -> EVALUATED when all submitted/expired attempts have results
      const evaluatedExams = await examRepository.transitionEndedToEvaluated()
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
