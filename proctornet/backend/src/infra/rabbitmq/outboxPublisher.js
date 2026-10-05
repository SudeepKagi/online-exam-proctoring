/**
 * outboxPublisher.js
 * Transactional Outbox Publisher for reliable asynchronous event delivery (Q4 Task 3).
 * - Leases pending events using FOR UPDATE SKIP LOCKED
 * - Broker down -> release row with short capped delay (2s), NO attempt increment
 * - Only true business/formatting errors count against retry attempts
 * - FAILED raises Prometheus metric + log + is replayable
 * - Reaper for stuck leases
 */

const { prisma } = require('../postgres/client')
const { rabbitmq } = require('./client')
const { logger } = require('../../shared/logging')
const { outboxFailedCounter } = require('../../observability/metrics')

class OutboxPublisher {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 1000
    this.batchSize = options.batchSize || 100
    this.isRunning = false
    this.timer = null
    this.lastReaperRun = 0
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    logger.info('OutboxPublisher background worker started')
    this._scheduleNext()
  }

  stop() {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('OutboxPublisher background worker stopped')
  }

  _scheduleNext() {
    if (!this.isRunning) return
    this.timer = setTimeout(async () => {
      try {
        await this.pollAndPublish()
      } catch (err) {
        logger.error({ error: err.message }, 'Error in OutboxPublisher poll loop')
      } finally {
        this._scheduleNext()
      }
    }, this.intervalMs)
  }

  /**
   * Reaper: un-sticks any orphaned leases where workers crashed or held locks > 60s
   */
  async _reapStuckLeases() {
    const now = Date.now()
    if (now - this.lastReaperRun < 30000) return // Run at most once per 30 seconds
    this.lastReaperRun = now

    try {
      await prisma.$executeRawUnsafe(`
        UPDATE outbox_events
        SET next_attempt_at = now()
        WHERE status = 'PENDING'
          AND next_attempt_at > now() + interval '60 seconds';
      `)
    } catch {
      // ignore transient reaper query errors
    }
  }

  /**
   * Claims up to 100 pending outbox events using SKIP LOCKED and publishes to RabbitMQ
   */
  async pollAndPublish() {
    await this._reapStuckLeases()

    // If broker is known to be offline, skip claiming to avoid holding DB rows in leased state
    if (!rabbitmq.isReady) {
      return 0
    }

    // Fetch and lease pending batch in a transaction using SKIP LOCKED
    const events = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(`
        SELECT id, event_type, payload, attempts, created_at
        FROM outbox_events
        WHERE status = 'PENDING'
          AND next_attempt_at <= now()
        ORDER BY id ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED;
      `)

      if (!rows || rows.length === 0) return []

      const ids = rows.map(r => r.id)
      // Lease events for 60 seconds
      await tx.$executeRawUnsafe(`
        UPDATE outbox_events
        SET next_attempt_at = now() + interval '60 seconds'
        WHERE id = ANY($1::bigint[]);
      `, ids)

      return rows
    }, { maxWait: 2000, timeout: 5000 }).catch(() => [])

    if (!events || events.length === 0) return 0

    let publishedCount = 0

    for (const evt of events) {
      const eventId = String(evt.id)
      const routingKey = evt.event_type

      const envelope = {
        eventId,
        type: evt.event_type,
        version: 1,
        occurredAt: evt.created_at || new Date().toISOString(),
        traceId: null,
        payload: evt.payload
      }

      // Check broker readiness before each publish
      if (!rabbitmq.isReady) {
        // Broker dropped: release this and all remaining events immediately with capped delay (no attempt increment)
        await this._releaseRowNoIncrement(evt.id)
        break
      }

      try {
        await rabbitmq.publish(routingKey, envelope, {
          messageId: eventId
        })

        // Success: mark PUBLISHED
        await prisma.$executeRawUnsafe(`
          UPDATE outbox_events
          SET status = 'PUBLISHED', processed_at = now()
          WHERE id = $1;
        `, evt.id)

        publishedCount++
      } catch (err) {
        const isBrokerError = !rabbitmq.isReady ||
          /channel|connect|timeout|closed|econnrefused|not ready|connection/i.test(err.message)

        if (isBrokerError) {
          // Broker dropped mid-publish: release row with short capped delay, do NOT increment attempts!
          await this._releaseRowNoIncrement(evt.id)
          logger.warn({ eventId, error: err.message }, 'Broker unavailable mid-publish: released row without burning retry attempt')
          break // Stop current batch since broker is unreachable
        }

        // True business / formatting error: increment retry attempt count
        const nextAttempts = (evt.attempts || 0) + 1

        if (nextAttempts >= 10) {
          // Exceeded max retries -> FAILED
          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'FAILED', attempts = $1, processed_at = now()
            WHERE id = $2;
          `, nextAttempts, evt.id).catch(() => {})

          try {
            outboxFailedCounter.inc({ event_type: evt.event_type || 'unknown' })
          } catch {
            // metric increment safe fallback
          }

          logger.error({
            eventId,
            routingKey,
            attempts: nextAttempts,
            error: err.message
          }, 'Outbox event permanently failed; marked FAILED and available for ops replay')
        } else {
          const backoffSeconds = Math.min(300, Math.pow(2, nextAttempts)) + Math.floor(Math.random() * 3)

          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'PENDING',
                attempts = attempts + 1,
                next_attempt_at = now() + ($1 || ' seconds')::interval
            WHERE id = $2;
          `, String(backoffSeconds), evt.id).catch(() => {})

          logger.warn({
            eventId,
            routingKey,
            attempts: nextAttempts,
            backoffSeconds,
            error: err.message
          }, 'Business error publishing outbox event; scheduled for retry')
        }
      }
    }

    return publishedCount
  }

  /**
   * Release row back to PENDING with short capped delay (2s) without incrementing attempts
   */
  async _releaseRowNoIncrement(id) {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE outbox_events
        SET next_attempt_at = now() + interval '2 seconds'
        WHERE id = $1;
      `, id)
    } catch {
      // ignore
    }
  }

  /**
   * Replay failed events (CLI ops utility)
   */
  async replayFailed(limit = 100) {
    return prisma.$executeRawUnsafe(`
      UPDATE outbox_events
      SET status = 'PENDING',
          attempts = 0,
          next_attempt_at = now()
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status = 'FAILED'
        ORDER BY id ASC
        LIMIT $1
      );
    `, limit)
  }
}

const outboxPublisher = new OutboxPublisher()

module.exports = {
  outboxPublisher,
  OutboxPublisher
}
