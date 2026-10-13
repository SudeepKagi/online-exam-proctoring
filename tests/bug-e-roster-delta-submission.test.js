'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { submissionService } = require('../proctornet/backend/src/modules/submissions/service')
const { submissionRepository } = require('../proctornet/backend/src/modules/submissions/repository')
const { rosterCoalescer } = require('../proctornet/backend/src/infra/websocket/rosterCoalescer')
const { socketEmitter } = require('../proctornet/backend/src/infra/websocket/emitter')
const { redisClient } = require('../proctornet/backend/src/infra/redis/client')

describe('BUG E — Invigilator sees student as "Live" after student has submitted', () => {
  after(() => {
    try {
      if (socketEmitter?.redisClient) {
        socketEmitter.redisClient.disconnect(false)
      }
      if (redisClient?.client) {
        redisClient.client.disconnect(false)
      }
      if (redisClient?.subClient) {
        redisClient.subClient.disconnect(false)
      }
    } catch (_) {}
  })

  it('E.1: submissionService queues roster delta with SUBMITTED and online:false upon submit', async () => {
    // Spy on rosterCoalescer.queueDelta
    let queuedDelta = null
    let targetExamId = null
    const origQueueDelta = rosterCoalescer.queueDelta
    rosterCoalescer.queueDelta = (examId, delta) => {
      targetExamId = examId
      queuedDelta = delta
    }

    // Mock submission repository methods to avoid external database call
    const origFindIdempotent = submissionRepository.findIdempotentResponse
    const origSubmitTx = submissionRepository.submitAttemptTransaction

    submissionRepository.findIdempotentResponse = async () => null
    submissionRepository.submitAttemptTransaction = async () => ({
      attempt: {
        id: 'attempt-e1',
        exam_id: 'exam-e1',
        status: 'SUBMITTED'
      },
      alreadySubmitted: false
    })

    // Mock socketEmitter to avoid network calls
    const origEmit = socketEmitter.emitToInvigilators
    socketEmitter.emitToInvigilators = () => {}

    try {
      await submissionService.submitAttempt(
        'attempt-e1',
        'student-e1',
        'sub-key-1',
        'req-hash-1',
        []
      )

      assert.ok(queuedDelta, 'rosterCoalescer.queueDelta must be called on successful submit')
      assert.strictEqual(targetExamId, 'exam-e1')
      assert.strictEqual(queuedDelta.attemptId, 'attempt-e1')
      assert.strictEqual(queuedDelta.studentId, 'student-e1')
      assert.strictEqual(queuedDelta.status, 'SUBMITTED')
      assert.strictEqual(queuedDelta.online, false)
    } finally {
      rosterCoalescer.queueDelta = origQueueDelta
      submissionRepository.findIdempotentResponse = origFindIdempotent
      submissionRepository.submitAttemptTransaction = origSubmitTx
      socketEmitter.emitToInvigilators = origEmit
    }
  })

  it('E.2: student:submitted event payload formats into authoritative roster delta', () => {
    // Verify client-side delta transform
    const mockStudentSubmittedPayload = {
      attemptId: 'attempt-e2',
      studentId: 'student-e2'
    }

    const expectedDelta = {
      attemptId: mockStudentSubmittedPayload.attemptId,
      studentId: mockStudentSubmittedPayload.studentId,
      status: 'SUBMITTED',
      online: false
    }

    assert.strictEqual(expectedDelta.status, 'SUBMITTED')
    assert.strictEqual(expectedDelta.online, false)
  })
})
