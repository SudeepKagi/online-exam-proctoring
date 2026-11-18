'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'
process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_chars_long!!'
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_32_chars!!'
process.env.SEB_LINK_SECRET = 'test_seb_link_secret_key_32_chars_long!!'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const http = require('http')

const { app } = require('../src/app')
const config = require('../src/shared/config')
const { signToken } = require('../src/utils/jwt')
const { settingsService } = require('../src/modules/admin/settings.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
const { clearAllSebCaches, isAttemptSebVerified } = require('../src/middleware/seb')
const { sebTokenService } = require('../src/modules/seb/sebToken.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { prisma } = require('../src/infra/postgres/client')

const INSTITUTION_KEY = 'b3795424e489b41ccc146325fc06707fb91dd510b34495294d73224f70f7a843'
const FORGED_STARTER_KEY = '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a'

let testServer = null
let port = 0
let studentUser = null
let studentToken = null
let testExam = null
let readinessAttempt = null

function httpRequest(options, postBody = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(body)
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        })
      })
    })

    req.on('error', reject)

    if (postBody) {
      if (typeof postBody === 'object' && !Buffer.isBuffer(postBody)) {
        req.write(JSON.stringify(postBody))
      } else {
        req.write(postBody)
      }
    }
    req.end()
  })
}

function computeSebHash(url, key) {
  return crypto.createHash('sha256').update(url + key.toLowerCase()).digest('hex').toLowerCase()
}

