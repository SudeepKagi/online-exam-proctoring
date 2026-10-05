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

    if (this.isFlushing && this.currentFlushPromise) {
      await this.currentFlushPromise
    }

    if (this.buffer.length === 0) {
      return
    }

    this.isFlushing = true
    this.currentFlushPromise = this._executeBatch().finally(() => {
      this.isFlushing = false
      this.currentFlushPromise = null
    })
    return this.currentFlushPromise
  }

  async _executeBatch() {
    const currentBatch = this.buffer.splice(0, this.maxBatchSize)

    try {
      const attemptIds = []
      const eventTypes = []
      const severities = []
      const metadatas = []
      const clientTimestamps = []
      const indices = []

      for (let i = 0; i < currentBatch.length; i++) {
        const b = currentBatch[i]
        attemptIds.push(b.attemptId)
        eventTypes.push(b.eventType)
        severities.push(b.severity)

        // Cap metadata to 2 KB (C-08)
        let metaStr = JSON.stringify(b.metadata || {})
        if (Buffer.byteLength(metaStr, 'utf8') > 2048) {
          metaStr = JSON.stringify({ truncated: true, summary: metaStr.slice(0, 1900) })
        }
        metadatas.push(metaStr)

        // Parse error fallback to server time (C-08)
        let ts = new Date().toISOString()
        if (b.clientTimestamp) {
          const parsed = new Date(b.clientTimestamp)
          if (!isNaN(parsed.getTime())) {
            ts = parsed.toISOString()
          }
        }
        clientTimestamps.push(ts)
        indices.push(i)
      }

      // 1. Single set-based INSERT using unnest with index preservation
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
          $5::text[],
          $6::int[]
        ) AS u(attempt_id, event_type, severity, metadata, client_timestamp, idx)
        ORDER BY u.idx ASC
        RETURNING id, attempt_id;
      `

      const insertedRows = await prisma.$queryRawUnsafe(
        insertSql,
        attemptIds,
        eventTypes,
        severities,
        metadatas,
        clientTimestamps,
        indices
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

      // 3. Broadcast roster updates via Redis Emitter (C-06: inv:{examId} only)
      try {
        const { socketEmitter } = require('../../infra/websocket/emitter')
        if (updatedAttempts) {
          for (const att of updatedAttempts) {
            socketEmitter.emitToInvigilators(att.exam_id, 'roster:flag_update', {
              attemptId: att.id,
              flagCount: att.flag_count
            })
          }
        }
      } catch (wsErr) {
        logger.warn({ error: wsErr.message }, 'Failed to broadcast roster updates')
      }

      // 4. Resolve all promises in this batch with created violationId
      for (let i = 0; i < currentBatch.length; i++) {
        const item = currentBatch[i]
        const row = insertedRows[i]
        item.resolve({
          success: true,
          violationId: row ? row.id : null,
          queued: false,
          processedAt: new Date().toISOString()
        })
      }
    } catch (err) {
      // Micro-batcher per-row fallback on batch error (C-08/C-09)
      // Isolate bad items and reject only them; store all valid items
      logger.warn(
        { error: err.message, batchSize: currentBatch.length },
        'Batch violation insert failed; executing per-row fallback to isolate malformed records'
      )

      for (const item of currentBatch) {
        try {
          let itemMeta = JSON.stringify(item.metadata || {})
          if (Buffer.byteLength(itemMeta, 'utf8') > 2048) {
            itemMeta = JSON.stringify({ truncated: true, summary: itemMeta.slice(0, 1900) })
          }

          let itemTs = new Date().toISOString()
          if (item.clientTimestamp) {
            const parsed = new Date(item.clientTimestamp)
            if (!isNaN(parsed.getTime())) {
              itemTs = parsed.toISOString()
            }
          }

          const singleSql = `
            INSERT INTO violation_events (
              attempt_id, event_type, severity, metadata, client_timestamp, server_timestamp
            )
            VALUES ($1::uuid, $2::"ViolationType", $3::"Severity", $4::jsonb, $5::timestamptz, now())
            RETURNING id;
          `
          const singleRows = await prisma.$queryRawUnsafe(
            singleSql,
            item.attemptId,
            item.eventType,
            item.severity,
            itemMeta,
            itemTs
          )

          await prisma.$executeRawUnsafe(`
            UPDATE exam_attempts SET flag_count = flag_count + 1 WHERE id = $1::uuid;
          `, item.attemptId).catch(() => {})

          item.resolve({
            success: true,
            violationId: singleRows[0].id,
            queued: false,
            processedAt: new Date().toISOString()
          })
        } catch (singleErr) {
          // Reject only this malformed item!
          item.reject(singleErr)
        }
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
