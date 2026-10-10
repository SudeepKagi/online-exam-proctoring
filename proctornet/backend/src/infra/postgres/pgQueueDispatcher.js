/**
 * pgQueueDispatcher.js
 * R4 — Postgres Queue Driver (QUEUE_DRIVER=postgres)
 *
 * In-process outbox dispatcher for single-box "lite" deployments.
 * - Claims rows with FOR UPDATE SKIP LOCKED (same as RabbitMQ driver)
 * - Calls in-process handler registry directly (no broker dependency)
 * - Retry ladder: 5s / 30s / 5min with ±2s jitter
 * - After 3 attempts → DEAD; alerts via logger + Prometheus counter
 * - ops:dead-replay supported (same replayFailed API as OutboxPublisher)
 * - Evaluation idempotent via UNIQUE(attempt_id) on results table
 * - Leadership via pg_try_advisory_lock so a second process is safe to add later
 */

'use strict'

const { prisma } = require('../postgres/client')
const { logger } = require('../../shared/logging')
const { outboxFailedCounter, unhandledOutboxEventCounter } = require('../../observability/metrics')

// ── Retry schedule (seconds) with per-step jitter ────────────────────────────
const RETRY_SCHEDULE_S = [5, 30, 300] // 5s → 30s → 5min
const MAX_ATTEMPTS = RETRY_SCHEDULE_S.length + 1 // 4 total; 4th → DEAD
const ADVISORY_LOCK_ID = 5839201n // Arbitrary stable int64 for Postgres advisory lock

// ── In-process handler registry ──────────────────────────────────────────────
const KNOWN_OUTBOX_EVENT_TYPES = [
  'attempt.submitted',
  'attempt.expired',
  'attempt.terminated',
  'evidence.uploaded',
  'vpn.peer.provision',
  'vpn.peer.deprovision'
]
const IGNORED_EVENT_TYPES = new Set()
const handlers = new Map()

/**
 * Register an event type → async handler function.
 */
function registerHandler(eventType, fn) {
  if (typeof fn !== 'function') throw new TypeError(`Handler for "${eventType}" must be a function`)
  handlers.set(eventType, fn)
  logger.info({ eventType }, 'PgQueueDispatcher: handler registered')
}

/**
 * Single registration point called at boot for all outbox events.
 * Enforces boot assertions: all handlers are functions, all known outbox types are handled or explicitly ignored.
 */
function registerAllHandlers() {
  handlers.clear()
  IGNORED_EVENT_TYPES.clear()

  const { evaluationWorker } = require('../../modules/results/evaluationWorker')
  const { evidenceWorker } = require('../../modules/media/evidenceWorker')

  registerHandler('attempt.submitted', (payload, meta) =>
    evaluationWorker.handleEvent({ type: 'attempt.submitted', payload, eventId: meta?.eventId })
  )
  registerHandler('attempt.expired', (payload, meta) =>
    evaluationWorker.handleEvent({ type: 'attempt.expired', payload, eventId: meta?.eventId })
  )
  registerHandler('attempt.terminated', (payload, meta) =>
    evaluationWorker.handleEvent({ type: 'attempt.terminated', payload, eventId: meta?.eventId })
  )
  registerHandler('evidence.uploaded', (payload, meta) =>
    evidenceWorker.handleEvent({ type: 'evidence.uploaded', payload, eventId: meta?.eventId })
  )

  if (process.env.VPN_ENABLED === 'true') {
    try {
      const { vpnWorker } = require('../../modules/vpn/vpnWorker')
      registerHandler('vpn.peer.provision', (payload, meta) =>
        vpnWorker.handleEvent({ type: 'vpn.peer.provision', payload, eventId: meta?.eventId })
      )
      registerHandler('vpn.peer.deprovision', (payload, meta) =>
        vpnWorker.handleEvent({ type: 'vpn.peer.deprovision', payload, eventId: meta?.eventId })
      )
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to register VPN outbox handlers')
    }
  } else {
    IGNORED_EVENT_TYPES.add('vpn.peer.provision')
    IGNORED_EVENT_TYPES.add('vpn.peer.deprovision')
  }

  // Boot-time assertion: every registered handler is a function
  for (const [evtType, fn] of handlers.entries()) {
    if (typeof fn !== 'function') {
      throw new TypeError(`Boot assertion failed: Handler for "${evtType}" is not a function`)
    }
  }

  // Boot-time assertion: every known event type is either handled or ignored
  for (const knownType of KNOWN_OUTBOX_EVENT_TYPES) {
    if (!handlers.has(knownType) && !IGNORED_EVENT_TYPES.has(knownType)) {
      throw new Error(`Boot assertion failed: Event type "${knownType}" has no registered handler and is not ignored`)
    }
  }

  logger.info({
    registered: Array.from(handlers.keys()),
    ignored: Array.from(IGNORED_EVENT_TYPES)
  }, 'PgQueueDispatcher: registerAllHandlers complete')
}

