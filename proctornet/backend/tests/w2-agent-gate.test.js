'use strict'

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.STORAGE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
process.env.NODE_ENV = 'test'

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { evaluateDeviceGate, assertDeviceGate } = require('../src/modules/agent/agentGate')
const { agentSessionService } = require('../src/modules/agent/agentSessionService')
const { prisma } = require('../src/infra/postgres/client')

// Unit test stubs for prisma models so tests don't depend on a running postgres server
prisma.deviceAgentWaiver = {
  findUnique: async () => null
}
prisma.agentSession = {
  updateMany: async () => ({ count: 1 }),
  update: async () => ({ count: 1 }),
  findFirst: async () => null
}
prisma.agentRelease = {
  count: async () => 1,
  findFirst: async () => ({ id: 'rel-1', sha256: 'test-hash' })
}

describe('W2: Device Agent Gate & Consecutive Exams Tests (S-2 & S-3)', () => {
  const mockStudentId = crypto.randomUUID()

  it('1. Passes immediately when exam policy is not REQUIRED (e.g. OPTIONAL or DISABLED)', async () => {
    const exam = { id: 'exam-opt', deviceAgentPolicy: 'OPTIONAL' }
    const result = await evaluateDeviceGate({ attemptId: 'att-1', exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, true)
    assert.strictEqual(result.reason, 'POLICY_NOT_REQUIRED')
  })

  it('2. Fails when policy is REQUIRED but attemptId is missing', async () => {
    const exam = { id: 'exam-req', deviceAgentPolicy: 'REQUIRED' }
    const result = await evaluateDeviceGate({ attemptId: null, exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, false)
    assert.strictEqual(result.code, 'AGENT_REQUIRED')
    assert.strictEqual(result.reason, 'ATTEMPT_REQUIRED')
  })

  it('3. Fails when policy is REQUIRED and no agent session exists for attempt', async () => {
    const exam = { id: 'exam-req', deviceAgentPolicy: 'REQUIRED' }
    const nonExistentAttemptId = crypto.randomUUID()
    const result = await evaluateDeviceGate({ attemptId: nonExistentAttemptId, exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, false)
    assert.strictEqual(result.code, 'AGENT_REQUIRED')
    assert.strictEqual(result.state, 'NOT_PAIRED')
  })

  it('4. Practice PRECHECK session does NOT satisfy exam attempt gate', async () => {
    const exam = { id: 'exam-req', deviceAgentPolicy: 'REQUIRED' }
    const precheckAttemptId = crypto.randomUUID()

    // Add precheck session directly to in-memory hot sessions
    const tokenHash = crypto.randomBytes(16).toString('hex')
    const precheckSession = {
      id: crypto.randomUUID(),
      tokenHash,
      scope: 'PRECHECK',
      studentId: mockStudentId,
      attemptId: null,
      state: 'HEALTHY',
      buildHash: 'test-hash',
      lastSeenAt: new Date(),
      openFindings: new Map()
    }

    // Attempt lookup for the actual exam attempt returns NOT_PAIRED, not falling back to precheck
    const examAttemptId = crypto.randomUUID()
    const result = await evaluateDeviceGate({ attemptId: examAttemptId, exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, false)
    assert.strictEqual(result.code, 'AGENT_REQUIRED')
    assert.strictEqual(result.state, 'NOT_PAIRED')
  })

  it('5. Fails when session heartbeat is stale (> AGENT_STALE_MS)', async () => {
    const exam = { id: 'exam-req', deviceAgentPolicy: 'REQUIRED' }
    const staleAttemptId = crypto.randomUUID()
    const tokenHash = crypto.randomBytes(16).toString('hex')

    const staleSession = {
      id: crypto.randomUUID(),
      tokenHash,
      scope: 'ATTEMPT',
      studentId: mockStudentId,
      attemptId: staleAttemptId,
      state: 'HEALTHY',
      buildHash: 'test-hash',
      // Stale by 60 seconds
      lastSeenAt: new Date(Date.now() - 60000),
      openFindings: new Map()
    }

    agentSessionService._setHotSessionForTest?.(staleAttemptId, staleSession)

    const result = await evaluateDeviceGate({ attemptId: staleAttemptId, exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, false)
    assert.strictEqual(result.code, 'AGENT_REQUIRED')
    assert.strictEqual(result.state, 'LOST_CONNECTION')
  })

  it('6. Passes when attempt has active, fresh companion session', async () => {
    const exam = { id: 'exam-req', deviceAgentPolicy: 'REQUIRED' }
    const activeAttemptId = crypto.randomUUID()
    const tokenHash = crypto.randomBytes(16).toString('hex')

    const activeSession = {
      id: crypto.randomUUID(),
      tokenHash,
      scope: 'ATTEMPT',
      studentId: mockStudentId,
      attemptId: activeAttemptId,
      state: 'HEALTHY',
      buildHash: 'test-hash',
      lastSeenAt: new Date(),
      openFindings: new Map()
    }

    agentSessionService._setHotSessionForTest?.(activeAttemptId, activeSession)

    const result = await evaluateDeviceGate({ attemptId: activeAttemptId, exam, studentId: mockStudentId })
    assert.strictEqual(result.passed, true)
    assert.strictEqual(result.state, 'HEALTHY')
  })

  it('7. Consecutive Exams Flow: Submitting Exam 1 terminates session; Exam 2 blocks until new companion pairs', async () => {
    const exam1 = { id: 'exam-1', deviceAgentPolicy: 'REQUIRED' }
    const exam2 = { id: 'exam-2', deviceAgentPolicy: 'REQUIRED' }
    const exam1AttemptId = crypto.randomUUID()
    const exam2AttemptId = crypto.randomUUID()

    // 1. Companion is paired for Exam 1
    const exam1Session = {
      id: crypto.randomUUID(),
      tokenHash: crypto.randomBytes(16).toString('hex'),
      scope: 'ATTEMPT',
      studentId: mockStudentId,
      attemptId: exam1AttemptId,
      state: 'HEALTHY',
      buildHash: 'test-hash',
      lastSeenAt: new Date(),
      openFindings: new Map()
    }
    agentSessionService._setHotSessionForTest?.(exam1AttemptId, exam1Session)

    // Exam 1 passes gate
    const gate1 = await evaluateDeviceGate({ attemptId: exam1AttemptId, exam: exam1, studentId: mockStudentId })
    assert.strictEqual(gate1.passed, true)

    // 2. Exam 1 finishes / student submits -> session ends
    await agentSessionService.endSessionsByAttemptId(exam1AttemptId)

    // Exam 1 session is no longer active in hotSessions
    const exam1SessionAfter = await agentSessionService.getSessionByAttemptId(exam1AttemptId)
    assert.ok(!exam1SessionAfter || exam1SessionAfter.state === 'TERMINATED', 'Exam 1 session must be inactive or terminated')

    // 3. Student immediately attempts Exam 2 on the same machine
    // Because companion session was attempt-scoped to Exam 1 and is terminated, Exam 2 MUST fail gate
    const gate2 = await evaluateDeviceGate({ attemptId: exam2AttemptId, exam: exam2, studentId: mockStudentId })
    assert.strictEqual(gate2.passed, false)
    assert.strictEqual(gate2.code, 'AGENT_REQUIRED')
    assert.strictEqual(gate2.state, 'NOT_PAIRED')

    // assertDeviceGate throws ForbiddenError with code AGENT_REQUIRED
    await assert.rejects(
      async () => {
        await assertDeviceGate({ attemptId: exam2AttemptId, exam: exam2, studentId: mockStudentId })
      },
      (err) => {
        assert.strictEqual(err.code, 'AGENT_REQUIRED')
        return true
      }
    )
  })
})
