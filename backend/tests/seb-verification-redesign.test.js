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
const { signToken } = require('../src/utils/jwt')
const { settingsService } = require('../src/modules/admin/settings.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
const { inspectSebRequest, examSettingsCache } = require('../src/middleware/seb')

const VALID_KEY = '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'
let testServer = null
let port = 0
let adminToken = ''

// In-memory backing for settingsService in tests
let mockSebSettings = null

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

describe('SEB Verification Redesign Suite: Multi-Protocol & Client Key Verification', () => {
  before(async () => {
    delete process.env.SEB_CONFIG_KEY

    // Mock settingsService methods to be fully in-memory
    settingsService.getSebConfig = async () => {
      return mockSebSettings
    }

    settingsService.saveSebConfig = async (payload) => {
      mockSebSettings = {
        fileKey: payload.fileKey || 'seb/institution-config.seb',
        configKey: payload.configKey ? String(payload.configKey).trim().toLowerCase() : null,
        uploadedAt: payload.uploadedAt || new Date().toISOString(),
        lastVerifiedAt: payload.lastVerifiedAt !== undefined ? payload.lastVerifiedAt : null,
        requestedMode: payload.requestedMode || 'audit'
      }
      return mockSebSettings
    }

    settingsService.updateSebLastVerified = async (timestamp = new Date().toISOString(), meta = {}) => {
      if (mockSebSettings) {
        mockSebSettings.lastVerifiedAt = timestamp
        if (meta.method) mockSebSettings.lastVerifiedMethod = meta.method
        if (meta.userAgent) mockSebSettings.lastVerifiedUserAgent = meta.userAgent
      }
    }

    // Mock admin JWT token
    adminToken = signToken({ id: 'mock-admin-uuid', role: 'ADMIN', email: 'admin@test.edu' })

    await new Promise((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        port = testServer.address().port
        resolve()
      })
    })
  })

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve))
    }
  })

  beforeEach(async () => {
    invalidateInstitutionSebState()
    settingsService.clearMemoryCache()
    // Configure SEB in storage and settings
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-content'), 'application/seb')
    mockSebSettings = {
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: null,
      lastVerifiedMethod: null,
      lastVerifiedUserAgent: null,
      requestedMode: 'audit'
    }
  })

  it('1. POST /api/v1/seb/ping verifies via direct JavaScript API configKey payload', async () => {
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/seb/ping',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SEB/3.10.3'
      }
    }, {
      configKey: VALID_KEY,
      href: 'https://proctornet.duckdns.org/student/login'
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json?.verified, true)
    assert.equal(res.json?.method, 'javascript_api')
    assert.ok(res.json?.timestamp)

    // Verify DB updated
    const saved = await settingsService.getSebConfig()
    assert.ok(saved.lastVerifiedAt)
    assert.equal(saved.lastVerifiedMethod, 'javascript_api')
  })

  it('2. POST /api/v1/seb/ping verifies via X-SafeExamBrowser-ConfigKeyHash matching document Referer URL', async () => {
    const refererUrl = 'https://proctornet.duckdns.org/student/login'
    const expectedHash = crypto
      .createHash('sha256')
      .update(refererUrl + VALID_KEY)
      .digest('hex')

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/seb/ping',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': refererUrl,
        'X-SafeExamBrowser-ConfigKeyHash': expectedHash,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SEB/3.10.3'
      }
    }, {
      href: refererUrl
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json?.verified, true)
    assert.equal(res.json?.method, 'header_hash')
  })

  it('3. GET /api/v1/seb/ping retains backwards compatibility for header hashes', async () => {
    const refererUrl = 'https://proctornet.duckdns.org/login'
    const expectedHash = crypto
      .createHash('sha256')
      .update(refererUrl + VALID_KEY)
      .digest('hex')

    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/seb/ping',
      method: 'GET',
      headers: {
        'Referer': refererUrl,
        'X-SafeExamBrowser-ConfigKeyHash': expectedHash
      }
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json?.verified, true)
  })

  it('4. POST /api/v1/seb/ping rejects mismatched key with verified: false', async () => {
    const wrongKey = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff'
    const res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/seb/ping',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      configKey: wrongKey
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.json?.verified, false)
  })

  it('5. GET /api/v1/admin/seb/status surfaces lastVerifiedMethod and lastVerifiedUserAgent', async () => {
    // Perform a successful ping first
    await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/seb/ping',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 SEB/3.10.3 Windows'
      }
    }, {
      configKey: VALID_KEY
    })

    const statusRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/admin/seb/status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })

    assert.equal(statusRes.statusCode, 200)
    assert.equal(statusRes.json?.configured, true)
    assert.ok(statusRes.json?.lastVerifiedAt)
    assert.equal(statusRes.json?.lastVerifiedMethod, 'javascript_api')
    assert.equal(statusRes.json?.lastVerifiedUserAgent, 'Mozilla/5.0 SEB/3.10.3 Windows')
  })

  it('6. inspectSebRequest middleware validates client configKey in request body', async () => {
    const testExamId = 'mock-exam-uuid-for-seb-test'
    // Pre-populate examSettingsCache
    examSettingsCache.set(testExamId, {
      sebRequired: true,
      sebConfigKey: VALID_KEY,
      effectiveMode: 'audit',
      configured: true,
      expiresAt: Date.now() + 60000
    })

    const mockReq = {
      params: { examId: testExamId },
      headers: {},
      body: { configKey: VALID_KEY }
    }

    const inspection = await inspectSebRequest(mockReq)
    assert.equal(inspection.required, true)
    assert.equal(inspection.verified, true)
    assert.equal(inspection.matched, true)
  })
})
