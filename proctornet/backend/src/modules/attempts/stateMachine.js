const { prisma } = require('../../infra/postgres/client')
const { ConflictError, NotFoundError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

/**
 * Strict Exam Attempt State Machine (ADR-004 / Notion 13.15 / C-04)
 * Transitions are encoded as single CTE statements (Appendix C) for update + audit + outbox.
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
   * Transition attempt state atomically via single CTE statement (Appendix C / C-04)
   * Atomic: update + audit + outbox in ONE query.
   */
  async transition(attemptId, toStatus, options = {}) {
    const {
      actorId = null,
      actorRole = 'system',
      reason = null,
      metadata = {},
      isGuardedStart = false,
      graceSeconds = parseInt(process.env.EXAM_GRACE_SECONDS || process.env.SUBMIT_GRACE_SECONDS || '300', 10)
    } = options

    const target = toStatus.toUpperCase()

    // Determine allowed source states for this target
    let allowedFrom = Object.entries(ALLOWED_TRANSITIONS)
      .filter(([_, targets]) => targets.includes(target))
      .map(([source]) => source)

    if (allowedFrom.length === 0) {
      throw new ConflictError(`Invalid state transition: Cannot transition to state '${target}'`)
    }

    // Guard READY -> ACTIVE: only permissible through the guarded start path
    if (target === 'ACTIVE' && !isGuardedStart) {
      allowedFrom = allowedFrom.filter(s => s !== 'READY')
    }

    const shouldEmitOutbox = TERMINAL_STATES.includes(target) || Boolean(options.emitOutbox)
    const outboxEventType = `attempt.${target.toLowerCase()}`
    const auditAction = `ATTEMPT_STATE_CHANGE_${target}`
    const auditMetadata = JSON.stringify({
      from: allowedFrom,
      to: target,
      reason,
      ...metadata
    })

    // Single CTE SQL Statement (Appendix C / C-04)
    const sql = `
      WITH updated_attempt AS (
        UPDATE exam_attempts ea
        SET 
          status = $2::"AttemptStatus",
          status_reason = $4,
          termination_reason = CASE
            WHEN $2::"AttemptStatus" = 'TERMINATED' THEN COALESCE($4, ea.termination_reason)
            ELSE ea.termination_reason
          END,
          started_at = CASE
            WHEN $2::"AttemptStatus" = 'ACTIVE' AND ea.started_at IS NULL THEN now()
            ELSE ea.started_at
          END,
          suspended_at = CASE
            WHEN $2::"AttemptStatus" = 'SUSPENDED' THEN now()
            WHEN $2::"AttemptStatus" = 'ACTIVE' THEN NULL
            ELSE ea.suspended_at
          END,
          submitted_at = CASE
            WHEN $2::"AttemptStatus" = 'SUBMITTED' THEN now()
            ELSE ea.submitted_at
          END,
          total_suspended_ms = ea.total_suspended_ms + CASE
            WHEN $2::"AttemptStatus" = 'ACTIVE' AND ea.suspended_at IS NOT NULL
              THEN GREATEST(0, (EXTRACT(EPOCH FROM (now() - ea.suspended_at)) * 1000)::int)
            ELSE 0
          END,
          expires_at = CASE
            WHEN $2::"AttemptStatus" = 'ACTIVE' AND ea.status = 'READY'
              THEN LEAST(now() + (e.duration || ' minutes')::interval, e.end_time + ($9 || ' seconds')::interval)
            WHEN $2::"AttemptStatus" = 'ACTIVE' AND ea.suspended_at IS NOT NULL AND ea.expires_at IS NOT NULL
              THEN LEAST(ea.expires_at + (now() - ea.suspended_at), e.end_time + ($9 || ' seconds')::interval)
            ELSE ea.expires_at
          END
        FROM exams e
        WHERE ea.exam_id = e.id
          AND ea.id = $1::uuid
          AND ea.status = ANY($3::"AttemptStatus"[])
        RETURNING ea.*
      ),
      inserted_audit AS (
        INSERT INTO audit_logs (attempt_id, actor_id, actor_role, action, metadata, timestamp)
        SELECT 
          ua.id, 
          $5::uuid, 
          $6, 
          $7, 
          $8::jsonb, 
          now()
        FROM updated_attempt ua
        RETURNING id
      ),
      inserted_outbox AS (
        INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
        SELECT 
          $10,
          jsonb_build_object(
            'attemptId', ua.id,
            'examId', ua.exam_id,
            'studentId', ua.student_id,
            'status', ua.status,
            'reason', ua.status_reason
          ),
          'PENDING',
          now()
        FROM updated_attempt ua
        WHERE $11::boolean = true
        RETURNING id
      )
      SELECT * FROM updated_attempt;
    `

    const updatedRows = await prisma.$queryRawUnsafe(
      sql,
      attemptId,              // $1
      target,                 // $2
      allowedFrom,            // $3
      reason,                 // $4
      actorId || null,        // $5
      actorRole,              // $6
      auditAction,            // $7
      auditMetadata,          // $8
      graceSeconds.toString(),// $9
      outboxEventType,        // $10
      shouldEmitOutbox        // $11
    )

    if (!updatedRows || updatedRows.length === 0) {
      const current = await prisma.examAttempt.findUnique({
        where: { id: attemptId }
      })

      if (!current) {
        throw new NotFoundError(`Attempt '${attemptId}' not found`)
      }

      if (current.status === 'READY' && target === 'ACTIVE' && !isGuardedStart) {
        throw new ConflictError(
          `Cannot transition attempt '${attemptId}' from 'READY' to 'ACTIVE'. READY->ACTIVE transition is only permitted through the guarded start path.`,
          'GUARDED_START_REQUIRED',
          { currentStatus: current.status, targetStatus: target }
        )
      }

      throw new ConflictError(
        `Cannot transition attempt '${attemptId}' from current state '${current.status}' to '${target}'. Allowed origins: [${allowedFrom.join(', ')}]`,
        'INVALID_STATE_TRANSITION',
        { currentStatus: current.status, targetStatus: target }
      )
    }

    const updated = updatedRows[0]

    // VPN cleanup on terminal states when VPN is enabled (P8 Task 6)
    if (TERMINAL_STATES.includes(target) && process.env.VPN_ENABLED === 'true') {
      try {
        const activePeer = await prisma.vpnPeer.findFirst({
          where: { attemptId: updated.id, isActive: true }
        }).catch(() => null)

        if (activePeer) {
          await prisma.vpnPeer.updateMany({
            where: { attemptId: updated.id, isActive: true },
            data: { isActive: false }
          })
          await prisma.$executeRawUnsafe(`
            UPDATE vpn_ip_pool SET attempt_id = null, released_at = now()
            WHERE attempt_id = $1::uuid;
          `, updated.id).catch(() => {})

          await prisma.$executeRawUnsafe(`
            INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
            VALUES ('vpn.peer.remove', $1::jsonb, 'PENDING', now());
          `, JSON.stringify({
            attemptId: updated.id,
            publicKey: activePeer.publicKey
          })).catch(() => {})
        }
      } catch (err) {
        logger.error({ error: err.message, attemptId }, 'Failed post-transition VPN cleanup')
      }
    }

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
