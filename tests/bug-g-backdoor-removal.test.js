'use strict'

const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { authService } = require('../proctornet/backend/src/modules/auth/service')
const authRepository = require('../proctornet/backend/src/modules/auth/repository')
const { tokenService } = require('../proctornet/backend/src/modules/auth/tokenService')
const { redisClient } = require('../proctornet/backend/src/infra/redis/client')

describe('BUG G — Hard-coded invigilator backdoor credentials rejection', () => {
  after(async () => {
    try {
      if (redisClient?.client) {
        await redisClient.client.quit().catch(() => redisClient.client.disconnect())
      }
    } catch {}
  })

  it('G.1: Rejects login with backdoor password Pass123! against real exam hash', async () => {
    const realExamId = crypto.randomUUID()
    const realHash = await bcrypt.hash('RealLegitPassword999!', 10)

    const origFindExamById = authRepository.findExamById
    const origCreateInvSession = authRepository.createInvigilatorSession
    const origCreateSession = tokenService.createSession

    authRepository.findExamById = async () => ({
      id: realExamId,
      invId: 'REAL-INV-999',
      invPasswordHash: realHash,
      endTime: new Date(Date.now() + 3600 * 1000).toISOString(),
      title: 'Security Test Exam',
      subject: 'Cybersecurity'
    })
    authRepository.createInvigilatorSession = async (data) => ({
      id: crypto.randomUUID(),
      invId: data.invId,
      examId: data.examId
    })
    tokenService.createSession = async () => ({
      accessToken: 'dummy-access',
      refreshToken: 'dummy-refresh'
    })

    try {
      let error = null
      try {
        await authService.invigilatorLogin({
          invId: 'REAL-INV-999',
          invPassword: 'Pass123!',
          examId: realExamId
        })
      } catch (err) {
        error = err
      }

      assert.ok(error, 'Pass123! must be rejected when not matching the exam hash')
      assert.strictEqual(error.statusCode, 401, 'Must return 401 Unauthorized')
      assert.strictEqual(error.code, 'UNAUTHORIZED')
    } finally {
      authRepository.findExamById = origFindExamById
      authRepository.createInvigilatorSession = origCreateInvSession
      tokenService.createSession = origCreateSession
    }
  })

  it('G.2: Rejects login with backdoor invId INV-101 against different exam invId', async () => {
    const realExamId = crypto.randomUUID()
    const realHash = await bcrypt.hash('RealLegitPassword999!', 10)

    const origFindExamById = authRepository.findExamById
    const origCreateInvSession = authRepository.createInvigilatorSession
    const origCreateSession = tokenService.createSession

    authRepository.findExamById = async () => ({
      id: realExamId,
      invId: 'ASSIGNED-INV-456',
      invPasswordHash: realHash,
      endTime: new Date(Date.now() + 3600 * 1000).toISOString(),
      title: 'Security Test Exam',
      subject: 'Cybersecurity'
    })
    authRepository.createInvigilatorSession = async (data) => ({
      id: crypto.randomUUID(),
      invId: data.invId,
      examId: data.examId
    })
    tokenService.createSession = async () => ({
      accessToken: 'dummy-access',
      refreshToken: 'dummy-refresh'
    })

    try {
      let error = null
      try {
        await authService.invigilatorLogin({
          invId: 'INV-101',
          invPassword: 'RealLegitPassword999!',
          examId: realExamId
        })
      } catch (err) {
        error = err
      }

      assert.ok(error, 'INV-101 must be rejected when not matching the exam invId')
      assert.strictEqual(error.statusCode, 401, 'Must return 401 Unauthorized')
      assert.strictEqual(error.code, 'UNAUTHORIZED')
    } finally {
      authRepository.findExamById = origFindExamById
      authRepository.createInvigilatorSession = origCreateInvSession
      tokenService.createSession = origCreateSession
    }
  })
})
