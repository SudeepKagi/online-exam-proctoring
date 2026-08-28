/**
 * sessionStateMachine.js
 * Authoritative lifecycle state machine for ProctorNet examination sessions.
 * Enforces valid state transitions, timing constraints, and atomic multi-record mutations.
 */

const { syncWireGuardRemovePeer } = require('./vpnService')

// ── Canonical Session States ──
const SESSION_STATES = {
  PENDING: 'PENDING',                   // Enrolled or initialized, pre-check not complete
  SECURITY_CHECK: 'SECURITY_CHECK',     // Currently completing hardware & VPN verification
  READY: 'READY',                       // All security checks passed, holding in pre-exam kiosk
  ACTIVE: 'ACTIVE',                     // Candidate actively taking examination
  SUSPENDED: 'SUSPENDED',               // Temporarily suspended (VPN drop or proctor pause)
  SUBMITTED: 'SUBMITTED',               // Candidate completed & submitted test (Terminal)
  TERMINATED: 'TERMINATED',             // Proctor issued misconduct termination order (Terminal)
  ENDED: 'ENDED'                        // Official exam window closed (Terminal)
}

// ── Valid Transition Graph ──
const VALID_TRANSITIONS = {
  [SESSION_STATES.PENDING]: [
    SESSION_STATES.SECURITY_CHECK,
    SESSION_STATES.ACTIVE,              // Direct start if proctoring not configured
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.SECURITY_CHECK]: [
    SESSION_STATES.READY,
    SESSION_STATES.ACTIVE,
    SESSION_STATES.PENDING,              // Reset if user leaves or fails
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.READY]: [
    SESSION_STATES.ACTIVE,
    SESSION_STATES.SUSPENDED,
    SESSION_STATES.SECURITY_CHECK,
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.ACTIVE]: [
    SESSION_STATES.SUSPENDED,
    SESSION_STATES.SUBMITTED,
    SESSION_STATES.TERMINATED,
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.SUSPENDED]: [
    SESSION_STATES.ACTIVE,               // Resumed after VPN reconnect or proctor unpause
    SESSION_STATES.SUBMITTED,            // Auto-submitted when deadline passes during suspension
    SESSION_STATES.TERMINATED,
    SESSION_STATES.ENDED
  ],
  // Terminal states have no valid exits
  [SESSION_STATES.SUBMITTED]: [],
  [SESSION_STATES.TERMINATED]: [],
  [SESSION_STATES.ENDED]: []
}

/**
 * Check if a requested state transition is valid
 */
function isValidTransition(fromState, toState) {
  if (!fromState || !toState) return false
  if (fromState === toState) return true // Idempotent no-op

  const allowedTargets = VALID_TRANSITIONS[fromState] || []
  return allowedTargets.includes(toState)
}

/**
 * Centrally transition an examination session with transaction safety and audit logging.
 *
 * @param {object} params
 * @param {string} params.studentExamId - ID of StudentExam record
 * @param {string} params.targetStatus - Desired target status from SESSION_STATES
 * @param {string} [params.reason] - Explanation for termination/suspension/pause
 * @param {object} [params.reqUser] - Authenticated user initiating transition
 * @param {object} [params.io] - Socket.io instance for event broadcast
 * @param {object} [params.metadata] - Extra metadata to record in EvidenceLog
 */
