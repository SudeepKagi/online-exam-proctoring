'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const crypto = require('crypto')

const { sebTokenService, LAUNCH_TOKEN_TTL_MS } = require('../src/modules/seb/sebToken.service')
const { sanitizeLogPayload, scrubSebString } = require('../src/shared/logging')
const { settingsService } = require('../src/modules/admin/settings.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
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

describe('Safe Exam Browser (SEB) Launch Handoff & Token Service Suite', () => {
  let server
  let serverPort
  let testUser
  let testExam
  const VALID_64_HEX = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

  before(async () => {
    await new Promise((resolve) => {
      server = appServer.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port
        resolve()
      })
    })

    // Setup seed test student and exam
    const testEmail = `student-seb-test-${Date.now()}@proctornet.test`
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        fullName: 'SEB Test Student',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash: '$2a$12$eXampleHashedPasswordForTestOnly12345678901234567890'
      }
    })

    const now = new Date()
    testExam = await prisma.exam.create({
      data: {
        title: 'SEB Launch Handoff Exam',
        courseCode: 'CS101',
        status: 'PUBLISHED',
        startTime: new Date(now.getTime() - 10 * 60 * 1000), // Started 10m ago
        endTime: new Date(now.getTime() + 50 * 60 * 1000),   // Ends in 50m
        durationMinutes: 60,
        createdById: testUser.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: VALID_64_HEX
        }
      }
    })

    // Seed mock S3 .seb file
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>originatorVersion</key><string>SEB_3.0</string></dict></plist>'), 'application/seb')

    // Seed institution settings
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_64_HEX,
      requestedMode: 'audit'
    })
    invalidateInstitutionSebState()
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    await settingsService.deleteSebConfig().catch(() => {})
    invalidateInstitutionSebState()
    if (testExam) {
      await prisma.exam.delete({ where: { id: testExam.id } }).catch(() => {})
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {})
    }
  })

  beforeEach(() => {
    sebTokenService.clear()
  })

  describe('1. Cryptographic Launch Token Generation & Invalidation Invariants', () => {
    it('generates 32-byte high-entropy token, download token, and 6-digit PIN', () => {
      const res = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      assert.strictEqual(typeof res.launchToken, 'string')
      assert.strictEqual(res.launchToken.length, 64) // 32 bytes hex = 64 chars
      assert.strictEqual(typeof res.downloadToken, 'string')
      assert.strictEqual(res.downloadToken.length, 64)
      assert.match(res.pin, /^\d{6}$/)
      assert.strictEqual(res.purpose, 'exam')
      assert.strictEqual(res.examId, testExam.id)
      assert.ok(res.expiresAt > Date.now() + LAUNCH_TOKEN_TTL_MS - 5000)
    })

    it('enforces single-use: token can only be consumed once', () => {
      const res = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      const firstConsume = sebTokenService.consumeLaunchToken(res.launchToken)
      assert.strictEqual(firstConsume.status, 'SUCCESS')
      assert.strictEqual(firstConsume.record.userId, testUser.id)

      const secondConsume = sebTokenService.consumeLaunchToken(res.launchToken)
      assert.strictEqual(secondConsume.status, 'ALREADY_USED')
    })

    it('enforces single-use for PIN: consuming PIN invalidates token and vice-versa', () => {
      const res = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      const pinConsume = sebTokenService.consumePin(res.pin)
      assert.strictEqual(pinConsume.status, 'SUCCESS')

      const tokenConsume = sebTokenService.consumeLaunchToken(res.launchToken)
      assert.strictEqual(tokenConsume.status, 'ALREADY_USED')

      const secondPin = sebTokenService.consumePin(res.pin)
      assert.strictEqual(secondPin.status, 'ALREADY_USED')
    })

    it('new token generation invalidates older unconsumed tokens for the same user/exam', () => {
      const token1 = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      const token2 = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      // Old token1 should now be invalidated
      const consumeOld = sebTokenService.consumeLaunchToken(token1.launchToken)
      assert.strictEqual(consumeOld.status, 'ALREADY_USED')

      // New token2 should consume cleanly
      const consumeNew = sebTokenService.consumeLaunchToken(token2.launchToken)
      assert.strictEqual(consumeNew.status, 'SUCCESS')
    })

    it('rejects expired tokens', () => {
      const token = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      // Force expiration
      const record = sebTokenService.getTokenRecord(token.launchToken)
      assert.ok(record)
      record.expiresAt = Date.now() - 1000

      const consume = sebTokenService.consumeLaunchToken(token.launchToken)
      assert.strictEqual(consume.status, 'EXPIRED')
    })
  })

  describe('2. Config Download & Exchange Handoff Integration', () => {
    it('config download does NOT consume the launch token', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      // Download config using downloadToken
      const dlRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/config/${token.downloadToken}`,
        method: 'GET'
      })

      assert.strictEqual(dlRes.statusCode, 200)
      assert.strictEqual(dlRes.headers['content-type'], 'application/seb')

      // Token should remain unconsumed and valid
      const record = sebTokenService.getTokenRecord(token.launchToken)
      assert.ok(record)
      assert.strictEqual(record.consumedAt, null)

      // Now exchange the launch token
      const exRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/exchange?launch=${token.launchToken}`,
        method: 'GET'
      })

      assert.strictEqual(exRes.statusCode, 302)
      assert.strictEqual(exRes.headers.location, `/student/exams/${testExam.id}/start`)
      assert.ok(exRes.headers['set-cookie'])
    })

    it('rejects duplicate exchange attempt with 409 TOKEN_ALREADY_USED', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      // First exchange: 302 redirect
      const firstRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/exchange?launch=${token.launchToken}`,
        method: 'GET'
      })
      assert.strictEqual(firstRes.statusCode, 302)

      // Second exchange: 409 rejection
      const secondRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/exchange?launch=${token.launchToken}`,
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
      assert.strictEqual(secondRes.statusCode, 409)
      assert.strictEqual(secondRes.json?.code, 'TOKEN_ALREADY_USED')
    })

    it('fallback PIN exchange succeeds with 200 and auth cookies', async () => {
      const token = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      const pinRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: token.pin }
      })

      assert.strictEqual(pinRes.statusCode, 200)
      assert.strictEqual(pinRes.json?.success, true)
      assert.strictEqual(pinRes.json?.redirectUrl, `/student/exams/${testExam.id}/start`)
      assert.ok(pinRes.headers['set-cookie'])
      assert.ok(pinRes.json?.token)

      // Re-using PIN fails with 409
      const secondPin = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        body: { pin: token.pin }
      })
      assert.strictEqual(secondPin.statusCode, 409)
      assert.strictEqual(secondPin.json?.code, 'PIN_ALREADY_USED')
    })
  })

  describe('3. Security & Logging Redaction Invariants', () => {
    it('redacts launch tokens and PINs from logger payloads and URLs', () => {
      const rawUrl = 'https://proctornet.duckdns.org/api/v1/seb/exchange?launch=secretLaunchToken123456'
      const scrubbed = scrubSebString(rawUrl)
      assert.strictEqual(scrubbed.includes('secretLaunchToken123456'), false)
      assert.ok(scrubbed.includes('launch=[REDACTED]'))

      const doubleQueryUrl = 'sebs://proctornet.duckdns.org/api/v1/seb/config/abc??launch=superSecret123'
      const scrubbedDouble = scrubSebString(doubleQueryUrl)
      assert.strictEqual(scrubbedDouble.includes('superSecret123'), false)
      assert.ok(scrubbedDouble.includes('??launch=[REDACTED]'))

      const payload = {
        user: 'student',
        launch: 'secret123',
        pin: '654321',
        code: '999888'
      }
      const sanitized = sanitizeLogPayload(payload)
      assert.strictEqual(sanitized.launch, '[REDACTED]')
      assert.strictEqual(sanitized.pin, '[REDACTED]')
      assert.strictEqual(sanitized.code, '[REDACTED]')
    })

    it('enforces SEB user-agent gating when institution mode is enforce', async () => {
      // Temporarily set mode to enforce with recent verification
      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: VALID_64_HEX,
        requestedMode: 'enforce',
        lastVerifiedAt: new Date().toISOString()
      })
      invalidateInstitutionSebState()

      const token = sebTokenService.createLaunchToken({
        userId: testUser.id,
        userRole: 'STUDENT',
        examId: testExam.id,
        purpose: 'exam'
      })

      // Non-SEB browser should be rejected with 403 SEB_ENFORCEMENT_FAILED
      const chromeRes = await httpRequest({
        hostname: '127.0.0.1',
        port: serverPort,
        path: `/api/v1/seb/exchange?launch=${token.launchToken}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      assert.strictEqual(chromeRes.statusCode, 403)
      assert.strictEqual(chromeRes.json?.code, 'SEB_ENFORCEMENT_FAILED')

      // Reset back to audit mode
      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: VALID_64_HEX,
        requestedMode: 'audit'
      })
      invalidateInstitutionSebState()
    })
  })
})
