const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { EXAM_CLOCK_CONFIG } = require('../exams/examClock')

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

      // 2. Set-based update: find ACTIVE attempts past expires_at + sweepGrace (§P9 F8)
      const sweepGraceSeconds = EXAM_CLOCK_CONFIG.sweepGrace
      const updateSql = `
        UPDATE exam_attempts
        SET status = 'EXPIRED'
        WHERE status = 'ACTIVE'
          AND expires_at IS NOT NULL
          AND expires_at < (now() - ($1 || ' seconds')::interval)
        RETURNING id, exam_id, student_id;
      `

      const expiredAttempts = await prisma.$queryRawUnsafe(updateSql, sweepGraceSeconds)

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

      // 4. Reconciler (§P9 F2): any attempt in SUBMITTED|EXPIRED|TERMINATED with no result older than 60s -> enqueue evaluation
      const unevaluatedAttempts = await prisma.$queryRawUnsafe(`
        SELECT ea.id, ea.exam_id, ea.student_id, ea.status
        FROM exam_attempts ea
        WHERE ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
          AND ea.updated_at < (now() - interval '60 seconds')
          AND NOT EXISTS (
            SELECT 1 FROM exam_results er WHERE er.attempt_id = ea.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM outbox_events oe 
            WHERE oe.status = 'PENDING' 
              AND (oe.payload->>'attemptId') = ea.id::text
          )
        LIMIT 50;
      `)

      if (unevaluatedAttempts && unevaluatedAttempts.length > 0) {
        logger.warn({ count: unevaluatedAttempts.length }, 'ExpirySweeper reconciler identified unevaluated terminal attempts')
        await prisma.$transaction(async (tx) => {
          for (const att of unevaluatedAttempts) {
            const eventType = `attempt.${att.status.toLowerCase()}`
            await tx.$executeRawUnsafe(`
              INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
              VALUES ($1, $2::jsonb, 'PENDING', now());
            `, eventType, JSON.stringify({
              attemptId: att.id,
              examId: att.exam_id,
              studentId: att.student_id,
              status: att.status,
              reason: 'Reconciler auto-enqueued evaluation'
            }))
          }
        }, { maxWait: 2000, timeout: 5000 })
      }

      return {
        expiredCount: expiredAttempts ? expiredAttempts.length : 0,
        reconciledCount: unevaluatedAttempts ? unevaluatedAttempts.length : 0,
        isLeader: true
      }
    } finally {
      if (hasLock) {
        await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock($1);`, SWEEPER_LOCK_ID).catch((err) => {
          logger.warn({ error: err.message }, 'Failed to release sweeper advisory lock')
        })
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
