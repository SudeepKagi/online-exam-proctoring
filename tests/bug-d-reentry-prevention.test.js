'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { attemptService } = require('../backend/src/modules/attempts/service')
const { prisma } = require('../backend/src/infra/postgres/client')
const { attemptRepository } = require('../backend/src/modules/attempts/repository')
const { redisClient } = require('../backend/src/infra/redis/client')

describe('BUG D â€” Re-entry allowed after student has submitted / exam expired', () => {
  after(() => {
    try {
      if (redisClient?.client) {
        redisClient.client.disconnect(false)
      }
      if (redisClient?.subClient) {
        redisClient.subClient.disconnect(false)
      }
    } catch (_) {}
  })

  it('D.1: backend startOrResumeAttempt rejects finished attempt with 409 ATTEMPT_ALREADY_FINISHED', async () => {
    const origFindExam = prisma.exam.findUnique
    const origFindStudent = prisma.student.findUnique
    const origFindByExamAndStudent = attemptRepository.findByExamAndStudent

    try {
      prisma.student.findUnique = async () => ({ id: 'student-d1', approvalStatus: 'APPROVED' })
      prisma.exam.findUnique = async () => ({
        id: 'exam-d1',
        status: 'PUBLISHED',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        duration: 60,
        questions: []
      })
      attemptRepository.findByExamAndStudent = async () => ({
        id: 'attempt-d1',
        examId: 'exam-d1',
        studentId: 'student-d1',
        status: 'SUBMITTED'
      })

      let threwError = null
      try {
        await attemptService.startOrResumeAttempt('exam-d1', 'student-d1')
      } catch (err) {
        threwError = err
      }

      assert.ok(threwError, 'startOrResumeAttempt must reject submitted attempt')
      assert.strictEqual(threwError.statusCode, 409, 'Status must be 409 Conflict')
      assert.strictEqual(threwError.code, 'ATTEMPT_ALREADY_FINISHED', 'Code must be ATTEMPT_ALREADY_FINISHED')
    } finally {
      prisma.exam.findUnique = origFindExam
      prisma.student.findUnique = origFindStudent
      attemptRepository.findByExamAndStudent = origFindByExamAndStudent
    }
  })

  it('D.2: backend getOrCreateReadinessAttempt rejects finished attempt with 409 ATTEMPT_ALREADY_FINISHED', async () => {
    const origFindExam = prisma.exam.findUnique
    const origFindStudent = prisma.student.findUnique
    const origFindByExamAndStudent = attemptRepository.findByExamAndStudent

    try {
      prisma.student.findUnique = async () => ({
        id: 'student-d2',
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        facePhotoKey: 'face.jpg',
        isSuspended: false
      })
      prisma.exam.findUnique = async () => ({
        id: 'exam-d2',
        status: 'PUBLISHED',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        duration: 60,
        questions: []
      })
      attemptRepository.findByExamAndStudent = async () => ({
        id: 'attempt-d2',
        examId: 'exam-d2',
        studentId: 'student-d2',
        status: 'EXPIRED'
      })

      let threwError = null
      try {
        await attemptService.getOrCreateReadinessAttempt('exam-d2', 'student-d2')
      } catch (err) {
        threwError = err
      }

      assert.ok(threwError, 'getOrCreateReadinessAttempt must reject expired attempt')
      assert.strictEqual(threwError.statusCode, 409, 'Status must be 409 Conflict')
      assert.strictEqual(threwError.code, 'ATTEMPT_ALREADY_FINISHED', 'Code must be ATTEMPT_ALREADY_FINISHED')
    } finally {
      prisma.exam.findUnique = origFindExam
      prisma.student.findUnique = origFindStudent
      attemptRepository.findByExamAndStudent = origFindByExamAndStudent
    }
  })

  it('D.3: frontend isAttemptFinished correctly identifies all terminal attempt states and rejects re-entry', async () => {
    const { isAttemptFinished } = await import('../frontend/src/utils/examAttemptState.js')

    // Finished attempt scenarios
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'SUBMITTED' } }), true)
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'EXPIRED' } }), true)
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'TERMINATED' } }), true)
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'TIMED_OUT' } }), true)
    assert.strictEqual(isAttemptFinished({ studentStatus: 'SUBMITTED' }), true)
    assert.strictEqual(isAttemptFinished({ isSubmitted: true }), true)

    // Unfinished attempt scenarios (must NOT block entry)
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'ACTIVE' } }), false)
    assert.strictEqual(isAttemptFinished({ attempt: { status: 'READY' } }), false)
    assert.strictEqual(isAttemptFinished({ attempt: null }), false)
    assert.strictEqual(isAttemptFinished(null), false)
  })
})

