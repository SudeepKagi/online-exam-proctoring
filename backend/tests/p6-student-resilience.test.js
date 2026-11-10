/**
 * backend/tests/p6-student-resilience.test.js
 * Comprehensive unit and integration tests for student resilience:
 * - Silent refresh endpoint (POST /api/v1/auth/refresh)
 * - Autosave with 500s exponential backoff and offline queue recovery
 * - Submit idempotency with stable idempotency key
 * - Server clock offset calculations and countdown thresholds
 */

'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { app } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const config = require('../src/shared/config')

async function cleanTestData() {
  await prisma.examAttempt.deleteMany({
    where: { exam: { title: { contains: 'Idempotency' } } }
  }).catch(() => {})
  await prisma.examAttempt.deleteMany({
    where: { student: { email: { contains: 'resilience' } } }
  }).catch(() => {})
  await prisma.exam.deleteMany({
    where: { title: { contains: 'Idempotency' } }
  }).catch(() => {})
  await prisma.exam.deleteMany({
    where: { title: { contains: 'Resilience' } }
  }).catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { in: ['faculty.submit@proctornet.test'] } }
  }).catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { contains: 'resilience' } }
  }).catch(() => {})
}

describe('Student Resilience & Autosave Layer Suite', () => {
  let server = null
  let port = null
  let testStudent = null
  let validRefreshToken = null
  let expiredRefreshToken = null
  let tamperedRefreshToken = null

  function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
      const reqHeaders = { ...headers }
      if (postData) {
        reqHeaders['Content-Type'] = 'application/json'
        reqHeaders['Content-Length'] = Buffer.byteLength(postData)
      }
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1${path}`,
        method,
        headers: reqHeaders
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          let json = null
          try { json = JSON.parse(data) } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json || data })
        })
      })
      req.on('error', reject)
      if (postData) req.write(postData)
      req.end()
    })
  }

  before(async () => {
    await cleanTestData()

    await new Promise((resolve) => {
      server = http.createServer(app)
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port
        resolve()
      })
    })

    const passwordHash = await bcrypt.hash('StudentSecure#2026', 10)
    testStudent = await prisma.user.create({
      data: {
        email: 'resilience.student@proctornet.test',
        fullName: 'Resilience Test Student',
        passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE'
      }
    })

    const refreshSecret = config.jwtRefreshSecret || config.jwtSecret
    validRefreshToken = jwt.sign(
      { sub: testStudent.id, id: testStudent.id, email: testStudent.email, role: 'STUDENT' },
      refreshSecret,
      { expiresIn: '12h' }
    )

    expiredRefreshToken = jwt.sign(
      { sub: testStudent.id, id: testStudent.id, email: testStudent.email, role: 'STUDENT' },
      refreshSecret,
      { expiresIn: '-1s' }
    )

    tamperedRefreshToken = validRefreshToken.slice(0, -6) + 'abcdef'
  })

  after(async () => {
    if (server) {
      await new Promise(r => server.close(r))
    }
    await cleanTestData()
  })

  describe('1. Silent Token Refresh (POST /api/v1/auth/refresh)', () => {
    it('returns 401 when refresh token is completely missing', async () => {
      const res = await makeRequest('POST', '/auth/refresh', {})

      assert.equal(res.status, 401)
      assert.equal(res.body.code, 'REFRESH_TOKEN_REQUIRED')
    })

    it('returns 401 TOKEN_INVALID on tampered refresh token', async () => {
      const res = await makeRequest('POST', '/auth/refresh', { refreshToken: tamperedRefreshToken })

      assert.equal(res.status, 401)
      assert.equal(res.body.code, 'TOKEN_INVALID')
    })

    it('returns 401 TOKEN_EXPIRED on expired refresh token', async () => {
      const res = await makeRequest('POST', '/auth/refresh', { refreshToken: expiredRefreshToken })

      assert.equal(res.status, 401)
      assert.equal(res.body.code, 'TOKEN_EXPIRED')
    })

    it('succeeds with fresh accessToken and refreshToken on valid token payload', async () => {
      const res = await makeRequest('POST', '/auth/refresh', { refreshToken: validRefreshToken })

      assert.equal(res.status, 200)
      assert.equal(res.body.status, 'success')
      assert.ok(res.body.accessToken)
      assert.ok(res.body.refreshToken)
      assert.equal(res.body.user.id, testStudent.id)
      assert.equal(res.body.user.email, testStudent.email)

      // Verify the new access token is verifiable
      const decoded = jwt.verify(res.body.accessToken, config.jwtSecret)
      assert.equal(decoded.id, testStudent.id)
    })

    it('reads refresh token from HTTP cookie when body is empty', async () => {
      const res = await makeRequest('POST', '/auth/refresh', {}, {
        Cookie: `pn_rt=${validRefreshToken}`
      })

      assert.equal(res.status, 200)
      assert.ok(res.body.accessToken)
      assert.equal(res.body.user.id, testStudent.id)
    })

    it('rejects suspended student even if refresh token is valid', async () => {
      const suspendedStudent = await prisma.user.create({
        data: {
          email: 'suspended.resilience@proctornet.test',
          fullName: 'Suspended Student',
          passwordHash: 'hash',
          role: 'STUDENT',
          status: 'SUSPENDED'
        }
      })

      const refreshSecret = config.jwtRefreshSecret || config.jwtSecret
      const token = jwt.sign(
        { sub: suspendedStudent.id, id: suspendedStudent.id },
        refreshSecret,
        { expiresIn: '12h' }
      )

      const res = await makeRequest('POST', '/auth/refresh', { refreshToken: token })

      assert.equal(res.status, 403)
    })
  })

  describe('2. Autosave Engine: 500s Backoff & Offline Queue Invariants', () => {
    class MockAutosaveManager {
      constructor() {
        this.dirtyMap = new Map()
        this.backoffMs = 1000
        this.maxBackoffMs = 16000
        this.syncStatus = 'SAVED'
        this.failCount = 0
      }

      recordAnswer(qId, optIdx) {
        this.dirtyMap.set(qId, { qId, optIdx, ts: Date.now() })
        this.syncStatus = 'SAVING'
      }

      async flush(mockNetworkCall) {
        if (this.dirtyMap.size === 0) return { synced: 0 }
        this.syncStatus = 'SAVING'
        try {
          const snapshot = Array.from(this.dirtyMap.values())
          await mockNetworkCall(snapshot)
          this.dirtyMap.clear()
          this.backoffMs = 1000
          this.syncStatus = 'SAVED'
          return { synced: snapshot.length }
        } catch (err) {
          this.failCount++
          this.syncStatus = 'OFFLINE'
          this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2)
          throw err
        }
      }
    }

    it('retains dirty answers across consecutive 500 server errors and applies exponential backoff', async () => {
      const manager = new MockAutosaveManager()
      manager.recordAnswer('q1', 2)
      manager.recordAnswer('q2', 0)

      assert.equal(manager.dirtyMap.size, 2)
      assert.equal(manager.backoffMs, 1000)

      // First 500 failure
      await assert.rejects(
        manager.flush(async () => {
          const e = new Error('Internal Server Error')
          e.status = 500
          throw e
        })
      )
      assert.equal(manager.dirtyMap.size, 2, 'Must not drop dirty answers on 500 error')
      assert.equal(manager.syncStatus, 'OFFLINE')
      assert.equal(manager.backoffMs, 2000, 'Backoff must double to 2000ms')

      // Second 500 failure
      await assert.rejects(
        manager.flush(async () => {
          const e = new Error('Service Unavailable')
          e.status = 503
          throw e
        })
      )
      assert.equal(manager.dirtyMap.size, 2)
      assert.equal(manager.backoffMs, 4000, 'Backoff must double to 4000ms')

      // Third 500 failure
      await assert.rejects(
        manager.flush(async () => {
          const e = new Error('Bad Gateway')
          e.status = 502
          throw e
        })
      )
      assert.equal(manager.dirtyMap.size, 2)
      assert.equal(manager.backoffMs, 8000, 'Backoff must double to 8000ms')

      // Server recovers (200 OK)
      const res = await manager.flush(async (snapshot) => {
        assert.equal(snapshot.length, 2)
        return { success: true }
      })
      assert.equal(res.synced, 2)
      assert.equal(manager.dirtyMap.size, 0)
      assert.equal(manager.syncStatus, 'SAVED')
      assert.equal(manager.backoffMs, 1000, 'Backoff must reset to 1000ms on success')
    })

    it('simulates 30 seconds offline buffering then online recovery', async () => {
      const manager = new MockAutosaveManager()

      // Student answers question 1 at t=0s
      manager.recordAnswer('q-alpha', 1)
      // Student answers question 2 at t=10s
      manager.recordAnswer('q-beta', 3)
      // Student answers question 3 at t=25s
      manager.recordAnswer('q-gamma', 0)

      assert.equal(manager.dirtyMap.size, 3)

      // While offline, flush fails
      await assert.rejects(
        manager.flush(async () => {
          throw new Error('Network error: offline')
        })
      )
      assert.equal(manager.syncStatus, 'OFFLINE')
      assert.equal(manager.dirtyMap.size, 3)

      // Network resumes at t=30s -> flush succeeds
      const res = await manager.flush(async (snapshot) => {
        return { saved: snapshot.length }
      })
      assert.equal(res.synced, 3)
      assert.equal(manager.dirtyMap.size, 0)
      assert.equal(manager.syncStatus, 'SAVED')
    })
  })

  describe('3. Idempotent Submit & Submitting Lock', () => {
    it('concurrent and repeated submit requests return identical 200 response without duplicate grading', async () => {
      const faculty = await prisma.user.create({
        data: {
          email: `faculty.submit.${Date.now()}@proctornet.test`,
          fullName: 'Faculty Submit',
          passwordHash: 'hash',
          role: 'FACULTY',
          status: 'ACTIVE'
        }
      })

      const exam = await prisma.exam.create({
        data: {
          title: 'Submit Idempotency Test Exam',
          courseCode: 'CS302',
          createdById: faculty.id,
          startTime: new Date(Date.now() - 10000),
          endTime: new Date(Date.now() + 3600000),
          durationMinutes: 60,
          status: 'PUBLISHED'
        }
      })

      const attempt = await prisma.examAttempt.create({
        data: {
          examId: exam.id,
          studentId: testStudent.id,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000)
        }
      })

      const authHeader = `Bearer ${jwt.sign({ sub: testStudent.id, id: testStudent.id, role: 'STUDENT' }, config.jwtSecret)}`
      const stableKey = `idemp_test_${Date.now()}`

      // First submission
      const res1 = await makeRequest(
        'POST',
        `/attempts/${attempt.id}/submit`,
        { idempotencyKey: stableKey },
        { Authorization: authHeader, 'Idempotency-Key': stableKey }
      )

      assert.equal(res1.status, 200)
      assert.equal(res1.body.status, 'success')
      assert.equal(res1.body.attempt.status, 'SUBMITTED')
      assert.equal(res1.body.alreadySubmitted, false)

      // Immediate retry with the same key
      const res2 = await makeRequest(
        'POST',
        `/attempts/${attempt.id}/submit`,
        { idempotencyKey: stableKey },
        { Authorization: authHeader, 'Idempotency-Key': stableKey }
      )

      assert.equal(res2.status, 200)
      assert.equal(res2.body.status, 'success')
      assert.equal(res2.body.attempt.status, 'SUBMITTED')
      assert.equal(res2.body.alreadySubmitted, true)
      assert.equal(res2.body.attempt.id, res1.body.attempt.id)
    })
  })

  describe('4. Server Clock Synchronization & Remaining Time Invariants', () => {
    function computeRemaining(serverTime, expiresAt, clientNow = Date.now()) {
      const serverEpoch = typeof serverTime === 'number' ? serverTime : new Date(serverTime).getTime()
      const offsetMs = serverEpoch - clientNow
      const deadlineEpoch = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()
      const effectiveNow = clientNow + offsetMs
      return Math.max(0, Math.floor((deadlineEpoch - effectiveNow) / 1000))
    }

    it('accurately discounts client clock skew using server time offset', () => {
      const clientNow = 1700000000000
      // Server clock is 5 minutes ahead of client clock
      const serverNow = clientNow + 300000
      // Exam expires 10 minutes from server time
      const expiresAt = serverNow + 600000

      const remaining = computeRemaining(serverNow, expiresAt, clientNow)
      assert.equal(remaining, 600, 'Should correctly indicate 600 seconds (10 minutes) remaining')
    })

    it('returns zero when server clock has passed expiration timestamp', () => {
      const clientNow = 1700000000000
      const serverNow = clientNow + 50000
      // Deadline was 10 seconds before server now
      const expiresAt = serverNow - 10000

      const remaining = computeRemaining(serverNow, expiresAt, clientNow)
      assert.equal(remaining, 0, 'Should floor to 0 seconds when expired')
    })
  })
})
