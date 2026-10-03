const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class ViolationMicroBatcher {
  constructor(maxBatchSize = 200, flushIntervalMs = 100) {
    this.maxBatchSize = maxBatchSize
    this.flushIntervalMs = flushIntervalMs
    this.buffer = []
    this.timer = null
    this.isFlushing = false
  }

  /**
   * Queue a single violation item for micro-batched insert
   */
  async queue(item) {
    return new Promise((resolve, reject) => {
      this.buffer.push({
        ...item,
        resolve,
        reject
      })

      if (this.buffer.length >= this.maxBatchSize) {
        this.flush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
      }
    })
  }

  /**
   * Flush queued items in a single set-based SQL operation
   */
  async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.buffer.length === 0 || this.isFlushing) {
      return
    }

    this.isFlushing = true
    const currentBatch = this.buffer.splice(0, this.maxBatchSize)

    try {
      const attemptIds = currentBatch.map(b => b.attemptId)
      const eventTypes = currentBatch.map(b => b.eventType)
      const severities = currentBatch.map(b => b.severity)
      const metadatas = currentBatch.map(b => JSON.stringify(b.metadata || {}))
      const clientTimestamps = currentBatch.map(b => b.clientTimestamp ? new Date(b.clientTimestamp).toISOString() : new Date().toISOString())

      // 1. Single set-based INSERT using unnest
      const insertSql = `
        INSERT INTO violation_events (
          attempt_id, event_type, severity, metadata, client_timestamp, server_timestamp
        )
        SELECT
          u.attempt_id,
          u.event_type::"ViolationType",
          u.severity::"Severity",
          u.metadata::jsonb,
          u.client_timestamp::timestamptz,
          now()
        FROM unnest(
          $1::uuid[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[]
        ) AS u(attempt_id, event_type, severity, metadata, client_timestamp)
        RETURNING id, attempt_id;
      `

      await prisma.$queryRawUnsafe(
        insertSql,
        attemptIds,
        eventTypes,
        severities,
        metadatas,
        clientTimestamps
      )

      // 2. Batch update flag_count on exam_attempts
      const updateFlagsSql = `
        WITH deltas AS (
          SELECT attempt_id, COUNT(*)::int AS delta
          FROM unnest($1::uuid[]) AS t(attempt_id)
          GROUP BY attempt_id
        )
        UPDATE exam_attempts ea
        SET flag_count = ea.flag_count + deltas.delta
        FROM deltas
        WHERE ea.id = deltas.attempt_id
        RETURNING ea.id, ea.exam_id, ea.flag_count;
      `

      const updatedAttempts = await prisma.$queryRawUnsafe(updateFlagsSql, attemptIds)

      // 3. Broadcast roster updates via WebSocket
      try {
        if (global.io && updatedAttempts) {
          for (const att of updatedAttempts) {
            global.io.to(`exam:${att.exam_id}`).emit('roster:flag_update', {
              attemptId: att.id,
              flagCount: att.flag_count
            })
          }
        }
      } catch (wsErr) {
        logger.warn({ error: wsErr.message }, 'Failed to broadcast roster updates')
      }

      // 4. Resolve all promises in this batch
      for (const item of currentBatch) {
        item.resolve({ success: true, queued: false, processedAt: new Date().toISOString() })
      }
    } catch (err) {
      logger.error({ error: err.message, batchSize: currentBatch.length }, 'Micro-batcher flush failed')
      for (const item of currentBatch) {
        item.reject(err)
      }
    } finally {
      this.isFlushing = false
      if (this.buffer.length > 0) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
      }
    }
  }
}

const violationMicroBatcher = new ViolationMicroBatcher()

module.exports = {
  ViolationMicroBatcher,
  violationMicroBatcher
}
