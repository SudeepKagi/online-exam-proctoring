const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'

const BACKEND_ROOT = path.resolve(__dirname, '../proctornet/backend')
const {
  calculateAttemptExpiry,
  isAttemptExpired,
  canSubmitAttempt,
  canSaveAnswer,
  isSweeperEligible,
  EXAM_CLOCK_CONFIG,
  SUBMIT_GRACE_SECONDS,
  SWEEP_GRACE_SECONDS,
  EXAM_GRACE_SECONDS,
  ANSWER_CUTOFF_GRACE_SECONDS
} = require(path.join(BACKEND_ROOT, 'src/modules/exams/examClock'))

describe('F8 — Unified examClock module & consistent time rules', () => {
  const examStart = new Date('2026-10-10T10:00:00.000Z')
  const examEnd = new Date('2026-10-10T11:00:00.000Z') // 60 min window
  const duration = 30 // 30 min duration

  it('F8.1: early/on-time student gets full duration', () => {
    // Student starts at 10:05 (window ends at 11:00, cap is 11:05 with 300s grace)
    // 10:05 + 30 min = 10:35 (< 11:05)
    const startTime = new Date('2026-10-10T10:05:00.000Z')
    const expiry = calculateAttemptExpiry({
      startTime,
      durationMinutes: duration,
      examEndTime: examEnd
    })

    assert.strictEqual(expiry.toISOString(), '2026-10-10T10:35:00.000Z')
  })

  it('F8.2: late joiner is capped at examEndTime + EXAM_GRACE_SECONDS', () => {
    // Student starts at 10:45 (duration 30m -> 11:15)
    // Exam ends at 11:00 + 300s (5m) grace -> 11:05
    // Expiry must be capped at 11:05:00.000Z
    const startTime = new Date('2026-10-10T10:45:00.000Z')
    const expiry = calculateAttemptExpiry({
      startTime,
      durationMinutes: duration,
      examEndTime: examEnd
    })

    assert.strictEqual(expiry.toISOString(), '2026-10-10T11:05:00.000Z')
  })

  it('F8.3: answer saving is rejected at expires_at + 1s (0s grace)', () => {
    const expiresAt = new Date('2026-10-10T10:30:00.000Z')

    // At 10:29:59 (before expiry) -> allowed
    assert.strictEqual(canSaveAnswer(expiresAt, ANSWER_CUTOFF_GRACE_SECONDS, new Date('2026-10-10T10:29:59.000Z')), true)

    // At 10:30:00 (exact deadline) -> allowed
    assert.strictEqual(canSaveAnswer(expiresAt, ANSWER_CUTOFF_GRACE_SECONDS, new Date('2026-10-10T10:30:00.000Z')), true)

    // At 10:30:01 (1s past expiry) -> rejected
    assert.strictEqual(canSaveAnswer(expiresAt, ANSWER_CUTOFF_GRACE_SECONDS, new Date('2026-10-10T10:30:01.000Z')), false)
  })

  it('F8.4: exam submission is accepted inside submitGrace (10s) and rejected after', () => {
    const expiresAt = new Date('2026-10-10T10:30:00.000Z')

    // At 10:30:05 (5s past expiry, inside 10s grace) -> allowed
    assert.strictEqual(canSubmitAttempt(expiresAt, SUBMIT_GRACE_SECONDS, new Date('2026-10-10T10:30:05.000Z')), true)

    // At 10:30:10 (exact 10s boundary) -> allowed
    assert.strictEqual(canSubmitAttempt(expiresAt, SUBMIT_GRACE_SECONDS, new Date('2026-10-10T10:30:10.000Z')), true)

    // At 10:30:11 (11s past expiry, outside 10s grace) -> rejected
    assert.strictEqual(canSubmitAttempt(expiresAt, SUBMIT_GRACE_SECONDS, new Date('2026-10-10T10:30:11.000Z')), false)
  })

  it('F8.5: sweeper honors sweepGrace (30s) before auto-expiring abandoned attempts', () => {
    const expiresAt = new Date('2026-10-10T10:30:00.000Z')

    // At 10:30:20 (20s past expiry) -> NOT yet eligible for sweeper
    assert.strictEqual(isSweeperEligible(expiresAt, SWEEP_GRACE_SECONDS, new Date('2026-10-10T10:30:20.000Z')), false)

    // At 10:30:31 (31s past expiry) -> eligible for sweeper
    assert.strictEqual(isSweeperEligible(expiresAt, SWEEP_GRACE_SECONDS, new Date('2026-10-10T10:30:31.000Z')), true)
  })

  it('F8.6: EXAM_CLOCK_CONFIG exports frozen canonical grace constants', () => {
    assert.strictEqual(EXAM_CLOCK_CONFIG.submitGrace, 10)
    assert.strictEqual(EXAM_CLOCK_CONFIG.sweepGrace, 30)
    assert.strictEqual(EXAM_CLOCK_CONFIG.endGrace, 300)
    assert.strictEqual(EXAM_CLOCK_CONFIG.answerCutoff, 0)
    assert.ok(Object.isFrozen(EXAM_CLOCK_CONFIG))
  })
})