async function transitionExamSession({
  studentExamId,
  targetStatus,
  reason = null,
  reqUser = null,
  io = null,
  metadata = {}
}) {
  const prisma = global.prisma

  // Execute transition inside an atomic database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch current session with associated Exam details
    const session = await tx.studentExam.findUnique({
      where: { id: studentExamId },
      include: {
        exam: true,
        student: { select: { id: true, name: true, usn: true } }
      }
    })

    if (!session) {
      const err = new Error('Examination session record not found.')
      err.code = 'SESSION_NOT_FOUND'
      err.status = 404
      throw err
    }

    const currentStatus = session.status

    // 2. Idempotency Check: if already in target state, return cleanly
    if (currentStatus === targetStatus) {
      return {
        session,
        transitioned: false,
        message: `Session is already in state '${targetStatus}'.`
      }
    }

    // 3. Transition Validation
    if (!isValidTransition(currentStatus, targetStatus)) {
      const err = new Error(
        `Invalid session transition from '${currentStatus}' to '${targetStatus}'.`
      )
      err.code = 'INVALID_STATE_TRANSITION'
      err.status = 400
      throw err
    }

    // 4. Timing Validation: Cannot activate if past exam endTime + 5 min grace
    if (targetStatus === SESSION_STATES.ACTIVE) {
      const now = new Date()
      const endWithGrace = new Date(new Date(session.exam.endTime).getTime() + 5 * 60 * 1000)
      if (now > endWithGrace) {
        const err = new Error('Examination window has closed. Session cannot be activated.')
        err.code = 'EXAM_ENDED'
        err.status = 403
        throw err
      }
    }

    // 5. Build Update Payload
    const updateData = { status: targetStatus }
    const now = new Date()

    if (targetStatus === SESSION_STATES.ACTIVE) {
      if (!session.startedAt) {
        updateData.startedAt = now
      }
    } else if (targetStatus === SESSION_STATES.SUBMITTED) {
      updateData.submittedAt = session.submittedAt || now
    } else if (targetStatus === SESSION_STATES.TERMINATED) {
      updateData.submittedAt = session.submittedAt || now
      updateData.terminationReason = reason || 'Terminated by Invigilator for academic integrity violation.'
    }

    // 6. Apply State Mutation
    const updatedSession = await tx.studentExam.update({
      where: { id: studentExamId },
      data: updateData
    })

    // 7. Audit & Evidence Logging for sensitive transitions
    if (targetStatus === SESSION_STATES.TERMINATED || targetStatus === SESSION_STATES.SUSPENDED) {
      await tx.evidenceLog.create({
        data: {
          studentExamId: session.id,
          eventType: targetStatus === SESSION_STATES.TERMINATED ? 'EXAM_TERMINATED' : 'EXAM_SUSPENDED',
          severity: targetStatus === SESSION_STATES.TERMINATED ? 'CRITICAL' : 'HIGH',
          details: reason || (targetStatus === SESSION_STATES.TERMINATED ? 'Misconduct Termination' : 'Session Suspended'),
          invAction: targetStatus,
          invActionNote: reason,
          timestamp: now
        }
      }).catch(e => console.warn('[sessionStateMachine] EvidenceLog note:', e.message))
    }

    // 8. Clean up WireGuard VPN isolation peer on Terminal states
    if (targetStatus === SESSION_STATES.SUBMITTED || targetStatus === SESSION_STATES.TERMINATED) {
      if (session.vpnKey) {
        try {
          syncWireGuardRemovePeer(session.vpnKey)
        } catch (e) {
          console.warn('[sessionStateMachine] WireGuard remove peer note:', e.message)
        }
      }
    }

    return {
      session: updatedSession,
      previousStatus: currentStatus,
      transitioned: true,
      exam: session.exam,
      student: session.student
    }
  })

  // 9. Real-Time Broadcast outside transaction
  if (io && result.transitioned) {
    const { student, exam, session } = result
    const payload = {
      examId: exam.id,
      studentId: student.id,
      studentName: student.name,
      studentUsn: student.usn,
      previousStatus: result.previousStatus,
      currentStatus: session.status,
      reason,
      timestamp: new Date().toISOString()
    }

    // Broadcast to student room
    io.to(`student:${student.id}`).emit('exam:state', payload)

    // Specific event for termination
    if (session.status === SESSION_STATES.TERMINATED) {
      io.to(`student:${student.id}`).emit('exam:terminated', {
        reason: reason || 'Terminated by Invigilator',
        timestamp: payload.timestamp
      })
    } else if (session.status === SESSION_STATES.SUSPENDED) {
      io.to(`student:${student.id}`).emit('exam:suspended', {
        reason: reason || 'Session suspended',
        timestamp: payload.timestamp
      })
    }

    // Broadcast to invigilator console
    io.to(`inv:${exam.id}`).emit('student:stateChange', payload)
  }

  return result
}

module.exports = {
  SESSION_STATES,
  VALID_TRANSITIONS,
  isValidTransition,
  transitionExamSession
}
