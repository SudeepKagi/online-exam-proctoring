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
const jwt = require('jsonwebtoken')

const { app } = require('../src/app')
const config = require('../src/shared/config')
const { settingsService } = require('../src/modules/admin/settings.service')
const { getInstitutionSebState, invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')
const { sebDiagnosticsService } = require('../src/modules/seb/sebDiagnostics.service')
const { computeConfigKeyOfficial, serializeSebJson } = require('../src/modules/seb/sebConfigChecker')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { clearAllSebCaches } = require('../src/middleware/seb')
const { prisma } = require('../src/infra/postgres/client')

const INSTITUTION_KEY = 'b3795424e489b41ccc146325fc06707fb91dd510b34495294d73224f70f7a843'
const STARTER_KEY = '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a'

let testServer = null
let port = 0
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

describe('Phase 1: SEB Decoupled Entry, Diagnostics & Config Versioning Suite', () => {
  before(async () => {
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin_decoupled@institution.edu',
          fullName: 'Admin Decoupled',
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
        config.publicOrigin = `http://localhost:${port}`
        resolve()
      })
    })
  })

  after(async () => {
    delete process.env.SEB_MODE
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve))
    }
  })

  beforeEach(async () => {
    delete process.env.SEB_MODE
    sebDiagnosticsService.clearHistory()
    clearAllSebCaches()
    invalidateInstitutionSebState()

    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-xml-content'), 'application/seb')

    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: INSTITUTION_KEY,
      lastVerifiedAt: new Date().toISOString(),
      requestedMode: 'audit'
    })
    invalidateInstitutionSebState()
  })

  describe('1. Official SEB Config Key Algorithm & Canonical Serialization', () => {
    it('computes deterministic SHA256 hex key from SEB dictionary object', () => {
      const sampleObj = {
        originURL: 'https://proctornet.duckdns.org',
        sendBrowserExamKey: true,
        browserWindowWidth: 1000
      }
      const serialized = serializeSebJson(sampleObj)
      assert.ok(serialized.startsWith('{'))
      assert.ok(serialized.endsWith('}'))

      const key = computeConfigKeyOfficial(sampleObj)
      assert.strictEqual(typeof key, 'string')
      assert.strictEqual(key.length, 64)
      assert.ok(/^[0-9a-f]{64}$/.test(key))
    })

    it('filters out originatorVersion per official SEB specification', () => {
      const withOriginator = {
        sendBrowserExamKey: true,
        originatorVersion: 'SEB Windows 3.10.3'
      }
      const withoutOriginator = {
        sendBrowserExamKey: true
      }
      const key1 = computeConfigKeyOfficial(withOriginator)
      const key2 = computeConfigKeyOfficial(withoutOriginator)
      assert.strictEqual(key1, key2, 'originatorVersion must not affect computed Config Key')
    })
  })

  describe('2. Header Mismatch Diagnostic Hypothesis Engine', () => {
    const canonicalUrl = 'https://proctornet.duckdns.org/api/v1/attempts/exams/123/start'

    it('identifies STARTER_KEY when candidate used proctornet-starter.seb', () => {
      const starterHeader = crypto.createHash('sha256').update(canonicalUrl + STARTER_KEY).digest('hex')
      const result = sebDiagnosticsService.evaluateHeaderMismatch(starterHeader, canonicalUrl, INSTITUTION_KEY)
      assert.strictEqual(result.matchedVariant, 'STARTER_KEY')
      assert.ok(result.likelyCause.includes('starter'))
    })

    it('identifies TRAILING_SLASH variant', () => {
      const slashUrl = `${canonicalUrl}/`
      const slashHeader = crypto.createHash('sha256').update(slashUrl + INSTITUTION_KEY).digest('hex')
      const result = sebDiagnosticsService.evaluateHeaderMismatch(slashHeader, canonicalUrl, INSTITUTION_KEY)
      assert.strictEqual(result.matchedVariant, 'TRAILING_SLASH')
    })

    it('identifies SCHEME_MISMATCH variant (http vs https)', () => {
      const httpUrl = canonicalUrl.replace('https://', 'http://')
      const httpHeader = crypto.createHash('sha256').update(httpUrl + INSTITUTION_KEY).digest('hex')
      const result = sebDiagnosticsService.evaluateHeaderMismatch(httpHeader, canonicalUrl, INSTITUTION_KEY)
      assert.strictEqual(result.matchedVariant, 'SCHEME_MISMATCH')
    })

    it('identifies PORT_INCLUDED variant (:443 or :80)', () => {
      const portUrl = canonicalUrl.replace('proctornet.duckdns.org', 'proctornet.duckdns.org:443')
      const portHeader = crypto.createHash('sha256').update(portUrl + INSTITUTION_KEY).digest('hex')
      const result = sebDiagnosticsService.evaluateHeaderMismatch(portHeader, canonicalUrl, INSTITUTION_KEY)
      assert.strictEqual(result.matchedVariant, 'PORT_INCLUDED')
    })

    it('identifies DOUBLE_HASH variant', () => {
      const doubleKey = crypto.createHash('sha256').update(INSTITUTION_KEY).digest('hex').toLowerCase()
      const doubleHashHeader = crypto.createHash('sha256').update(canonicalUrl + doubleKey).digest('hex').toLowerCase()
      const result = sebDiagnosticsService.evaluateHeaderMismatch(doubleHashHeader, canonicalUrl, INSTITUTION_KEY)
      assert.strictEqual(result.matchedVariant, 'DOUBLE_HASH')
    })

    it('returns DIFFERENT_CONFIG_KEY for arbitrary mismatched headers', () => {
      const result = sebDiagnosticsService.evaluateHeaderMismatch(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        canonicalUrl,
        INSTITUTION_KEY
      )
      assert.strictEqual(result.matchedVariant, 'DIFFERENT_CONFIG_KEY')
    })
  })

  describe('3. Config Versioning Lifecycle & Mode Gating', () => {
    it('computes configVersion based on etag, key and origin', async () => {
      const state = await getInstitutionSebState()
      assert.strictEqual(typeof state.configVersion, 'string')
      assert.strictEqual(state.configVersion.length, 16)
    })

    it('blocks switching to enforce mode when verifiedConfigVersion does not match configVersion', async () => {
      const state = await getInstitutionSebState()
      // Manually set verifiedConfigVersion to an old/stale version
      await settingsService.saveSebConfig({
        verifiedConfigVersion: 'stale_version_01'
      })
      invalidateInstitutionSebState()

      const res = await httpRequest({
        hostname: 'localhost',
        port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      }, { mode: 'enforce' })

      assert.strictEqual(res.statusCode, 400)
      assert.ok(res.json?.message.includes('Test my setup') || res.json?.message.includes('changed'))
    })

    it('allows switching to enforce mode once ping verifies the current configVersion', async () => {
      const state = await getInstitutionSebState()
      assert.ok(state.configVersion)

      // Ping with matching configKey verifies current configVersion
      const pingRes = await httpRequest({
        hostname: 'localhost',
        port,
        path: '/api/v1/seb/ping',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SEB/3.10.3 (Windows NT 10.0)'
        }
      }, { configKey: INSTITUTION_KEY })

      assert.strictEqual(pingRes.statusCode, 200)
      assert.strictEqual(pingRes.json?.verified, true)

      // Now mode switch to enforce succeeds
      const modeRes = await httpRequest({
        hostname: 'localhost',
        port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      }, { mode: 'enforce' })

      assert.strictEqual(modeRes.statusCode, 200)
      assert.strictEqual(modeRes.json?.effectiveMode, 'enforce')
    })
  })

  describe('4. Reference ID Diagnostics Endpoints', () => {
    it('records a failed request and allows lookup via /admin/seb/diagnostics/lookup/:refId', async () => {
      const refId = crypto.randomUUID()
      sebDiagnosticsService.recordExchangeFailure({
        requestId: refId,
        code: 'SEB_HEADER_MISMATCH',
        receivedHeader: '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a',
        activeKey: INSTITUTION_KEY,
        targetUrl: 'https://proctornet.duckdns.org/api/v1/seb/exchange',
        userAgent: 'SEB/3.10.3 (Windows NT 10.0)'
      })

      const res = await httpRequest({
        hostname: 'localhost',
        port,
        path: `/api/v1/admin/seb/diagnostics/lookup/${refId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(res.json?.record?.requestId, refId)
      assert.strictEqual(res.json?.record?.code, 'SEB_HEADER_MISMATCH')
      assert.strictEqual(res.json?.record?.receivedHeaderPrefix8, '4b04249c')
    })

    it('returns public safe diagnostics on GET /api/v1/seb/diagnostics', async () => {
      const res = await httpRequest({
        hostname: 'localhost',
        port,
        path: '/api/v1/seb/diagnostics',
        method: 'GET'
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(typeof res.json?.effectiveMode, 'string')
      assert.strictEqual(typeof res.json?.configVersion, 'string')
      // Must never leak keys
      assert.strictEqual(res.json?.configKey, undefined)
      assert.strictEqual(res.body.includes(INSTITUTION_KEY), false)
    })
  })
})
