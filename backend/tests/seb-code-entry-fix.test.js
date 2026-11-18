'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'
process.env.JWT_SECRET = 'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!'
process.env.JWT_REFRESH_SECRET = 'test_suite_jwt_refresh_secret_at_least_32_chars!'
process.env.SEB_LINK_SECRET = 'test_suite_seb_link_secret_at_least_32_characters_long_for_hmac!'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const http = require('http')

const { app } = require('../src/app')
const config = require('../src/shared/config')
const { settingsService } = require('../src/modules/admin/settings.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
const { sebTokenService } = require('../src/modules/seb/sebToken.service')
const { sebDiagnosticsService } = require('../src/modules/seb/sebDiagnostics.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const jwt = require('jsonwebtoken')
const { prisma } = require('../src/infra/postgres/client')

const INSTITUTION_KEY = 'b3795424e489b41ccc146325fc06707fb91dd510b34495294d73224f70f7a843'
const STARTER_KEY = '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a'
const FORGED_KEY = '1111111111111111111111111111111111111111111111111111111111111111'

let testServer = null
let port = 0
let studentUser = null
let adminUser = null
let adminToken = null

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
      const payload = typeof postBody === 'string' ? postBody : JSON.stringify(postBody)
      req.setHeader('Content-Length', Buffer.byteLength(payload))
      req.write(payload)
    }
    req.end()
  })
}

function computeSebHash(url, key) {
  return crypto.createHash('sha256').update(url + key.toLowerCase()).digest('hex').toLowerCase()
}

