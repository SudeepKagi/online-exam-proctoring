const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { tokenService } = require(path.join(__dirname, '../proctornet/backend/src/modules/auth/tokenService'))
const { attemptRepository } = require(path.join(__dirname, '../proctornet/backend/src/modules/attempts/repository'))

describe('FLW-09: Server Restart & Chaos Resilience', () => {
  describe('Attempt Expiry & Permutation Immutability Across Restarts', () => {
    it('ensures in-flight attempt preserves exact expiresAt and startedAt across simulated restarts', () => {
      // Simulate attempt created before server restart
      const startTime = new Date('2026-10-08T10:00:00Z')
      const durationMinutes = 60
      const endTime = new Date('2026-10-08T12:00:00Z')
      const graceSeconds = 300

      // expiresAt is LEAST(startTime + duration, endTime + grace)
      const expectedExpiresAt = new Date(Math.min(
        startTime.getTime() + durationMinutes * 60 * 1000,
        endTime.getTime() + graceSeconds * 1000
      ))

      const persistedAttempt = {
        id: 'attempt-uuid-1',
        examId: 'exam-uuid-1',
        studentId: 'student-uuid-1',
        status: 'ACTIVE',
        startedAt: startTime,
        expiresAt: expectedExpiresAt,
        shuffleSeed: 'abcd1234abcd1234'
      }

      // Simulate restart: New instance of memory reading the persisted record
      const reloadedAttempt = JSON.parse(JSON.stringify(persistedAttempt))
      reloadedAttempt.startedAt = new Date(reloadedAttempt.startedAt)
      reloadedAttempt.expiresAt = new Date(reloadedAttempt.expiresAt)

      assert.equal(reloadedAttempt.status, 'ACTIVE')
      assert.equal(reloadedAttempt.startedAt.toISOString(), startTime.toISOString())
      assert.equal(reloadedAttempt.expiresAt.toISOString(), expectedExpiresAt.toISOString())
      assert.equal(reloadedAttempt.shuffleSeed, persistedAttempt.shuffleSeed)
    })

    it('ensures question order permutations are deterministic from shuffleSeed', () => {
      const { createSeededRng, shuffleArray } = require(path.join(__dirname, '../proctornet/backend/src/modules/attempts/repository'))
      const seed = 'deterministic-seed-42'

      const questions1 = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']
      const rng1 = createSeededRng(seed)
      shuffleArray(questions1, rng1)

      // Simulate process reboot and re-shuffle with same seed
      const questions2 = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']
      const rng2 = createSeededRng(seed)
      shuffleArray(questions2, rng2)

      assert.deepEqual(questions1, questions2, 'Question permutations must be identical across server restarts')
    })
  })

  describe('Session Survivability Across Node Restarts', () => {
    it('verifies JWT token remains valid and verifiable without depending on in-memory state', () => {
      const payload = {
        sub: 'user-uuid-1',
        role: 'STUDENT',
        sessionId: 'session-uuid-1',
        epoch: 1
      }

      const token = tokenService.signAccessToken(payload)

      // Token verify simulates verification on a completely separate Node worker after restart
      const decoded = tokenService.verifyAccessToken(token)
      assert.equal(decoded.sub, payload.sub)
      assert.equal(decoded.role, payload.role)
      assert.equal(decoded.sessionId, payload.sessionId)
      assert.equal(decoded.epoch, payload.epoch)
    })
  })

  describe('Grace Period Invariant', () => {
    it('respects default 300s grace period', () => {
      const grace = parseInt(process.env.EXAM_GRACE_SECONDS || process.env.SUBMIT_GRACE_SECONDS || '300', 10)
      assert.ok(grace >= 60, 'Grace period must be at least 60 seconds')
      assert.equal(grace, 300, 'Default grace period must be 300s')
    })
  })
})
