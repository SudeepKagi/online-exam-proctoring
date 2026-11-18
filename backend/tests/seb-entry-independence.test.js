'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const crypto = require('crypto')

const { sebTokenService, LAUNCH_TOKEN_TTL_MS } = require('../src/modules/seb/sebToken.service')
const { settingsService } = require('../src/modules/admin/settings.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
const { inspectSebBuffer } = require('../src/modules/seb/sebConfigChecker')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { prisma } = require('../src/infra/postgres/client')
const { app, server: appServer } = require('../src/app')

function httpRequest({ hostname, port, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname,
      port,
      path,
      method,
      headers: { ...headers }
    }
    if (body && typeof body === 'object' && !headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json'
    }

    const req = http.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let json = null
        try {
          json = JSON.parse(raw)
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: raw,
          json
        })
      })
    })

    req.on('error', reject)
    if (body) {
      req.write(typeof body === 'object' ? JSON.stringify(body) : body)
    }
    req.end()
  })
}

describe('Safe Exam Browser (SEB) Entry Independence & Launch Code Suite (§Phase 2)', () => {
  let server
  let serverPort
  let testStudent
  let testExam
  const VALID_CONFIG_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

  before(async () => {
    await new Promise((resolve) => {
      server = appServer.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port
        resolve()
      })
    })

    // Setup seed test student and exam
    const testEmail = `seb-entry-student-${Date.now()}@proctornet.test`
    testStudent = await prisma.user.create({
      data: {
        email: testEmail,
        fullName: 'SEB Entry Student',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash: '$2a$12$eXampleHashedPasswordForTestOnly12345678901234567890'
      }
    })

    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: 'SEB Entry Independence Exam',
        courseCode: 'CS301',
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
        durationMinutes: 60,
        createdById: testStudent.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_CONFIG_KEY
        }
      }
    })

    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_CONFIG_KEY,
      startUrl: 'https://proctornet.duckdns.org/seb/enter',
      uploadedAt: new Date().toISOString()
    })
    invalidateInstitutionSebState()
  })

  after(async () => {
    sebTokenService.clear()
    await prisma.exam.deleteMany({ where: { courseCode: 'CS301' } }).catch(() => {})
    await prisma.user.deleteMany({ where: { email: { contains: 'seb-entry-student' } } }).catch(() => {})
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  beforeEach(async () => {
    delete process.env.SEB_MODE
    sebTokenService.clear()
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-file'), 'application/seb')
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_CONFIG_KEY,
      startUrl: 'https://proctornet.duckdns.org/seb/enter',
      uploadedAt: new Date().toISOString(),
      requestedMode: 'audit'
    })
    invalidateInstitutionSebState()
  })

  describe('1. SEB Detection: User Agent & Config Key Header', () => {
    it('GET /api/v1/seb/ping reports headerPresent: true when X-SafeExamBrowser-ConfigKeyHash is passed', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET',
        headers: {
          'x-safeexambrowser-configkeyhash': 'b3795424e489b41ccc146325fc06707fb91dd510b34495294d73224f70f7a843',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.140 Safari/537.36 SEB/3.10.3'
        }
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.headerPresent, true)
      assert.strictEqual(res.json?.isSebAgent, true)
    })

    it('GET /api/v1/seb/ping reports headerPresent: false and isSebAgent: false for plain Chrome browser without headers', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
        }
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.headerPresent, false)
      assert.strictEqual(res.json?.isSebAgent, false)
    })

    it('GET /api/v1/seb/ping reports isSebAgent: true when SEB UA is passed even without header', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/ping',
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SafeExamBrowser/3.10.3'
        }
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.headerPresent, false)
      assert.strictEqual(res.json?.isSebAgent, true)
    })
  })

  describe('2. Launch Code: 6 Digits, 5 Minutes TTL, Single-Use & Hashed', () => {
    it('creates 6-digit numeric PIN with 5-minute validity', () => {
      const token = sebTokenService.createLaunchToken({
        userId: testStudent.id,
        userRole: 'STUDENT',
        examId: testExam.id
      })
      assert.ok(/^\d{6}$/.test(token.pin), 'PIN must be exactly 6 digits')
      assert.ok(token.expiresAt > Date.now() + 4 * 60 * 1000, 'TTL must be ~5 minutes')
      assert.ok(token.expiresAt <= Date.now() + 5 * 60 * 1000 + 500, 'TTL must not exceed 5 minutes')
    })

    it('exchanges correct 6-digit code for authenticated user session and returns lobby URL', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testStudent.id,
        userRole: 'STUDENT',
        examId: testExam.id
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 SEB/3.10.3'
        },
        body: { pin: token.pin }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(res.json?.redirectUrl, `/student/exams/${testExam.id}/start`)
      assert.strictEqual(res.json?.user?.id, testStudent.id)
      assert.ok(res.json?.token, 'Must return session access token')

      // Verifies HttpOnly set-cookie headers
      const setCookies = res.headers['set-cookie']
      assert.ok(setCookies && setCookies.length > 0, 'Must issue authentication cookies')
    })

    it('rejects wrong 6-digit code with friendly 401 INVALID_PIN / INVALID_CODE', async () => {
      sebTokenService.createLaunchToken({
        userId: testStudent.id,
        userRole: 'STUDENT',
        examId: testExam.id
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: '999999' }
      })

      assert.strictEqual(res.statusCode, 401)
      assert.ok(['INVALID_PIN', 'INVALID_CODE'].includes(res.json?.code))
      assert.ok(res.json?.message?.includes('Invalid') || res.json?.message?.includes('invalid'))
    })

    it('rejects reused 6-digit code with 409 PIN_ALREADY_USED / CODE_USED', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testStudent.id,
        userRole: 'STUDENT',
        examId: testExam.id
      })

      // First exchange: succeeds
      const firstRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: token.pin }
      })
      assert.strictEqual(firstRes.statusCode, 200)

      // Second exchange: rejected
      const secondRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: token.pin }
      })
      assert.strictEqual(secondRes.statusCode, 409)
      assert.ok(['PIN_ALREADY_USED', 'CODE_USED'].includes(secondRes.json?.code))
    })

    it('rejects expired 6-digit code with 401 PIN_EXPIRED / CODE_EXPIRED', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testStudent.id,
        userRole: 'STUDENT',
        examId: testExam.id
      })

      // Manually set token expired in the store
      const tokenHash = sebTokenService.hash(token.launchToken)
      const record = sebTokenService.tokens.get(tokenHash)
      record.expiresAt = Date.now() - 1000

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: token.pin }
      })

      assert.strictEqual(res.statusCode, 401)
      assert.ok(['PIN_EXPIRED', 'CODE_EXPIRED'].includes(res.json?.code))
    })

    it('enforces brute force rate limit on PIN after 5 failed attempts (429 TOO_MANY_ATTEMPTS / RATE_LIMITED)', async () => {
      for (let i = 0; i < 5; i++) {
        const attemptRes = await httpRequest({
          hostname: '127.0.0.1',
          port: serverPort,
          path: '/api/v1/seb/exchange-pin',
          method: 'POST',
          body: { pin: '888888' }
        })
        assert.strictEqual(attemptRes.statusCode, 401)
      }

      // 6th attempt on the same PIN is blocked by rate limiter
      const sixthRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: '888888' }
      })
      assert.strictEqual(sixthRes.statusCode, 429)
      assert.ok(['TOO_MANY_ATTEMPTS', 'RATE_LIMITED'].includes(sixthRes.json?.code))
    })
  })

  describe('3. Stored Config Start URL Check (§Phase 2.6)', () => {
    it('flags non-blocking warning when Start URL is not /seb/enter', () => {
      const xmlWithRoot = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>http://localhost:5000/</string>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>startURLAppendQueryParameter</key>
  <true/>
</dict>
</plist>`
      const result = inspectSebBuffer(Buffer.from(xmlWithRoot, 'utf8'), {
        publicOrigin: 'http://localhost:5000'
      })
      assert.strictEqual(result.valid, true)
      const startUrlCheck = result.checks.find((c) => c.key === 'startURL')
      assert.ok(startUrlCheck)
      assert.strictEqual(startUrlCheck.status, 'warning')
      assert.ok(startUrlCheck.message.includes('works, but update your configuration to the recommended Start URL'))
    })

    it('reports status: ok when Start URL is /seb/enter', () => {
      const xmlWithEnter = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>http://localhost:5000/seb/enter</string>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>startURLAppendQueryParameter</key>
  <true/>
</dict>
</plist>`
      const result = inspectSebBuffer(Buffer.from(xmlWithEnter, 'utf8'), {
        publicOrigin: 'http://localhost:5000'
      })
      assert.strictEqual(result.valid, true)
      const startUrlCheck = result.checks.find((c) => c.key === 'startURL')
      assert.ok(startUrlCheck)
      assert.strictEqual(startUrlCheck.status, 'ok')
    })
  })
})
