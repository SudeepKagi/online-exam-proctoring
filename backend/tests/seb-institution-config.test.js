'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const http = require('http')

const config = require('../src/shared/config')
const { app, server: appServer } = require('../src/app')
const { signToken } = require('../src/utils/jwt')
const { prisma } = require('../src/infra/postgres/client')
const { settingsService } = require('../src/modules/admin/settings.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { generateSebLaunchToken, verifySebLaunchToken } = require('../src/modules/seb/sebToken')

const VALID_KEY = '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'
const XML_SEB_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>sendBrowserExamKey</key>
  <true/>
</dict>
</plist>`

// Encrypted SEB header: 'seb\0' + mock payload
const ENCRYPTED_SEB_CONTENT = Buffer.concat([
  Buffer.from([0x73, 0x65, 0x62, 0x00]),
  Buffer.from('mock-encrypted-seb-payload-binary-bytes-data')
])

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
      if (Buffer.isBuffer(postBody)) {
        req.write(postBody)
      } else if (typeof postBody === 'object') {
        req.write(JSON.stringify(postBody))
      } else {
        req.write(postBody)
      }
    }
    req.end()
  })
}

function makeMultipartBody(filename, fileBuffer, fields = {}) {
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`
  const chunks = []

  // Add text fields
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ))
  }

  // Add file
  if (fileBuffer !== null) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/seb\r\n\r\n`
    ))
    chunks.push(Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer))
    chunks.push(Buffer.from('\r\n'))
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(chunks)
  return {
    boundary,
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    }
  }
}

describe('Step 5: Institution-Wide Safe Exam Browser Setup Suite', () => {
  let runningServer = null
  let serverPort = null
  let serverBaseUrl = null

  let adminUser = null
  let studentUser = null
  let facultyUser = null

  let adminToken = null
  let studentToken = null
  let facultyToken = null

  before(async () => {
    await new Promise((resolve) => {
      runningServer = appServer.listen(0, '127.0.0.1', () => {
        serverPort = runningServer.address().port
        serverBaseUrl = `http://127.0.0.1:${serverPort}`
        config.publicOrigin = serverBaseUrl
        resolve()
      })
    })

    // Setup Admin
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin-seb5-${Date.now()}@proctornet.com`,
          fullName: 'SEB Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu'
        }
      })
    }
    adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role, status: adminUser.status })

    // Setup Student
    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT', email: { not: { contains: 'load' } } } })
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: `student-seb5-${Date.now()}@proctornet.com`,
          fullName: 'SEB Student',
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu'
        }
      })
    }
    studentToken = signToken({ id: studentUser.id, email: studentUser.email, role: studentUser.role, status: studentUser.status })

    // Setup Faculty
    facultyUser = await prisma.user.findFirst({ where: { role: 'FACULTY', email: { not: { contains: 'load' } } } })
    if (!facultyUser) {
      facultyUser = await prisma.user.create({
        data: {
          email: `fac-seb5-${Date.now()}@proctornet.com`,
          fullName: 'SEB Faculty',
          role: 'FACULTY',
          status: 'ACTIVE',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu'
        }
      })
    }
    facultyToken = signToken({ id: facultyUser.id, email: facultyUser.email, role: facultyUser.role, status: facultyUser.status })
  })

  after(async () => {
    if (runningServer) {
      await new Promise((resolve) => runningServer.close(resolve))
    }
    // Clean up institution settings
    await settingsService.deleteSebConfig()
  })

  // ── 1. Unit Tests: HMAC Token Signing & Validation ───────────────────────
  describe('HMAC Token Signing & Verification', () => {
    it('generates a user-bound token with 10-minute expiry', () => {
      const token = generateSebLaunchToken({
        userId: 'student-123',
        role: 'STUDENT',
        examId: 'exam-abc',
        expMinutes: 10
      })

      assert.ok(typeof token === 'string')
      assert.ok(token.includes('.'))

      const verification = verifySebLaunchToken(token)
      assert.strictEqual(verification.valid, true)
      assert.strictEqual(verification.payload.uid, 'student-123')
      assert.strictEqual(verification.payload.role, 'STUDENT')
      assert.strictEqual(verification.payload.examId, 'exam-abc')
      assert.ok(verification.payload.exp > Math.floor(Date.now() / 1000))
    })

    it('rejects tampered launch tokens', () => {
      const token = generateSebLaunchToken({
        userId: 'student-123',
        role: 'STUDENT',
        expMinutes: 10
      })

      const [payloadStr, sig] = token.split('.')
      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({ uid: 'attacker', role: 'ADMIN', exp: 9999999999 })).toString('base64url')
      const tamperedToken = `${tamperedPayload}.${sig}`

      const verification = verifySebLaunchToken(tamperedToken)
      assert.strictEqual(verification.valid, false)
      assert.strictEqual(verification.error, 'INVALID_SIGNATURE')
    })

    it('rejects expired launch tokens', () => {
      // Generate token that expired 1 second ago
      const token = generateSebLaunchToken({
        userId: 'student-123',
        role: 'STUDENT',
        expMinutes: -1
      })

      const verification = verifySebLaunchToken(token)
      assert.strictEqual(verification.valid, false)
      assert.strictEqual(verification.error, 'TOKEN_EXPIRED')
    })

    it('handles .seb suffix stripping cleanly in verifySebLaunchToken', () => {
      const token = generateSebLaunchToken({
        userId: 'student-123',
        role: 'STUDENT',
        expMinutes: 10
      })

      const withExt = `${token}.seb`
      const verification = verifySebLaunchToken(withExt)
      assert.strictEqual(verification.valid, true)
      assert.strictEqual(verification.payload.uid, 'student-123')
    })
  })

  // ── 2. Admin API RBAC & Access Control ──────────────────────────────────
  describe('Admin API Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET'
      })
      assert.strictEqual(res.statusCode, 401)
    })

    it('rejects student role with 403', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      })
      assert.strictEqual(res.statusCode, 403)
    })

    it('rejects faculty role with 403', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${facultyToken}` }
      })
      assert.strictEqual(res.statusCode, 403)
    })

    it('allows admin role to access status', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      assert.strictEqual(res.statusCode, 200)
      assert.ok('configured' in res.json)
    })
  })

  // ── 3. File & Key Validation Tests ──────────────────────────────────────
  describe('File and Config Key Validation', () => {
    it('rejects file without .seb extension', async () => {
      const { body, headers } = makeMultipartBody('config.txt', 'some text', { configKey: VALID_KEY })
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'POST',
        headers: {
          ...headers,
          Authorization: `Bearer ${adminToken}`
        }
      }, body)

      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.json?.code, 'INVALID_FILE_EXTENSION')
    })

    it('rejects non-SEB format file content', async () => {
      const { body, headers } = makeMultipartBody('config.seb', 'random corrupt binary content not seb', { configKey: VALID_KEY })
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'POST',
        headers: {
          ...headers,
          Authorization: `Bearer ${adminToken}`
        }
      }, body)

      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.json?.code, 'INVALID_SEB_FILE')
    })

    it('rejects invalid 64-hex configKey', async () => {
      const { body, headers } = makeMultipartBody('config.seb', ENCRYPTED_SEB_CONTENT, { configKey: 'invalid-not-64-hex' })
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'POST',
        headers: {
          ...headers,
          Authorization: `Bearer ${adminToken}`
        }
      }, body)

      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.json?.code, 'INVALID_CONFIG_KEY')
    })

    it('accepts unencrypted XML .seb file and returns warning', async () => {
      const { body, headers } = makeMultipartBody('exam.seb', XML_SEB_CONTENT, { configKey: VALID_KEY })
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'POST',
        headers: {
          ...headers,
          Authorization: `Bearer ${adminToken}`
        }
      }, body)

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.ok(res.json?.warning?.includes('unencrypted'), 'Must warn if file appears unencrypted')
      assert.strictEqual(res.json?.status?.configured, true)
      assert.strictEqual(res.json?.status?.keyLast4, VALID_KEY.slice(-4))
    })

    it('never exposes the raw Config Key in any response', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.configured, true)
      assert.strictEqual(res.json?.keyLast4, VALID_KEY.slice(-4))
      // Assert full key is not in JSON or raw response body
      assert.strictEqual(res.body.includes(VALID_KEY), false, 'Raw key must never be leaked in status response')
      assert.strictEqual('configKey' in res.json, false)
    })

    it('successfully uploads encrypted .seb file with no warning', async () => {
      const { body, headers } = makeMultipartBody('exam.seb', ENCRYPTED_SEB_CONTENT, { configKey: VALID_KEY })
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'POST',
        headers: {
          ...headers,
          Authorization: `Bearer ${adminToken}`
        }
      }, body)

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(res.json?.warning, null)
      assert.strictEqual(res.json?.status?.configured, true)
    })
  })

  // ── 4. Proof by Use: GET /api/v1/seb/ping ───────────────────────────────
  describe('Proof by Use: GET /api/v1/seb/ping', () => {
    it('is accessible without authentication and returns verified:false when header missing', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET'
      })

      assert.strictEqual(res.statusCode, 200)
      assert.deepStrictEqual(res.json, { verified: false })
    })

    it('returns verified:false when header is invalid hex or mismatched', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET',
        headers: {
          'X-SafeExamBrowser-ConfigKeyHash': '0'.repeat(64)
        }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.deepStrictEqual(res.json, { verified: false })
    })

    it('returns verified:true and records lastVerifiedAt when header matches expected formula', async () => {
      const pingUrl = `${serverBaseUrl}/api/v1/seb/ping`
      const expectedHash = crypto
        .createHash('sha256')
        .update(pingUrl + VALID_KEY.toLowerCase())
        .digest('hex')
        .toLowerCase()

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET',
        headers: {
          'X-SafeExamBrowser-ConfigKeyHash': expectedHash
        }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.deepStrictEqual(res.json, { verified: true })

      // Verify that status endpoint now reflects lastVerifiedAt
      const statusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(statusRes.statusCode, 200)
      assert.ok(statusRes.json?.lastVerifiedAt, 'lastVerifiedAt must be set')
    })
  })

  // ── 5. Launch Link & Config Download ────────────────────────────────────
  describe('Launch Link & Download Endpoints', () => {
    let testExam = null

    before(async () => {
      // Create a test SEB exam for student
      const now = new Date()
      testExam = await prisma.exam.create({
        data: {
          title: 'SEB5 Launch Link Exam',
          courseCode: 'CS501',
          createdById: facultyUser.id,
          startTime: new Date(now.getTime() - 5 * 60 * 1000), // started 5 mins ago
          endTime: new Date(now.getTime() + 120 * 60 * 1000), // ends in 2 hours
          durationMinutes: 60,
          status: 'PUBLISHED',
          proctoringConfig: { sebRequired: true },
          assignments: {
            create: {
              userId: studentUser.id,
              assignedRole: 'STUDENT'
            }
          }
        }
      })
    })

    after(async () => {
      if (testExam) {
        await prisma.examAssignment.deleteMany({ where: { examId: testExam.id } })
        await prisma.exam.deleteMany({ where: { id: testExam.id } })
      }
    })

    it('allows admin to generate launch link without requiring active exam', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.ok(res.json?.url)
      // Custom scheme protocol
      assert.ok(res.json.url.startsWith('seb://') || res.json.url.startsWith('sebs://'))
      assert.ok(res.json.url.includes('/api/v1/seb/config/'))
      assert.ok(res.json.url.endsWith('.seb'))
    })

    it('allows student with active exam to generate launch link', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.ok(res.json?.url)
      assert.ok(res.json.url.includes('/api/v1/seb/config/'))
    })

    it('rejects student without active SEB exam with 403 NO_ACTIVE_SEB_EXAM', async () => {
      // Temporarily set all PUBLISHED exams with sebRequired to DRAFT
      const published = await prisma.exam.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, proctoringConfig: true }
      })
      const sebExams = published.filter(e => e.proctoringConfig && e.proctoringConfig.sebRequired).map(e => e.id)
      if (sebExams.length > 0) {
        await prisma.exam.updateMany({
          where: { id: { in: sebExams } },
          data: { status: 'DRAFT' }
        })
      }

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        }
      })

      // Restore status
      if (sebExams.length > 0) {
        await prisma.exam.updateMany({
          where: { id: { in: sebExams } },
          data: { status: 'PUBLISHED' }
        })
      }

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.json?.code, 'NO_ACTIVE_SEB_EXAM')
    })

    it('streams .seb file as application/seb attachment using valid token without cookies', async () => {
      // Generate launch link
      const linkRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })

      const launchUrl = linkRes.json?.url
      // Extract pathname from seb://host/api/v1/seb/config/<token>.seb
      const match = launchUrl.match(/\/api\/v1\/seb\/config\/([^\/]+)$/)
      assert.ok(match, 'Token must be present in launch url')
      const tokenPath = match[0]

      // Download config with NO Authorization or Cookie headers
      const downloadRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: tokenPath,
        method: 'GET'
      })

      assert.strictEqual(downloadRes.statusCode, 200)
      assert.strictEqual(downloadRes.headers['content-type'], 'application/seb')
      assert.ok(downloadRes.headers['content-disposition']?.includes('attachment'))
      assert.ok(downloadRes.headers['content-disposition']?.includes('.seb'))
    })

    it('rejects tampered token on config download with 401 INVALID_TOKEN', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/config/tamperedpayload.tamperedsignature.seb',
        method: 'GET'
      })

      assert.strictEqual(res.statusCode, 401)
      assert.strictEqual(res.json?.code, 'INVALID_TOKEN')
    })

    it('rejects expired token on config download with 401 TOKEN_EXPIRED', async () => {
      const expiredToken = generateSebLaunchToken({
        userId: adminUser.id,
        role: 'ADMIN',
        expMinutes: -5
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/config/${expiredToken}.seb`,
        method: 'GET'
      })

      assert.strictEqual(res.statusCode, 401)
      assert.strictEqual(res.json?.code, 'TOKEN_EXPIRED')
    })
  })

  // ── 6. Delete Configuration ─────────────────────────────────────────────
  describe('Delete Institution Configuration', () => {
    it('deletes configuration and removes file', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/config',
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)

      // Status should now be not configured
      const statusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/admin/seb/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(statusRes.statusCode, 200)
      assert.strictEqual(statusRes.json?.configured, false)
    })
  })
})
