const { prisma } = require('../postgres/client')
const { rabbitmq } = require('./client')
const { logger } = require('../../shared/logging')

class OutboxPublisher {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 1000
    this.batchSize = options.batchSize || 100
    this.isRunning = false
    this.timer = null
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
   * Claims up to 100 pending outbox events using SKIP LOCKED and publishes to RabbitMQ
   */
  async pollAndPublish() {
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
      // Lease events for 60 seconds so another concurrent worker won't claim them
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

      if (!rabbitmq.isReady) {
        // Broker offline: leave events PENDING and do not burn retry attempts
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
        const nextAttempts = (evt.attempts || 0) + 1
        const backoffSeconds = Math.min(300, Math.pow(2, nextAttempts)) + Math.floor(Math.random() * 3)

        if (nextAttempts >= 10) {
          // Exceeded max retries -> FAILED
          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'FAILED', attempts = $1, processed_at = now()
            WHERE id = $2;
          `, nextAttempts, evt.id).catch(() => {})
        } else {
          // Re-queue with exponential backoff + jitter
          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'PENDING',
                attempts = attempts + 1,
                next_attempt_at = now() + ($1 || ' seconds')::interval
            WHERE id = $2;
          `, String(backoffSeconds), evt.id).catch(() => {})
        }

        logger.warn({
          eventId,
          routingKey,
          attempts: nextAttempts,
          backoffSeconds,
          error: err.message
        }, 'Failed to publish outbox event to RabbitMQ; scheduled for retry')
      }
    }

    return publishedCount
  }
}

const outboxPublisher = new OutboxPublisher()

module.exports = {
  outboxPublisher,
  OutboxPublisher
}
