const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

const SWEEPER_LOCK_ID = 987654321

class ExpirySweeper {
  constructor() {
    this.timer = null
    this.isRunning = false
  }

  start(intervalMs = 15000) {
    if (this.isRunning) return
    this.isRunning = true
    logger.info({ intervalMs }, 'ExpirySweeper started')

    this.timer = setInterval(() => {
      this.sweep().catch(err => {
        logger.error({ error: err.message }, 'Error in ExpirySweeper cycle')
      })
    }, intervalMs)

    // Run first sweep immediately
    this.sweep().catch(err => {
      logger.error({ error: err.message }, 'Error in initial ExpirySweeper run')
    })
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
    logger.info('ExpirySweeper stopped')
  }

  /**
   * Leader-elected sweep step
   */
  async sweep(force = false) {
    let hasLock = false
    try {
      if (!force) {
        // 1. Attempt non-blocking advisory lock
        const lockRes = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock($1) AS acquired;`, SWEEPER_LOCK_ID)
        hasLock = lockRes && lockRes[0] && lockRes[0].acquired

        if (!hasLock) {
          // Another instance is the sweeper leader
          return { expiredCount: 0, isLeader: false }
        }
      } else {
        hasLock = false
      }

      // 2. Set-based update: find ACTIVE attempts past expires_at + 30s grace
      const updateSql = `
        UPDATE exam_attempts
        SET status = 'EXPIRED'
        WHERE status = 'ACTIVE'
          AND expires_at IS NOT NULL
          AND expires_at < (now() - interval '30 seconds')
        RETURNING id, exam_id, student_id;
      `

      const expiredAttempts = await prisma.$queryRawUnsafe(updateSql)

      if (expiredAttempts && expiredAttempts.length > 0) {
        logger.info({ count: expiredAttempts.length }, 'Sweeper identified expired exam attempts')

        // 3. Insert outbox events for evaluation worker
        await prisma.$transaction(async (tx) => {
          for (const att of expiredAttempts) {
            await tx.$executeRawUnsafe(`
              INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
              VALUES ('attempt.expired', $1::jsonb, 'PENDING', now());
            `, JSON.stringify({
              attemptId: att.id,
              examId: att.exam_id,
              studentId: att.student_id,
              status: 'EXPIRED',
              reason: 'Time expired'
            }))
          }
        }, { maxWait: 2000, timeout: 5000 })
      }

      return {
        expiredCount: expiredAttempts ? expiredAttempts.length : 0,
        isLeader: true
      }
    } finally {
      if (hasLock) {
        await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock($1);`, SWEEPER_LOCK_ID).catch(() => {})
      }
    }
  }
}

const expirySweeper = new ExpirySweeper()

module.exports = {
  ExpirySweeper,
  expirySweeper,
  SWEEPER_LOCK_ID
}
