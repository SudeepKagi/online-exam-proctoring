const { prisma } = require('../../infra/postgres/client')
const { ConflictError, NotFoundError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

/**
 * Strict Exam Attempt State Machine (ADR-004 / Notion 13.15)
 * Transitions are encoded as set-based conditional SQL updates.
 */
const ALLOWED_TRANSITIONS = {
  READY: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['SUSPENDED', 'SUBMITTED', 'TERMINATED', 'EXPIRED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED', 'EXPIRED'],
  SUBMITTED: [],   // Terminal state
  TERMINATED: [],  // Terminal state
  EXPIRED: []      // Terminal state
}

const TERMINAL_STATES = ['SUBMITTED', 'TERMINATED', 'EXPIRED']

class AttemptStateMachine {
  /**
   * Transition attempt state conditionally in SQL without read-modify-write races
   */
  async transition(attemptId, toStatus, options = {}) {
    const {
      actorId = null,
      actorRole = 'system',
      reason = null,
      metadata = {}
    } = options

    const target = toStatus.toUpperCase()

    // Determine allowed source states for this target
    const allowedFrom = Object.entries(ALLOWED_TRANSITIONS)
      .filter(([_, targets]) => targets.includes(target))
      .map(([source]) => source)

    if (allowedFrom.length === 0) {
      throw new ConflictError(`Invalid state transition: Cannot transition to state '${target}'`)
    }

    // Prepare side-effect SQL clauses
    let updateClauses = [`status = $2::"AttemptStatus"`]
    const params = [attemptId, target, allowedFrom]

    // Handle SUSPENDED -> ACTIVE (resume): calculate paused duration and extend expires_at
    if (target === 'ACTIVE') {
      updateClauses.push(`
        total_suspended_ms = total_suspended_ms + CASE
          WHEN suspended_at IS NOT NULL THEN GREATEST(0, (EXTRACT(EPOCH FROM (now() - suspended_at)) * 1000)::int)
          ELSE 0
        END,
        expires_at = CASE
          WHEN suspended_at IS NOT NULL AND expires_at IS NOT NULL
            THEN expires_at + (now() - suspended_at)
          ELSE expires_at
        END,
        suspended_at = NULL
      `)
    } else if (target === 'SUSPENDED') {
      updateClauses.push(`suspended_at = now()`)
    } else if (target === 'SUBMITTED') {
      updateClauses.push(`submitted_at = now()`)
    }

    if (reason) {
      params.push(reason)
      updateClauses.push(`termination_reason = $${params.length}`)
    }

    // Execute atomic conditional update
    const sql = `
      UPDATE exam_attempts
      SET ${updateClauses.join(', ')}
      WHERE id = $1::uuid
        AND status = ANY($3::"AttemptStatus"[])
      RETURNING *;
    `

    const updatedRows = await prisma.$queryRawUnsafe(sql, ...params)

    if (!updatedRows || updatedRows.length === 0) {
      // Diagnostic query: diagnose why 0 rows updated
      const current = await prisma.examAttempt.findUnique({
        where: { id: attemptId }
      })

      if (!current) {
        throw new NotFoundError(`Attempt '${attemptId}' not found`)
      }

      throw new ConflictError(
        `Cannot transition attempt '${attemptId}' from current state '${current.status}' to '${target}'. Allowed origins: [${allowedFrom.join(', ')}]`,
        'INVALID_STATE_TRANSITION',
        { currentStatus: current.status, targetStatus: target }
      )
    }

    const updated = updatedRows[0]

    // Audit log & outbox event for terminal state side effects in same transaction
    await prisma.$transaction(async (tx) => {
      // 1. Audit log
      await tx.$executeRawUnsafe(`
        INSERT INTO audit_logs (attempt_id, actor_id, actor_role, action, metadata, timestamp)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, now());
      `, attemptId, actorId, actorRole, `ATTEMPT_STATE_CHANGE_${target}`, JSON.stringify({
        from: allowedFrom,
        to: target,
        reason,
        ...metadata
      }))

      // 2. Outbox event if terminal state (for async VPN peer removal, LiveKit cleanup, WS notify)
      if (TERMINAL_STATES.includes(target)) {
        await tx.$executeRawUnsafe(`
          INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
          VALUES ($1, $2::jsonb, 'PENDING', now());
        `, `attempt.${target.toLowerCase()}`, JSON.stringify({
          attemptId: updated.id,
          examId: updated.exam_id,
          studentId: updated.student_id,
          status: target,
          reason
        }))

        // VPN cleanup on terminal states when VPN is enabled (P8 Task 6)
        if (process.env.VPN_ENABLED === 'true') {
          const activePeer = await tx.vpnPeer.findFirst({
            where: { attemptId: updated.id, isActive: true }
          }).catch(() => null)

          if (activePeer) {
            await tx.vpnPeer.updateMany({
              where: { attemptId: updated.id, isActive: true },
              data: { isActive: false }
            })
            await tx.$executeRawUnsafe(`
              UPDATE vpn_ip_pool SET attempt_id = null, released_at = now()
              WHERE attempt_id = $1::uuid;
            `, updated.id).catch(() => {})

            await tx.$executeRawUnsafe(`
              INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
              VALUES ('vpn.peer.remove', $1::jsonb, 'PENDING', now());
            `, JSON.stringify({
              attemptId: updated.id,
              publicKey: activePeer.publicKey
            }))
          }
        }
      }
    }, { maxWait: 2000, timeout: 5000 }).catch(err => {
      logger.error({ error: err.message, attemptId }, 'Failed to record audit/outbox for state transition')
    })

    // Disconnect participant from LiveKit SFU on terminal states (P7 Task 7.2)
    if (TERMINAL_STATES.includes(target) && updated.exam_id) {
      try {
        const { mediaService } = require('../media/media.service')
        mediaService.removeParticipant(updated.exam_id, `student:${updated.id}`).catch(() => {})
      } catch (err) {
        // ignore in mock environments
      }
    }

    return updated
  }

  isTerminal(status) {
    return TERMINAL_STATES.includes(status?.toUpperCase())
  }
}

const attemptStateMachine = new AttemptStateMachine()

module.exports = {
  attemptStateMachine,
  AttemptStateMachine,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES
}
