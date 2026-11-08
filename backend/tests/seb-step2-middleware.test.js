'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const path = require('path')
const { execFile } = require('child_process')
const util = require('util')
const execFilePromise = util.promisify(execFile)

const config = require('../src/shared/config')
const { normalizePublicOrigin } = require('../src/shared/validateConfig')
const {
  verifySeb,
  markAttemptSebVerified,
  isAttemptSebVerified,
  invalidateExamSebCache,
  clearAllSebCaches,
  getCachedSebSettings,
  resolveExamId,
  BoundedLru
} = require('../src/middleware/seb')
const examsSql = require('../src/modules/exams/exams.sql')
const { examService } = require('../src/modules/exams/exams.service')
const { prisma } = require('../src/infra/postgres/client')
const { corsMiddleware } = require('../src/middleware/security')

const VALID_64_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/seb/verify-formula.js')

describe('Step 2: Safe Exam Browser (SEB) Verification Middleware Suite', () => {
  let facultyUser = null
  let studentUser = null
  let adminUser = null
  let nonSebExam = null
  let sebExam = null
  const createdExamIds = []

  before(async () => {
    facultyUser = await prisma.user.findFirst({ where: { role: 'FACULTY' } })
    if (!facultyUser) {
      facultyUser = await prisma.user.create({
        data: {
          email: `seb2-fac-${Date.now()}@proctornet.com`,
          fullName: 'SEB2 Faculty',
          passwordHash: 'dummyhash',
          role: 'FACULTY',
          status: 'ACTIVE'
        }
      })
    }

    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT', email: 'student1@proctornet.com' } })
    if (!studentUser) {
      studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
    }
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: `seb2-stud-${Date.now()}@proctornet.com`,
          fullName: 'SEB2 Student',
          passwordHash: 'dummyhash',
          role: 'STUDENT',
          status: 'ACTIVE'
        }
      })
    }

    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `seb2-admin-${Date.now()}@proctornet.com`,
          fullName: 'SEB2 Admin',
          passwordHash: 'dummyhash',
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })
    }
  })

  after(async () => {
    clearAllSebCaches()
    for (const examId of createdExamIds) {
      await examsSql.deleteExam(examId).catch(() => {})
    }
  })

  describe('1. verify-formula.js CLI Tool', () => {
    const testUrl = 'http://localhost:5000/api/v1/attempts/start'
    const expectedHashA = crypto.createHash('sha256').update(testUrl + VALID_64_HEX).digest('hex').toLowerCase()
    const innerKeyHash = crypto.createHash('sha256').update(VALID_64_HEX).digest('hex').toLowerCase()
    const expectedHashB = crypto.createHash('sha256').update(testUrl + innerKeyHash).digest('hex').toLowerCase()

    it('--make prints Variant A and Variant B hashes and exits 0', async () => {
      const { stdout } = await execFilePromise(process.execPath, [SCRIPT_PATH, '--make', testUrl, VALID_64_HEX])
      assert.match(stdout, new RegExp(expectedHashA, 'i'))
      assert.match(stdout, new RegExp(expectedHashB, 'i'))
      assert.match(stdout, /Variant A/i)
      assert.match(stdout, /Variant B/i)
    })

    it('matches Variant A and exits 0', async () => {
      const { stdout } = await execFilePromise(process.execPath, [SCRIPT_PATH, testUrl, VALID_64_HEX, expectedHashA])
      assert.match(stdout, /MATCH: Variant A/i)
    })

    it('matches Variant B and exits 0', async () => {
      const { stdout } = await execFilePromise(process.execPath, [SCRIPT_PATH, testUrl, VALID_64_HEX, expectedHashB])
      assert.match(stdout, /MATCH: Variant B/i)
    })

    it('detects mismatch and exits with code 1', async () => {
      const bogusHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      await assert.rejects(
        async () => {
          await execFilePromise(process.execPath, [SCRIPT_PATH, testUrl, VALID_64_HEX, bogusHash])
        },
        (err) => {
          assert.strictEqual(err.code, 1)
          assert.match(err.stderr || err.stdout, /MISMATCH/i)
          return true
        }
      )
    })
  })

  describe('2. PUBLIC_ORIGIN Validation & Normalization', () => {
    it('defaults to http://localhost:5000 when unset or empty', () => {
      assert.strictEqual(normalizePublicOrigin(null), 'http://localhost:5000')
      assert.strictEqual(normalizePublicOrigin(''), 'http://localhost:5000')
    })

    it('drops default port 80 for HTTP', () => {
      assert.strictEqual(normalizePublicOrigin('http://example.com:80'), 'http://example.com')
    })

    it('drops default port 443 for HTTPS', () => {
      assert.strictEqual(normalizePublicOrigin('https://proctornet.duckdns.org:443'), 'https://proctornet.duckdns.org')
    })

    it('preserves non-default ports', () => {
      assert.strictEqual(normalizePublicOrigin('http://localhost:5000'), 'http://localhost:5000')
      assert.strictEqual(normalizePublicOrigin('https://exam.univ.edu:8443'), 'https://exam.univ.edu:8443')
    })

    it('strips trailing slashes from root path', () => {
      assert.strictEqual(normalizePublicOrigin('http://localhost:5000/'), 'http://localhost:5000')
    })

    it('rejects origins with subpaths', () => {
      assert.throws(() => normalizePublicOrigin('http://localhost:5000/api/v1'), /bare origin with no path/i)
    })

    it('rejects origins with query parameters', () => {
      assert.throws(() => normalizePublicOrigin('http://localhost:5000?foo=bar'), /query parameters/i)
    })

    it('rejects origins with fragments', () => {
      assert.throws(() => normalizePublicOrigin('http://localhost:5000#anchor'), /fragment/i)
    })
  })

  describe('3. BoundedLru Cache Implementation', () => {
    it('evicts the oldest item when exceeding capacity', () => {
      const lru = new BoundedLru(3)
      lru.set('a', '1')
      lru.set('b', '2')
      lru.set('c', '3')
      assert.strictEqual(lru.get('a'), '1')
      // 'a' accessed, so 'b' is now oldest
      lru.set('d', '4')
      assert.strictEqual(lru.has('b'), false, 'Key b should be evicted')
      assert.strictEqual(lru.get('a'), '1')
      assert.strictEqual(lru.get('c'), '3')
      assert.strictEqual(lru.get('d'), '4')
    })
  })

  describe('4. CORS allowedHeaders Verification', () => {
    it('CORS middleware permits x-safeexambrowser-configkeyhash in preflight', (t, done) => {
      const req = {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'x-safeexambrowser-configkeyhash,authorization,content-type'
        }
      }
      let headersSet = {}
      const res = {
        setHeader: (k, v) => { headersSet[k.toLowerCase()] = v },
        getHeader: (k) => headersSet[k.toLowerCase()],
        end: () => {
          const allowed = headersSet['access-control-allow-headers'] || ''
          assert.match(allowed, /x-safeexambrowser-configkeyhash/i)
          done()
        }
      }
      corsMiddleware(req, res, () => {
        done()
      })
    })
  })

  describe('5. SEB Verification Middleware Unit Behavior', () => {
    function createMockRes(onComplete) {
      const res = {
        statusCode: null,
        body: null,
        status: (code) => { res.statusCode = code; return res },
        json: (data) => {
          res.body = data
          if (typeof onComplete === 'function') onComplete()
          return res
        },
        end: () => {
          if (typeof onComplete === 'function') onComplete()
          return res
        }
      }
      return res
    }

    before(async () => {
      const now = Date.now()
      nonSebExam = await examsSql.createExam({
        title: `SEB2 Non-SEB Exam ${now}`,
        courseCode: 'GEN-101',
        durationMinutes: 60,
        startTime: new Date(now + 60000).toISOString(),
        endTime: new Date(now + 7200000).toISOString(),
        createdBy: facultyUser.id,
        proctoringConfig: { sebRequired: false }
      })
      createdExamIds.push(nonSebExam.id)

      sebExam = await examsSql.createExam({
        title: `SEB2 Protected Exam ${now}`,
        courseCode: 'SEC-101',
        durationMinutes: 60,
        startTime: new Date(now + 60000).toISOString(),
        endTime: new Date(now + 7200000).toISOString(),
        createdBy: facultyUser.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX
        }
      })
      createdExamIds.push(sebExam.id)
    })

    it('passes through when SEB_MODE=off', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'off'
      try {
        const req = {
          user: { id: studentUser.id, role: 'STUDENT' },
          params: { examId: sebExam.id },
          headers: {}
        }
        const res = createMockRes()
        let nextCalled = false
        await new Promise((resolve, reject) => {
          verifySeb(req, res, (err) => {
            if (err) return reject(err)
            nextCalled = true
            resolve()
          })
        })
        assert.ok(nextCalled)
        assert.strictEqual(req.seb.mode, 'off')
      } finally {
        config.sebMode = originalMode
      }
    })

    it('passes through for non-STUDENT roles (faculty/admin bypass)', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const req = {
          user: { id: facultyUser.id, role: 'FACULTY' },
          params: { examId: sebExam.id },
          headers: {} // No SEB header
        }
        const res = createMockRes()
        let nextCalled = false
        await new Promise((resolve, reject) => {
          verifySeb(req, res, (err) => {
            if (err) return reject(err)
            nextCalled = true
            resolve()
          })
        })
        assert.ok(nextCalled)
        assert.strictEqual(req.seb.roleBypass, true)
        assert.strictEqual(req.seb.verified, true)
      } finally {
        config.sebMode = originalMode
      }
    })

    it('passes through for exams where sebRequired=false', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const req = {
          user: { id: studentUser.id, role: 'STUDENT' },
          params: { examId: nonSebExam.id },
          headers: {}
        }
        const res = createMockRes()
        let nextCalled = false
        await new Promise((resolve, reject) => {
          verifySeb(req, res, (err) => {
            if (err) return reject(err)
            nextCalled = true
            resolve()
          })
        })
        assert.ok(nextCalled)
        assert.strictEqual(req.seb.sebRequired, false)
        assert.strictEqual(req.seb.verified, true)
      } finally {
        config.sebMode = originalMode
      }
    })

    it('in enforce mode: rejects missing or invalid header with 403 SEB_REQUIRED', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const req = {
          user: { id: studentUser.id, role: 'STUDENT' },
          params: { examId: sebExam.id },
          originalUrl: `/api/v1/attempts/exams/${sebExam.id}/start`,
          headers: {
            'x-safeexambrowser-configkeyhash': 'invalid-not-64-hex'
          }
        }
        let res = null
        await new Promise((resolve) => {
          res = createMockRes(resolve)
          verifySeb(req, res, () => {
            resolve()
          })
        })

        assert.strictEqual(res.statusCode, 403)
        assert.strictEqual(res.body.code, 'SEB_REQUIRED')
      } finally {
        config.sebMode = originalMode
      }
    })

    it('in enforce mode: accepts valid 64-hex hash and calls next()', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const path = `/api/v1/attempts/exams/${sebExam.id}/start`
        const expectedUrl = `${config.publicOrigin}${path}`
        const validHash = crypto.createHash('sha256').update(expectedUrl + VALID_64_HEX).digest('hex').toLowerCase()

        const req = {
          user: { id: studentUser.id, role: 'STUDENT' },
          params: { examId: sebExam.id },
          originalUrl: path,
          headers: {
            'x-safeexambrowser-configkeyhash': validHash
          }
        }
        const res = createMockRes()

        let nextCalled = false
        await new Promise((resolve, reject) => {
          verifySeb(req, res, (err) => {
            if (err) return reject(err)
            nextCalled = true
            resolve()
          })
        })

        assert.ok(nextCalled)
        assert.strictEqual(req.seb.mode, 'enforce')
        assert.strictEqual(req.seb.verified, true)
      } finally {
        config.sebMode = originalMode
      }
    })

    it('in log mode: never blocks on invalid header, attaches verified=false and calls next()', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'log'
      try {
        const path = `/api/v1/attempts/exams/${sebExam.id}/start`
        const req = {
          user: { id: studentUser.id, role: 'STUDENT' },
          params: { examId: sebExam.id },
          originalUrl: path,
          headers: {
            'x-safeexambrowser-configkeyhash': '0000000000000000000000000000000000000000000000000000000000000000'
          }
        }
        const res = createMockRes()

        let nextCalled = false
        await new Promise((resolve, reject) => {
          verifySeb(req, res, (err) => {
            if (err) return reject(err)
            nextCalled = true
            resolve()
          })
        })

        assert.ok(nextCalled, 'Log mode must never block request')
        assert.strictEqual(req.seb.mode, 'log')
        assert.strictEqual(req.seb.verified, false)
      } finally {
        config.sebMode = originalMode
      }
    })

    it('in-process cache serves settings for 60s and invalidates on updateExam', async () => {
      clearAllSebCaches()
      const first = await getCachedSebSettings(sebExam.id)
      assert.strictEqual(first.sebRequired, true)

      // Direct DB update bypassing service to test that cache returns stale until invalidated
      await prisma.exam.update({
        where: { id: sebExam.id },
        data: { proctoringConfig: { sebRequired: false } }
      })

      const cached = await getCachedSebSettings(sebExam.id)
      assert.strictEqual(cached.sebRequired, true, 'Should return cached value within 60s TTL')

      // Invalidate cache
      invalidateExamSebCache(sebExam.id)
      const fresh = await getCachedSebSettings(sebExam.id)
      assert.strictEqual(fresh.sebRequired, false, 'Should fetch updated value after invalidation')

      // Restore
      await examService.updateExam(sebExam.id, {
        proctoringConfig: { sebRequired: true, sebConfigKey: VALID_64_HEX }
      })
    })
  })

  describe('6. Attempt Verification Flag & Socket.IO Enforcement', () => {
    it('tracks verified status for attempt across in-process and Redis checks', async () => {
      const dummyAttemptId = `att-test-${Date.now()}`
      assert.strictEqual(await isAttemptSebVerified(dummyAttemptId), false)

      markAttemptSebVerified(dummyAttemptId)
      assert.strictEqual(await isAttemptSebVerified(dummyAttemptId), true)
    })

    it('refuses Socket.IO attempt:join in enforce mode when attempt is unverified', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const { registerSocketEvents } = require('../src/infra/websocket/socketHandlers')
        const dummyAttempt = await prisma.examAttempt.create({
          data: {
            studentId: studentUser.id,
            examId: sebExam.id,
            status: 'IN_PROGRESS'
          }
        })

        let registeredHandlers = {}
        const mockSocket = {
          user: { id: studentUser.id, role: 'student' },
          authorizedAttempts: new Set(),
          join: () => {},
          emit: () => {},
          on: (event, handler) => {
            registeredHandlers[event] = handler
          }
        }

        registerSocketEvents({}, mockSocket, new Map())
        assert.ok(typeof registeredHandlers['attempt:join'] === 'function')

        // Attempt is unverified -> must reject with SEB_REQUIRED
        let ackResult = null
        await registeredHandlers['attempt:join']({ attemptId: dummyAttempt.id }, (res) => {
          ackResult = res
        })

        assert.strictEqual(ackResult.success, false)
        assert.strictEqual(ackResult.code, 'SEB_REQUIRED')

        // Now mark attempt as verified -> must accept
        markAttemptSebVerified(dummyAttempt.id)
        let ackSuccessResult = null
        await registeredHandlers['attempt:join']({ attemptId: dummyAttempt.id }, (res) => {
          ackSuccessResult = res
        })

        assert.strictEqual(ackSuccessResult.success, true)
        assert.strictEqual(ackSuccessResult.attemptId, dummyAttempt.id)

        await prisma.examAttempt.delete({ where: { id: dummyAttempt.id } }).catch(() => {})
      } finally {
        config.sebMode = originalMode
      }
    })
  })

  describe('7. HTTP Integration on Wired Attempt Routes', () => {
    let httpAppServer = null
    let serverBaseUrl = ''
    let publishedSebExam = null
    let studentToken = null
    let facultyToken = null
    let sampleQuestion = null

    before(async () => {
      const { app, server } = require('../src/app')
      const { signToken } = require('../src/utils/jwt')

      studentToken = signToken({ id: studentUser.id, role: 'STUDENT', email: studentUser.email })
      facultyToken = signToken({ id: facultyUser.id, role: 'FACULTY', email: facultyUser.email })

      const now = Date.now()
      publishedSebExam = await prisma.exam.create({
        data: {
          title: `Published SEB Exam ${now}`,
          courseCode: 'SEB-INTEG',
          durationMinutes: 60,
          startTime: new Date(now - 60000),
          endTime: new Date(now + 7200000),
          status: 'PUBLISHED',
          createdById: facultyUser.id,
          proctoringConfig: {
            sebRequired: true,
            sebConfigKey: VALID_64_HEX
          }
        }
      })
      createdExamIds.push(publishedSebExam.id)

      sampleQuestion = await prisma.question.create({
        data: {
          examId: publishedSebExam.id,
          questionText: 'What is 2 + 2?',
          options: ['3', '4', '5'],
          correctOptionIndex: 1,
          marks: 5,
          displayOrder: 1
        }
      })

      await new Promise((resolve) => {
        httpAppServer = server.listen(0, '127.0.0.1', () => {
          const port = httpAppServer.address().port
          serverBaseUrl = `http://127.0.0.1:${port}`
          resolve()
        })
      })
    })

    after(async () => {
      if (sampleQuestion?.id) {
        await prisma.question.delete({ where: { id: sampleQuestion.id } }).catch(() => {})
      }
      if (httpAppServer) {
        await new Promise((resolve) => httpAppServer.close(resolve))
      }
    })

    it('GET /exams/:id is NOT gated by SEB middleware', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const res = await fetch(`${serverBaseUrl}/api/v1/exams/${publishedSebExam.id}`, {
          headers: {
            Authorization: `Bearer ${studentToken}`
          }
        })
        assert.strictEqual(res.status, 200, 'GET /exams/:id must not be blocked by SEB')
        const data = await res.json()
        assert.strictEqual(data.exam.id, publishedSebExam.id)
      } finally {
        config.sebMode = originalMode
      }
    })

    it('POST /attempts/exams/:id/start requires valid SEB header in enforce mode', async () => {
      const originalMode = config.sebMode
      config.sebMode = 'enforce'
      try {
        const startPath = `/api/v1/attempts/exams/${publishedSebExam.id}/start`

        // 1. Without SEB header -> 403 SEB_REQUIRED
        const rejectedRes = await fetch(`${serverBaseUrl}${startPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`
          }
        })
        assert.strictEqual(rejectedRes.status, 403)
        const rejectBody = await rejectedRes.json()
        assert.strictEqual(rejectBody.code, 'SEB_REQUIRED')

        // 2. With valid SEB header -> 200 success
        const expectedUrl = `${config.publicOrigin}${startPath}`
        const validHash = crypto.createHash('sha256').update(expectedUrl + VALID_64_HEX).digest('hex').toLowerCase()

        const allowedRes = await fetch(`${serverBaseUrl}${startPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'X-SafeExamBrowser-ConfigKeyHash': validHash
          }
        })
        assert.strictEqual(allowedRes.status, 200)
        const allowBody = await allowedRes.json()
        assert.strictEqual(allowBody.status, 'success')
        assert.ok(allowBody.attempt?.id)

        const attemptId = allowBody.attempt.id

        // 3. Verify attempt was automatically marked verified
        assert.strictEqual(await isAttemptSebVerified(attemptId), true)

        // 4. Save answer with invalid SEB header -> 403
        const answerPath = `/api/v1/attempts/${attemptId}/answers`
        const answerRejectedRes = await fetch(`${serverBaseUrl}${answerPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
            'X-SafeExamBrowser-ConfigKeyHash': 'bad-hash'
          },
          body: JSON.stringify({
            questionId: sampleQuestion.id,
            selectedOptionIndex: 1
          })
        })
        assert.strictEqual(answerRejectedRes.status, 403)

        // 5. Save answer with valid SEB header -> 200
        const expectedAnswerUrl = `${config.publicOrigin}${answerPath}`
        const validAnswerHash = crypto.createHash('sha256').update(expectedAnswerUrl + VALID_64_HEX).digest('hex').toLowerCase()

        const answerAllowedRes = await fetch(`${serverBaseUrl}${answerPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
            'X-SafeExamBrowser-ConfigKeyHash': validAnswerHash
          },
          body: JSON.stringify({
            questionId: sampleQuestion.id,
            selectedOptionIndex: 1
          })
        })
        assert.strictEqual(answerAllowedRes.status, 200)

        // 6. Verify existing saved answer in DB
        const savedAnswers = await prisma.attemptAnswer.findMany({ where: { attemptId } })
        assert.strictEqual(savedAnswers.length, 1)
        assert.strictEqual(savedAnswers[0].selectedOptionIndex, 1)

        // 7. Verify failure isolation: sending bad header next time does NOT destroy saved answers
        const subsequentBadRes = await fetch(`${serverBaseUrl}${answerPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
            'X-SafeExamBrowser-ConfigKeyHash': '0000000000000000000000000000000000000000000000000000000000000000'
          },
          body: JSON.stringify({
            questionId: sampleQuestion.id,
            selectedOptionIndex: 2
          })
        })
        assert.strictEqual(subsequentBadRes.status, 403)
        const savedAnswersUntouched = await prisma.attemptAnswer.findMany({ where: { attemptId } })
        assert.strictEqual(savedAnswersUntouched.length, 1)
        assert.strictEqual(savedAnswersUntouched[0].selectedOptionIndex, 1, 'Previous answer must remain untouched')

        // 8. GET /attempts/:attemptId: Student requires SEB, Faculty bypasses
        const getAttemptPath = `/api/v1/attempts/${attemptId}`
        const studentGetRejected = await fetch(`${serverBaseUrl}${getAttemptPath}`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        })
        assert.strictEqual(studentGetRejected.status, 403)

        const facultyGetAllowed = await fetch(`${serverBaseUrl}${getAttemptPath}`, {
          headers: { Authorization: `Bearer ${facultyToken}` }
        })
        assert.strictEqual(facultyGetAllowed.status, 200, 'Faculty must bypass SEB gating on attempt view')
      } finally {
        config.sebMode = originalMode
      }
    })
  })
})