function _ensureDefaultHandlers() {
  if (handlers.size > 0) return
  registerAllHandlers()
}

// ── PgQueueDispatcher class ───────────────────────────────────────────────────

class PgQueueDispatcher {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 1000
    this.batchSize = options.batchSize || 50
    this.isRunning = false
    this.timer = null
    this.lastReaperRun = 0
  }

  start() {
    if (this.isRunning) return
    _ensureDefaultHandlers()
    this.isRunning = true
    logger.info({ queueDriver: 'postgres' }, 'PgQueueDispatcher started (lite/postgres queue driver)')
    this._scheduleNext()
  }

  stop() {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('PgQueueDispatcher stopped')
  }

  _scheduleNext() {
    if (!this.isRunning) return
    this.timer = setTimeout(async () => {
      try {
        await this.pollAndDispatch()
      } catch (err) {
        logger.error({ error: err.message }, 'PgQueueDispatcher poll loop error')
      } finally {
        this._scheduleNext()
      }
    }, this.intervalMs)
  }

  /**
   * Reaper: un-sticks orphaned leases older than 120 s (2× batch timeout guard)
   */
  async _reapStuckLeases() {
    const now = Date.now()
    if (now - this.lastReaperRun < 30_000) return
    this.lastReaperRun = now
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE outbox_events
        SET next_attempt_at = now()
        WHERE status = 'PENDING'
          AND next_attempt_at > now() + interval '120 seconds';
      `)
    } catch (err) {
      logger.warn({ error: err.message }, 'PgQueueDispatcher reaper transient error')
    }
  }

  /**
   * Try to acquire the advisory lock; returns true if this process is the leader.
   * Non-blocking (pg_try_advisory_lock) — safe to call on every poll cycle.
   */
  async _tryAcquireLock() {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT pg_try_advisory_lock($1::bigint) AS acquired;`,
        ADVISORY_LOCK_ID
      )
      return rows?.[0]?.acquired === true
    } catch {
      // If DB unavailable, skip this cycle
      return false
    }
  }

  /**
   * Main dispatch loop: claims pending outbox events and invokes handlers in-process.
   */
  async pollAndDispatch() {
    await this._reapStuckLeases()

    // Leadership check: only one process dispatches at a time
    const isLeader = await this._tryAcquireLock()
    if (!isLeader) return 0

    // Claim a batch with FOR UPDATE SKIP LOCKED
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
      // Lease: mark next_attempt_at far ahead to prevent double-dispatch
      await tx.$executeRawUnsafe(`
        UPDATE outbox_events
        SET next_attempt_at = now() + interval '120 seconds'
        WHERE id = ANY($1::bigint[]);
      `, ids)

      return rows
    }, { maxWait: 2000, timeout: 5000 }).catch(() => [])

    if (!events || events.length === 0) return 0

    let dispatched = 0

    for (const evt of events) {
      const eventId = String(evt.id)
      const eventType = evt.event_type
      const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload
      const currentAttempts = (evt.attempts || 0) + 1 // this is the attempt number being made now

      const handler = handlers.get(eventType)
      if (!handler) {
        if (IGNORED_EVENT_TYPES.has(eventType)) {
          logger.info({ eventId, eventType }, 'PgQueueDispatcher: explicitly ignored event type, marking PUBLISHED')
          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'PUBLISHED', processed_at = now()
            WHERE id = $1;
          `, evt.id).catch((err) => {
            logger.warn({ eventId, error: err.message }, 'Failed to mark ignored event as published')
          })
          dispatched++
          continue
        }

        // Unknown event type: record error + Prometheus counter, mark FAILED
        logger.error({ eventId, eventType }, 'PgQueueDispatcher: UNKNOWN event type encountered, marking FAILED')
        try {
          unhandledOutboxEventCounter.inc({ event_type: eventType })
          outboxFailedCounter.inc({ event_type: eventType })
        } catch (metricErr) {
          logger.debug({ error: metricErr.message }, 'Metric increment skipped')
        }

        await prisma.$executeRawUnsafe(`
          UPDATE outbox_events
          SET status = 'FAILED', last_error = $1, processed_at = now()
          WHERE id = $2;
        `, `Unknown event type: ${eventType}`, evt.id).catch((err) => {
          logger.error({ eventId, error: err.message }, 'Failed to mark unhandled event as FAILED')
        })
        continue
      }

      try {
        await handler(payload, { eventId, eventType, attemptNumber: currentAttempts })

        // Success → mark PUBLISHED
        await prisma.$executeRawUnsafe(`
          UPDATE outbox_events
          SET status = 'PUBLISHED', attempts = $1, processed_at = now()
          WHERE id = $2;
        `, currentAttempts, evt.id)

        dispatched++
        logger.debug({ eventId, eventType, currentAttempts }, 'PgQueueDispatcher: event dispatched')
      } catch (err) {
        logger.warn({
          eventId,
          eventType,
          attempt: currentAttempts,
          error: err.message
        }, 'PgQueueDispatcher: handler failed, scheduling retry')

        if (currentAttempts >= MAX_ATTEMPTS) {
          // Exceeded max retries → DEAD
          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'FAILED', attempts = $1, processed_at = now()
            WHERE id = $2;
          `, currentAttempts, evt.id).catch((deadErr) => {
            logger.error({ eventId, error: deadErr.message }, 'Failed to mark dead event in outbox')
          })

          try {
            outboxFailedCounter.inc({ event_type: eventType })
          } catch (metricErr) {
            logger.debug({ error: metricErr.message }, 'Metric increment skipped')
          }

          logger.error({
            eventId,
            eventType,
            attempts: currentAttempts,
            error: err.message
          }, 'PgQueueDispatcher: event permanently DEAD; use ops:dead-replay to retry')
        } else {
          // Retry with jitter
          const stepIndex = Math.min(currentAttempts - 1, RETRY_SCHEDULE_S.length - 1)
          const baseSeconds = RETRY_SCHEDULE_S[stepIndex]
          const jitterSeconds = Math.floor(Math.random() * 4) - 2 // ±2s
          const backoffSeconds = Math.max(2, baseSeconds + jitterSeconds)

          await prisma.$executeRawUnsafe(`
            UPDATE outbox_events
            SET status = 'PENDING',
                attempts = $1,
                next_attempt_at = now() + ($2 || ' seconds')::interval
            WHERE id = $3;
          `, currentAttempts, String(backoffSeconds), evt.id).catch((retryErr) => {
            logger.warn({ eventId, error: retryErr.message }, 'Failed to update retry interval in outbox')
          })
        }
      }
    }

    return dispatched
  }

  /**
   * Replay DEAD/FAILED events — same CLI API as OutboxPublisher.replayFailed
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

const pgQueueDispatcher = new PgQueueDispatcher()

module.exports = {
  pgQueueDispatcher,
  PgQueueDispatcher,
  registerHandler,
  registerAllHandlers,
  KNOWN_OUTBOX_EVENT_TYPES,
  IGNORED_EVENT_TYPES,
  handlers
}