describe('Phase 1: SEB Exchange Error Handling, Diagnostic Codes & Non-Destructive PIN Flow', () => {
  before(async () => {
    studentUser = await prisma.user.findFirst({
      where: { email: 'student1@institution.edu' }
    })
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: 'student1@institution.edu',
          fullName: 'Student One',
          role: 'STUDENT',
          passwordHash: 'dummy_hash',
          status: 'ACTIVE'
        }
      })
    }

    adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin_test@institution.edu',
          fullName: 'Admin User',
          role: 'ADMIN',
          passwordHash: 'dummy_hash',
          status: 'ACTIVE'
        }
      })
    }
    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'ADMIN', status: 'ACTIVE' },
      config.jwtSecret || process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    testServer = http.createServer(app)
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        port = testServer.address().port
        resolve()
      })
    })
  })

  after(async () => {
    delete process.env.SEB_MODE
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: INSTITUTION_KEY,
      lastVerifiedAt: new Date().toISOString(),
      requestedMode: 'audit'
    }).catch(() => {})
    invalidateInstitutionSebState()
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve))
    }
  })

  beforeEach(async () => {
    delete process.env.SEB_MODE
    sebDiagnosticsService.clearHistory()
    sebTokenService.clear()
    invalidateInstitutionSebState()

    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-file'), 'application/seb')

    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: INSTITUTION_KEY,
      lastVerifiedAt: new Date().toISOString(),
      requestedMode: 'enforce'
    })
    invalidateInstitutionSebState()
  })

  it('1. Returns INVALID_CODE with requestId for non-existent PIN without burning state', async () => {
    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
      }
    }, { pin: '999999' })

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.json?.code, 'INVALID_CODE')
    assert.ok(res.json?.requestId, 'Must return requestId for student reference')
  })

  it('2. Returns CODE_EXPIRED with requestId for expired PIN', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })
    // Force expiration
    const record = sebTokenService.tokens.get(sebTokenService.hash(token.launchToken))
    if (record) record.expiresAt = Date.now() - 1000

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
      }
    }, { pin: token.pin })

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.json?.code, 'CODE_EXPIRED')
    assert.ok(res.json?.requestId, 'Must return requestId')
  })

  it('3. In enforce mode with missing header: returns SEB_HEADER_MISSING and DOES NOT burn the PIN', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    // Attempt PIN exchange without X-SafeExamBrowser-ConfigKeyHash header
    const res1 = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
      }
    }, { pin: token.pin })

    assert.strictEqual(res1.statusCode, 403)
    assert.strictEqual(res1.json?.code, 'SEB_HEADER_MISSING')
    assert.ok(res1.json?.requestId, 'Must return requestId')

    // PIN MUST NOT BE CONSUMED! Retry with valid header must succeed!
    const targetUrl = `${config.publicOrigin}/api/v1/seb/exchange-pin`
    const validHash = computeSebHash(targetUrl, INSTITUTION_KEY)

    const res2 = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': validHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res2.statusCode, 200, 'Must succeed when retried with valid header because PIN was preserved')
    assert.strictEqual(res2.json?.success, true)
  })

  it('4. In enforce mode with mismatched header: returns SEB_HEADER_MISMATCH and DOES NOT burn the PIN', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const targetUrl = `${config.publicOrigin}/api/v1/seb/exchange-pin`
    const wrongHash = computeSebHash(targetUrl, FORGED_KEY)

    const res1 = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': wrongHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res1.statusCode, 403)
    assert.strictEqual(res1.json?.code, 'SEB_HEADER_MISMATCH')
    assert.ok(res1.json?.requestId)

    // Now retry with valid hash
    const validHash = computeSebHash(targetUrl, INSTITUTION_KEY)
    const res2 = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': validHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res2.statusCode, 200)
    assert.strictEqual(res2.json?.success, true)

    // And once successfully consumed, subsequent exchange returns CODE_USED
    const res3 = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': validHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res3.statusCode, 409)
    assert.strictEqual(res3.json?.code, 'CODE_USED')
  })

  it('5. Strictly rejects x-safeexambrowser-requesthash as Configuration Key proof', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const targetUrl = `${config.publicOrigin}/api/v1/seb/exchange-pin`
    const bekHash = computeSebHash(targetUrl, INSTITUTION_KEY)

    // Send hash under legacy Browser Exam Key header x-safeexambrowser-requesthash
    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'x-safeexambrowser-requesthash': bekHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.json?.code, 'SEB_HEADER_MISSING', 'Must not accept requesthash header as Config Key proof')
  })

  it('6. Returns INSTITUTION_NOT_CONFIGURED when institution key is missing', async () => {
    process.env.SEB_MODE = 'enforce'
    await settingsService.deleteSebConfig()
    invalidateInstitutionSebState()

    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
      }
    }, { pin: token.pin })

    assert.strictEqual(res.statusCode, 503)
    assert.strictEqual(res.json?.code, 'INSTITUTION_NOT_CONFIGURED')

    delete process.env.SEB_MODE
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-file'), 'application/seb')
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: INSTITUTION_KEY,
      lastVerifiedAt: new Date().toISOString(),
      requestedMode: 'enforce'
    })
    invalidateInstitutionSebState()
  })

  it('7. In audit/log mode: succeeds with standard browser or missing header and issues auth cookies', async () => {
    await settingsService.saveSebConfig({ requestedMode: 'audit' })
    invalidateInstitutionSebState()

    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
      }
    }, { pin: token.pin })

    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json?.success, true)
    const setCookie = res.headers['set-cookie'] || []
    const hasAuthCookie = setCookie.some((c) => c.startsWith('proctornet_auth=') || c.startsWith('pn_at='))
    assert.strictEqual(hasAuthCookie, true, 'Must issue authentication cookie in log mode')
  })

  it('8. Strictly refuses starter-key header as Config Key proof when custom institution key is active', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const targetUrl = `${config.publicOrigin}/api/v1/seb/exchange-pin`
    const starterHash = computeSebHash(targetUrl, STARTER_KEY)

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/seb/exchange-pin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)',
        'X-SafeExamBrowser-ConfigKeyHash': starterHash
      }
    }, { pin: token.pin })

    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.json?.code, 'SEB_HEADER_MISMATCH', 'Starter key must not match configured institution key')
  })

  it('9. In enforce mode: launch URL (?launch=...) redeemed without SEB header gets no session and returns 403', async () => {
    const token = sebTokenService.createLaunchToken({
      userId: studentUser.id,
      userRole: 'STUDENT',
      purpose: 'exam'
    })

    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: `/api/v1/seb/exchange?launch=${token.launchToken}`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
      }
    })

    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.json?.code, 'SEB_HEADER_MISSING')
    const setCookie = res.headers['set-cookie'] || []
    const hasAuthCookie = setCookie.some((c) => c.startsWith('proctornet_auth=') || c.startsWith('pn_at='))
    assert.strictEqual(hasAuthCookie, false, 'No session cookie may be issued when launch URL is redeemed without valid SEB header in enforce mode')
  })

  it('10. Admin entry-diagnostics endpoint returns object presence, key presence, probe status, failure counts, and NO key material', async () => {
    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/v1/admin/seb/entry-diagnostics',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Accept: 'application/json'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json?.success, true)
    assert.strictEqual(typeof res.json?.configObjectPresent, 'boolean')
    assert.strictEqual(typeof res.json?.keyPresent, 'boolean')
    assert.strictEqual(typeof res.json?.effectiveMode, 'string')
    assert.strictEqual(res.json?.storageProbe?.passed, true)
    assert.ok(res.json?.failureCounts24h)
    assert.strictEqual(typeof res.json?.failureCounts24h?.INVALID_CODE, 'number')
    assert.strictEqual(typeof res.json?.failureCounts24h?.SEB_HEADER_MISMATCH, 'number')
    assert.strictEqual(typeof res.json?.lastRequestIdByCode, 'object')

    // Confirm ZERO key material is returned
    assert.strictEqual(res.json?.configKey, undefined)
    assert.strictEqual(res.json?.key, undefined)
    assert.strictEqual(res.body.includes(INSTITUTION_KEY), false, 'Must never leak key material')
  })
})
