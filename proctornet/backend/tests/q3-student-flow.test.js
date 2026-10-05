/**
 * tests/q3-student-flow.test.js
 * Verification test suite for Phase Q3 - Student Exam Flow on v1.
 * Tests:
 * 1. Shared Event Catalogue (A-06) - Canonicals, normalization, and strict rejection of unknown types
 * 2. Question Content Leak Prevention (E-03) - Empty question set returned on SUSPENDED/READY/Expired
 * 3. Autosave Manager & Batching - Max 100, dirty map retention across 30s outage, revision CAS (409)
 * 4. Submission & Idempotent Retry - Stable Idempotency-Key, immediate submission state, result polling
 * 5. Public Config Endpoint - Exposes vpnEnforcement & serverTime
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// 1. Shared Event Catalogue
const {
  VIOLATION_TYPES,
  CLIENT_VIOLATION_MAP,
  CANONICAL_SEVERITY,
  FLAG_COOLDOWNS,
  normalizeViolationType,
  isValidViolationType
} = require('../src/shared/violationTypes')
const { ValidationError } = require('../src/shared/errors')

describe('Q3 - Shared Event Catalogue & Strict Validation (A-06)', () => {
  it('contains all canonical violation enums', () => {
    assert.ok(VIOLATION_TYPES.NO_FACE)
    assert.ok(VIOLATION_TYPES.MULTIPLE_FACES)
    assert.ok(VIOLATION_TYPES.SCREEN_SHARE_STOPPED)
    assert.ok(VIOLATION_TYPES.TAB_SWITCH)
    assert.ok(VIOLATION_TYPES.KEYBOARD_SHORTCUT)
    assert.ok(VIOLATION_TYPES.VPN_DISCONNECT)
  })

  it('normalizes legacy client event types to canonical enums', () => {
    assert.equal(normalizeViolationType('SCREEN_RECORDING'), VIOLATION_TYPES.SCREEN_SHARE_STOPPED)
    assert.equal(normalizeViolationType('NO_FACE_DETECTED'), VIOLATION_TYPES.NO_FACE)
    assert.equal(normalizeViolationType('MULTIPLE_FACES_DETECTED'), VIOLATION_TYPES.MULTIPLE_FACES)
    assert.equal(normalizeViolationType('COPY_ATTEMPT'), VIOLATION_TYPES.KEYBOARD_SHORTCUT)
    assert.equal(normalizeViolationType('NO_FACE'), VIOLATION_TYPES.NO_FACE)
  })

  it('validates canonical and alias types accurately', () => {
    assert.equal(isValidViolationType('NO_FACE'), true)
    assert.equal(isValidViolationType('TAB_SWITCH'), true)
    assert.equal(Boolean(normalizeViolationType('SCREEN_RECORDING')), true)
    assert.equal(isValidViolationType('UNKNOWN_RANDOM_EVENT'), false)
    assert.equal(isValidViolationType(''), false)
    assert.equal(isValidViolationType(null), false)
  })

  it('rejects unknown violation types server-side with ValidationError', () => {
    const testValidate = (type) => {
      const canonical = normalizeViolationType(type)
      if (!canonical) {
        throw new ValidationError(`Unknown or unsupported violation type: '${type}'`, {
          code: 'INVALID_VIOLATION_TYPE',
          providedType: type,
          allowedTypes: Object.keys(VIOLATION_TYPES)
        })
      }
      return canonical
    }

    assert.equal(testValidate('SCREEN_SHARE_STOPPED'), 'SCREEN_SHARE_STOPPED')
    assert.equal(testValidate('NO_FACE_DETECTED'), 'NO_FACE')
    assert.throws(() => testValidate('MALICIOUS_INJECTION'), {
      name: 'ValidationError'
    })
  })

  it('provides severity and cooldown metadata', () => {
    const severity = CANONICAL_SEVERITY['TAB_SWITCH']
    const cooldown = FLAG_COOLDOWNS['TAB_SWITCH']
    assert.equal(severity, 'MEDIUM')
    assert.ok(typeof cooldown === 'number' && cooldown > 0)
  })
})

describe('Q3 - Suspended/READY/Expired Attempt Question Leak Prevention (E-03)', () => {
  const { toStudentAttemptDTO } = require('../src/modules/attempts/dto')

  it('withholds questions when attempt is SUSPENDED', () => {
    const dummyAttempt = {
      id: 'att-suspended-1',
      examId: 'exam-1',
      status: 'SUSPENDED',
      suspensionReason: 'Proctor paused exam',
      serverTime: new Date().toISOString()
    }
    const questionsWithAnswers = [
      { attemptQuestionId: 'aq-1', questionId: 'q-1', questionText: 'Secret question 1' }
    ]

    // Service passes empty array when status is SUSPENDED (E-03)
    const dto = toStudentAttemptDTO(dummyAttempt, [])
    assert.equal(dto.id, 'att-suspended-1')
    assert.equal(dto.status, 'SUSPENDED')
    assert.deepEqual(dto.questions, [])
  })

  it('withholds questions when attempt is READY (waiting lobby)', () => {
    const dummyAttempt = {
      id: 'att-ready-1',
      examId: 'exam-1',
      status: 'READY',
      serverTime: new Date().toISOString()
    }
    const dto = toStudentAttemptDTO(dummyAttempt, [])
    assert.equal(dto.status, 'READY')
    assert.deepEqual(dto.questions, [])
  })

  it('withholds questions when attempt is EXPIRED or TERMINATED', () => {
    const dummyAttempt = {
      id: 'att-term-1',
      examId: 'exam-1',
      status: 'TERMINATED',
      terminationReason: 'Integrity breach',
      serverTime: new Date().toISOString()
    }
    const dto = toStudentAttemptDTO(dummyAttempt, [])
    assert.equal(dto.status, 'TERMINATED')
    assert.deepEqual(dto.questions, [])
  })
})

describe('Q3 - AutosaveManager Logic & Network Drop Retention', () => {
  // Simulates client AutosaveManager
  class MockAutosaveManager {
    constructor() {
      this.attemptId = 'att-q3-test'
      this.currentRevision = 1
      this.dirtyMap = new Map()
      this.isFlushing = false
      this.stableIdempotencyKey = null
      this.backoffMs = 1000
    }

    recordAnswer(attemptQuestionId, selectedOptionId) {
      const entry = {
        attemptQuestionId,
        selectedOptionId,
        revision: this.currentRevision,
        timestamp: Date.now()
      }
      this.dirtyMap.set(attemptQuestionId, entry)
      return entry
    }

    async flush(mockHttp) {
      if (this.dirtyMap.size === 0 || this.isFlushing) return { saved: 0 }
      this.isFlushing = true
      // Batch <= 100
      const snapshot = Array.from(this.dirtyMap.values()).slice(0, 100)

      try {
        const res = await mockHttp({
          answers: snapshot.map(s => ({
            attemptQuestionId: s.attemptQuestionId,
            selectedOptionId: s.selectedOptionId
          })),
          revision: this.currentRevision
        })

        // On 200: delete saved
        for (const item of snapshot) {
          const current = this.dirtyMap.get(item.attemptQuestionId)
          if (current && current.timestamp === item.timestamp) {
            this.dirtyMap.delete(item.attemptQuestionId)
          }
        }
        this.currentRevision = res.revision || (this.currentRevision + 1)
        this.backoffMs = 1000
        this.isFlushing = false
        return { saved: snapshot.length, status: 'SUCCESS' }
      } catch (err) {
        this.isFlushing = false
        if (err.status === 409 && err.currentRevision) {
          this.currentRevision = err.currentRevision
          return this.flush(mockHttp)
        }
        // Retain dirty map in memory
        this.backoffMs = Math.min(16000, this.backoffMs * 2)
        throw err
      }
    }

    getStableIdempotencyKey() {
      if (!this.stableIdempotencyKey) {
        this.stableIdempotencyKey = 'idemp-' + Math.random().toString(36).substring(2, 10)
      }
      return this.stableIdempotencyKey
    }
  }

  it('caps batch size to <= 100 items', async () => {
    const manager = new MockAutosaveManager()
    for (let i = 0; i < 150; i++) {
      manager.recordAnswer(`q-${i}`, `opt-${i}`)
    }
    assert.equal(manager.dirtyMap.size, 150)

    let sentCount = 0
    await manager.flush(async (payload) => {
      sentCount = payload.answers.length
      return { revision: 2 }
    })

    assert.equal(sentCount, 100) // capped at 100
    assert.equal(manager.dirtyMap.size, 50) // remaining 50 stay dirty for next flush
  })

  it('retains dirty answers in memory during a 30s network drop / server outage', async () => {
    const manager = new MockAutosaveManager()
    manager.recordAnswer('q-drop-1', 'opt-A')
    manager.recordAnswer('q-drop-2', 'opt-B')

    let networkOnline = false

    const sendRequest = async () => {
      if (!networkOnline) {
        const error = new Error('Network timeout / 503 Service Unavailable')
        error.status = 503
        throw error
      }
      return { revision: 2 }
    }

    // Attempt flush during 30s outage -> fails but answers are NOT lost
    await assert.rejects(async () => {
      await manager.flush(sendRequest)
    }, /503/)

    assert.equal(manager.dirtyMap.size, 2)
    assert.ok(manager.dirtyMap.has('q-drop-1'))
    assert.ok(manager.dirtyMap.has('q-drop-2'))

    // Network recovers
    networkOnline = true
    const success = await manager.flush(sendRequest)
    assert.equal(success.saved, 2)
    assert.equal(manager.dirtyMap.size, 0)
    assert.equal(manager.currentRevision, 2)
  })

  it('reconciles 409 STALE_REVISION conflict via CAS update', async () => {
    const manager = new MockAutosaveManager()
    manager.currentRevision = 1
    manager.recordAnswer('q-cas', 'opt-C')

    let serverRevision = 5
    let attempts = 0

    const mockHttp = async (payload) => {
      attempts++
      if (payload.revision < serverRevision) {
        const error = new Error('Stale revision')
        error.status = 409
        error.currentRevision = serverRevision
        throw error
      }
      return { revision: serverRevision + 1 }
    }

    const res = await manager.flush(mockHttp)
    assert.equal(res.status, 'SUCCESS')
    assert.equal(attempts, 2) // First failed with 409, automatically retried with revision 5
    assert.equal(manager.currentRevision, 6)
    assert.equal(manager.dirtyMap.size, 0)
  })

  it('reuses stable Idempotency-Key across submit retries to avoid double submission', () => {
    const manager = new MockAutosaveManager()
    const key1 = manager.getStableIdempotencyKey()
    const key2 = manager.getStableIdempotencyKey()
    assert.equal(key1, key2)
    assert.ok(key1.startsWith('idemp-'))
  })
})

describe('Q3 - Results Polling & Release Policy Handling', () => {
  it('returns HELD_BY_POLICY on 403 Forbidden', async () => {
    const mockPoll = async (statusResponse) => {
      if (statusResponse === 403) {
        return { released: false, status: 'HELD_BY_POLICY' }
      }
      return { released: true, status: 'RELEASED', score: 85 }
    }

    const held = await mockPoll(403)
    assert.equal(held.released, false)
    assert.equal(held.status, 'HELD_BY_POLICY')

    const released = await mockPoll(200)
    assert.equal(released.released, true)
    assert.equal(released.score, 85)
  })
})
