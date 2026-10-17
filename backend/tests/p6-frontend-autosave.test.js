/**
 * tests/p6-frontend-autosave.test.js
 * Unit test suite for Frontend AutosaveManager and ServerClock.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// Replicate frontend autosave logic in isolated Node environment for automated testing
class TestAutosaveManager {
  constructor(options = {}) {
    this.attemptId = options.attemptId || 'att-123'
    this.currentRevision = options.initialRevision || 1
    this.dirtyMap = new Map()
    this.isFlushing = false
    this.isSubmitting = false
    this.backoffMs = 1000
    this.maxBackoffMs = 16000
    this.stableIdempotencyKey = null
    this.mockHttpHandler = options.mockHttpHandler || null
  }

  recordAnswer(attemptQuestionId, selectedOptionId) {
    const entry = {
      attemptQuestionId,
      selectedOptionId,
      revision: this.currentRevision,
      clientTimestamp: Date.now()
    }
    this.dirtyMap.set(attemptQuestionId, entry)
    return entry
  }

  hasDirtyAnswers() {
    return this.dirtyMap.size > 0
  }

  async flush() {
    if (this.dirtyMap.size === 0 || this.isFlushing) {
      return { saved: 0, status: 'SKIPPED' }
    }

    this.isFlushing = true
    const snapshot = Array.from(this.dirtyMap.values())

    try {
      const res = await this.mockHttpHandler('PUT', `/attempts/${this.attemptId}/answers`, {
        answers: snapshot.map(s => ({
          attemptQuestionId: s.attemptQuestionId,
          selectedOptionId: s.selectedOptionId
        })),
        revision: this.currentRevision
      })

      // On 200: remove saved answers
      for (const s of snapshot) {
        this.dirtyMap.delete(s.attemptQuestionId)
      }

      this.currentRevision = res.revision || (this.currentRevision + 1)
      this.backoffMs = 1000
      this.isFlushing = false
      return { saved: snapshot.length, status: 'SUCCESS', revision: this.currentRevision }
    } catch (err) {
      this.isFlushing = false

      if (err.status === 409 && err.currentRevision) {
        // 409 STALE_REVISION: adopt server revision and retry
        this.currentRevision = err.currentRevision
        return this.flush()
      }

      // On 429/503/Network Error: retain dirtyMap in memory!
      this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2)
      throw err
    }
  }

  async flushBeforeSubmit() {
    if (this.dirtyMap.size > 0) {
      await this.flush()
    }
  }

  getStableIdempotencyKey() {
    if (!this.stableIdempotencyKey) {
      this.stableIdempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    }
    return this.stableIdempotencyKey
  }

  async submitAttempt() {
    if (this.isSubmitting) throw new Error('Submission in progress')
    this.isSubmitting = true

    try {
      await this.flushBeforeSubmit()
      const key = this.getStableIdempotencyKey()
      const res = await this.mockHttpHandler('POST', `/attempts/${this.attemptId}/submit`, {}, {
        'Idempotency-Key': key
      })
      this.isSubmitting = false
      this.stableIdempotencyKey = null
      return res
    } catch (err) {
      this.isSubmitting = false
      // Keep stableIdempotencyKey intact for retry!
      throw err
    }
  }
}

class TestServerClock {
  constructor() {
    this.offsetMs = 0
  }
  synchronize(serverTime) {
    const epoch = typeof serverTime === 'number' ? serverTime : new Date(serverTime).getTime()
    this.offsetMs = epoch - Date.now()
  }
  now() {
    return Date.now() + this.offsetMs
  }
  getRemainingMs(expiresAt) {
    const deadlineMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()
    return Math.max(0, deadlineMs - this.now())
  }
}

describe('P6 Frontend AutosaveManager & ServerClock Unit Tests', () => {
  it('correctly tracks and buffers dirty answers in memory', () => {
    const manager = new TestAutosaveManager({ attemptId: 'att-1' })

    assert.equal(manager.hasDirtyAnswers(), false)

    manager.recordAnswer('q-1', 'opt-A')
    manager.recordAnswer('q-2', 'opt-B')

    assert.equal(manager.hasDirtyAnswers(), true)
    assert.equal(manager.dirtyMap.size, 2)
    assert.equal(manager.dirtyMap.get('q-1').selectedOptionId, 'opt-A')
  })

  it('flushes dirty answers and advances revision on success (200)', async () => {
    let receivedPayload = null

    const manager = new TestAutosaveManager({
      attemptId: 'att-1',
      initialRevision: 3,
      mockHttpHandler: async (method, path, body) => {
        receivedPayload = body
        return { success: true, saved: 2, revision: 4 }
      }
    })

    manager.recordAnswer('q-1', 'opt-A')
    manager.recordAnswer('q-2', 'opt-B')

    const res = await manager.flush()

    assert.equal(res.status, 'SUCCESS')
    assert.equal(res.saved, 2)
    assert.equal(res.revision, 4)
    assert.equal(manager.currentRevision, 4)
    assert.equal(manager.hasDirtyAnswers(), false)
    assert.equal(receivedPayload.answers.length, 2)
  })

  it('reconciles 409 STALE_REVISION by updating revision and re-flushing cleanly', async () => {
    let callCount = 0

    const manager = new TestAutosaveManager({
      attemptId: 'att-1',
      initialRevision: 2,
      mockHttpHandler: async (method, path, body) => {
        callCount++
        if (callCount === 1) {
          // Reject with 409 stale revision, server is on revision 5
          const err = new Error('Stale revision')
          err.status = 409
          err.currentRevision = 5
          throw err
        }
        // Second call succeeds with updated revision
        return { success: true, saved: 1, revision: 6 }
      }
    })

    manager.recordAnswer('q-1', 'opt-C')

    const res = await manager.flush()

    assert.equal(callCount, 2)
    assert.equal(res.status, 'SUCCESS')
    assert.equal(res.revision, 6)
    assert.equal(manager.currentRevision, 6)
    assert.equal(manager.hasDirtyAnswers(), false)
  })

  it('retains dirty state in memory on network/503 outage with exponential backoff', async () => {
    const manager = new TestAutosaveManager({
      attemptId: 'att-1',
      mockHttpHandler: async () => {
        const err = new Error('Service Unavailable')
        err.status = 503
        throw err
      }
    })

    manager.recordAnswer('q-1', 'opt-A')
    manager.recordAnswer('q-2', 'opt-B')

    assert.equal(manager.dirtyMap.size, 2)

    await assert.rejects(async () => {
      await manager.flush()
    })

    // Critical invariant: Answers must NOT be dropped on network failure!
    assert.equal(manager.hasDirtyAnswers(), true)
    assert.equal(manager.dirtyMap.size, 2)
    assert.equal(manager.backoffMs, 2000) // Backed off from 1000 to 2000
  })

  it('generates a stable Idempotency-Key and reuses the exact key across submit retries', async () => {
    let attemptNumber = 0
    let keyUsedAttempt1 = null
    let keyUsedAttempt2 = null

    const manager = new TestAutosaveManager({
      attemptId: 'att-1',
      mockHttpHandler: async (method, path, body, headers) => {
        attemptNumber++
        if (attemptNumber === 1) {
          keyUsedAttempt1 = headers['Idempotency-Key']
          throw new Error('Network timeout during submit')
        }
        keyUsedAttempt2 = headers['Idempotency-Key']
        return { status: 'SUBMITTED', score: null }
      }
    })

    // First submit attempt fails
    await assert.rejects(async () => {
      await manager.submitAttempt()
    })

    // Second submit attempt (user clicks retry)
    const result = await manager.submitAttempt()

    assert.equal(result.status, 'SUBMITTED')
    assert.ok(keyUsedAttempt1)
    assert.ok(keyUsedAttempt2)
    // Invariant: Both attempts must use the identical Idempotency-Key!
    assert.equal(keyUsedAttempt1, keyUsedAttempt2)
  })

  it('server clock accurately calculates offset and computes remaining time', () => {
    const clock = new TestServerClock()

    // Simulate client clock is 10 seconds ahead of server clock
    const serverTimestamp = Date.now() - 10000
    clock.synchronize(serverTimestamp)

    assert.ok(clock.offsetMs <= -9900 && clock.offsetMs >= -10100)

    // Deadline 60 seconds from server perspective
    const deadline = clock.now() + 60000
    const remaining = clock.getRemainingMs(deadline)

    assert.ok(remaining >= 59000 && remaining <= 61000)

    // Expired deadline clamps to 0
    const pastDeadline = clock.now() - 5000
    assert.equal(clock.getRemainingMs(pastDeadline), 0)
  })
})
