/**
 * sessionStateMachine.js
 * Authoritative lifecycle state machine for ProctorNet examination sessions.
 * Canonical states and transition validity.
 */

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

const VALID_TRANSITIONS = {
  [SESSION_STATES.PENDING]: [
    SESSION_STATES.SECURITY_CHECK,
    SESSION_STATES.ACTIVE,
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.SECURITY_CHECK]: [
    SESSION_STATES.READY,
    SESSION_STATES.ACTIVE,
    SESSION_STATES.PENDING,
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
    SESSION_STATES.ACTIVE,
    SESSION_STATES.SUBMITTED,
    SESSION_STATES.TERMINATED,
    SESSION_STATES.ENDED
  ],
  [SESSION_STATES.SUBMITTED]: [],
  [SESSION_STATES.TERMINATED]: [],
  [SESSION_STATES.ENDED]: []
}

function isValidTransition(fromState, toState) {
  if (!fromState || !toState) return false
  if (fromState === toState) return true // Idempotent no-op

  const allowedTargets = VALID_TRANSITIONS[fromState] || []
  return allowedTargets.includes(toState)
}

module.exports = {
  SESSION_STATES,
  VALID_TRANSITIONS,
  isValidTransition
}
