/**
 * examClock.js
 * Authoritative, unified time rules and expiry calculations (ADR-004 / Finding F8).
 * Ensures identical expiry formulas and grace windows across all start paths,
 * resume transitions, answer saving, submission, and sweeper reconciliation.
 */

const SUBMIT_GRACE_SECONDS = parseInt(process.env.SUBMIT_GRACE_SECONDS || '10', 10)
const SWEEP_GRACE_SECONDS = parseInt(process.env.SWEEP_GRACE_SECONDS || '30', 10)
const EXAM_GRACE_SECONDS = parseInt(process.env.EXAM_GRACE_SECONDS || '300', 10)
const ANSWER_CUTOFF_GRACE_SECONDS = parseInt(process.env.ANSWER_CUTOFF_GRACE_SECONDS || '0', 10)

const EXAM_CLOCK_CONFIG = Object.freeze({
  answerCutoff: ANSWER_CUTOFF_GRACE_SECONDS,
  submitGrace: SUBMIT_GRACE_SECONDS,
  sweepGrace: SWEEP_GRACE_SECONDS,
  endGrace: EXAM_GRACE_SECONDS
})

/**
 * Authoritative calculation of attempt expiry timestamp.
 * Formula: LEAST(startTime + duration, examEndTime + endGrace)
 *
 * @param {Object} params
 * @param {Date|string|number} [params.startTime] - Time the attempt was activated (defaults to now)
 * @param {number} params.durationMinutes - Exam duration in minutes
 * @param {Date|string|number} params.examEndTime - Scheduled end time of the exam
 * @param {number} [params.endGraceSeconds] - Extra grace period past exam end time (default: EXAM_GRACE_SECONDS = 300s)
 * @returns {Date} Authoritative expires_at timestamp
 */
function calculateAttemptExpiry({
  startTime = new Date(),
  durationMinutes,
  examEndTime,
  endGraceSeconds = EXAM_GRACE_SECONDS
}) {
  const startMs = new Date(startTime).getTime()
  const durationMs = Number(durationMinutes || 60) * 60 * 1000
  const normalExpiryMs = startMs + durationMs

  const endMs = new Date(examEndTime).getTime()
  const graceMs = Number(endGraceSeconds) * 1000
  const maxAllowedMs = endMs + graceMs

  return new Date(Math.min(normalExpiryMs, maxAllowedMs))
}

/**
 * Check whether an attempt has exceeded its normal expiry deadline
 */
function isAttemptExpired(expiresAt, graceSeconds = 0, now = new Date()) {
  if (!expiresAt) return false
  const expiryMs = new Date(expiresAt).getTime()
  const nowMs = new Date(now).getTime()
  return nowMs > (expiryMs + (graceSeconds * 1000))
}

/**
 * Check whether a student is within the allowed submit window (expiresAt + submitGrace)
 */
function canSubmitAttempt(expiresAt, submitGraceSeconds = SUBMIT_GRACE_SECONDS, now = new Date()) {
  if (!expiresAt) return true
  const expiryMs = new Date(expiresAt).getTime()
  const nowMs = new Date(now).getTime()
  return nowMs <= (expiryMs + (submitGraceSeconds * 1000))
}

/**
 * Check whether an answer save is permitted (hard cutoff at expiresAt + answerCutoffGrace)
 */
function canSaveAnswer(expiresAt, answerCutoffGraceSeconds = ANSWER_CUTOFF_GRACE_SECONDS, now = new Date()) {
  if (!expiresAt) return true
  const expiryMs = new Date(expiresAt).getTime()
  const nowMs = new Date(now).getTime()
  return nowMs <= (expiryMs + (answerCutoffGraceSeconds * 1000))
}

/**
 * Check whether an attempt is eligible for background sweeper expiry (expiresAt + sweepGrace)
 */
function isSweeperEligible(expiresAt, sweepGraceSeconds = SWEEP_GRACE_SECONDS, now = new Date()) {
  if (!expiresAt) return false
  const expiryMs = new Date(expiresAt).getTime()
  const nowMs = new Date(now).getTime()
  return nowMs > (expiryMs + (sweepGraceSeconds * 1000))
}

module.exports = {
  SUBMIT_GRACE_SECONDS,
  SWEEP_GRACE_SECONDS,
  EXAM_GRACE_SECONDS,
  ANSWER_CUTOFF_GRACE_SECONDS,
  EXAM_CLOCK_CONFIG,
  calculateAttemptExpiry,
  isAttemptExpired,
  canSubmitAttempt,
  canSaveAnswer,
  isSweeperEligible
}