describe('Phase 1 Security Hardening: SEB Strict Cryptographic Verification', () => {
  before(async () => {
    // Start HTTP server on dynamic port
    testServer = http.createServer(app)
    await new Promise((resolve) => testServer.listen(0, resolve))
    port = testServer.address().port

    config.publicOrigin = `http://localhost:${port}`

    // Setup student user in DB
    studentUser = await prisma.user.upsert({
      where: { email: 'phase1-student@proctornet.test' },
      update: { status: 'ACTIVE', role: 'STUDENT' },
      create: {
        email: 'phase1-student@proctornet.test',
        fullName: 'Phase 1 Security Student',
        passwordHash: 'dummy',
        role: 'STUDENT',
        status: 'ACTIVE'
      }
    })
    studentToken = signToken({ id: studentUser.id, role: 'STUDENT', email: studentUser.email })

    // Setup teacher and published exam with sebRequired: true
    const teacherUser = await prisma.user.upsert({
      where: { email: 'phase1-teacher@proctornet.test' },
      update: { status: 'ACTIVE', role: 'FACULTY' },
      create: {
        email: 'phase1-teacher@proctornet.test',
        fullName: 'Phase 1 Security Teacher',
        passwordHash: 'dummy',
        role: 'FACULTY',
        status: 'ACTIVE'
      }
    })

    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: 'Phase 1 SEB Enforce Security Exam',
        courseCode: 'SEC401',
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 120 * 60 * 1000),
        durationMinutes: 60,
        createdById: teacherUser.id,
        proctoringConfig: {
          sebRequired: true,
          identityCheck: false
        }
      }
    })

    // Create readiness attempt with verified identity so identity gate passes
    readinessAttempt = await prisma.examAttempt.create({
      data: {
        examId: testExam.id,
        studentId: studentUser.id,
        status: 'NOT_STARTED',
        faceVerified: true,
        faceStatus: 'MATCH'
      }
    })

    // Store dummy .seb file in storage adapter
    const storage = getStorageAdapter()
    await storage.putObject('phase1/test.seb', Buffer.from('dummy seb content'), 'application/x-plist')

    // Store Institution Key in SystemSetting with lastVerifiedAt set
    await settingsService.saveSebConfig({
      configKey: INSTITUTION_KEY,
      fileKey: 'phase1/test.seb',
      requestedMode: 'enforce',
      lastVerifiedAt: new Date().toISOString()
    })
    config.sebMode = 'enforce'
    process.env.SEB_MODE = 'enforce'
    invalidateInstitutionSebState()
    clearAllSebCaches()
  })

  after(async () => {
    if (testExam) {
      await prisma.examAttempt.deleteMany({ where: { examId: testExam.id } }).catch(() => {})
      await prisma.exam.delete({ where: { id: testExam.id } }).catch(() => {})
    }
    if (studentUser) {
      await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {})
    }
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve))
    }
  })

  beforeEach(() => {
    config.sebMode = 'enforce'
    process.env.SEB_MODE = 'enforce'
    clearAllSebCaches()
  })

  it('1. A forged header computed with the starter key is rejected with 403 SEB_REQUIRED', async () => {
    const targetPath = `/api/v1/attempts/exams/${testExam.id}/start`
    const canonicalUrl = `${config.publicOrigin}${targetPath}`
    const forgedHash = computeSebHash(canonicalUrl, FORGED_STARTER_KEY)

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: targetPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': forgedHash
      }
    }, {})

    assert.strictEqual(res.statusCode, 403, 'Must reject starter key in enforce mode')
    assert.strictEqual(res.json?.code, 'SEB_REQUIRED')
  })

  it('2. A launch token redeemed with no header or bad header is refused in enforce mode and marks nothing', async () => {
    const launch = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: studentUser.role,
      examId: testExam.id,
      purpose: 'exam'
    })

    // Attempt exchange without header in enforce mode
    const exchangePath = `/api/v1/seb/exchange?launch=${launch.launchToken}`
    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: exchangePath,
      method: 'GET',
      headers: {
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        Accept: 'application/json'
      }
    })

    assert.strictEqual(res.statusCode, 403, 'Must refuse token exchange without header in enforce mode')
    assert.strictEqual(res.json?.code, 'SEB_ENFORCEMENT_FAILED')

    // Verify no auth cookie was set
    const setCookie = res.headers['set-cookie'] || []
    const hasAuthCookie = setCookie.some((c) => c.startsWith('proctornet_auth=') || c.startsWith('pn_at='))
    assert.strictEqual(hasAuthCookie, false, 'Must not issue auth cookie on failed verification')

    // Attempt exchangePin without header in enforce mode
    const pinRes = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
      }
    }, { pin: launch.pin })

    assert.strictEqual(pinRes.statusCode, 403, 'Must refuse PIN exchange without header in enforce mode')
    assert.strictEqual(pinRes.json?.code, 'SEB_ENFORCEMENT_FAILED')
  })

  it('3. Exact-URL rule: Header computed for a different URL is rejected with 403', async () => {
    const targetPath = `/api/v1/attempts/exams/${testExam.id}/start`
    // Client erroneously computes hash using /seb/enter instead of targetPath
    const wrongUrl = `${config.publicOrigin}/seb/enter`
    const wrongHash = computeSebHash(wrongUrl, INSTITUTION_KEY)

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: targetPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': wrongHash
      }
    }, {})

    assert.strictEqual(res.statusCode, 403, 'Must reject hash matching candidate URL loops under exact-URL rule')
    assert.strictEqual(res.json?.code, 'SEB_REQUIRED')
  })

  it('4. Correct header matching canonical URL and stored institution key passes 200', async () => {
    const targetPath = `/api/v1/attempts/exams/${testExam.id}/start`
    const canonicalUrl = `${config.publicOrigin}${targetPath}`
    const validHash = computeSebHash(canonicalUrl, INSTITUTION_KEY)

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: targetPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': validHash
      }
    }, {})

    assert.strictEqual(res.statusCode, 200, 'Must accept exact canonical URL and valid institution key')
    assert.strictEqual(res.json?.status, 'success')
    assert.ok(res.json?.attempt?.id, 'Must return started attempt')
  })

  it('5. SEB-simulated end-to-end journey passes under strict verification', async () => {
    // Step A: Generate launch token & PIN
    const launch = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: studentUser.role,
      examId: testExam.id,
      purpose: 'exam'
    })

    // Step B: Exchange token with valid header
    const exchangePath = `/api/v1/seb/exchange?launch=${launch.launchToken}`
    const exchangeCanonicalUrl = `${config.publicOrigin}${exchangePath}`
    const exchangeHash = computeSebHash(exchangeCanonicalUrl, INSTITUTION_KEY)

    const exchangeRes = await httpRequest({
      hostname: 'localhost',
      port,
      path: exchangePath,
      method: 'GET',
      headers: {
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': exchangeHash,
        Accept: 'application/json'
      }
    })

    assert.strictEqual(exchangeRes.statusCode, 200, 'Exchange must succeed with valid header')
    const cookies = exchangeRes.headers['set-cookie'] || []
    const authCookieHeader = cookies.find((c) => c.startsWith('proctornet_auth=') || c.startsWith('pn_at='))
    assert.ok(authCookieHeader, 'Must issue auth cookie')
    const authCookie = authCookieHeader.split(';')[0]

    // Step C: Attempt get state with valid header
    const attemptId = (await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: testExam.id, studentId: studentUser.id } }
    }))?.id

    const statePath = `/api/v1/attempts/${attemptId}`
    const stateCanonicalUrl = `${config.publicOrigin}${statePath}`
    const stateHash = computeSebHash(stateCanonicalUrl, INSTITUTION_KEY)

    const stateRes = await httpRequest({
      hostname: 'localhost',
      port,
      path: statePath,
      method: 'GET',
      headers: {
        Cookie: authCookie,
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': stateHash
      }
    })

    assert.strictEqual(stateRes.statusCode, 200, 'Attempt state must succeed with valid header')
  })
})
