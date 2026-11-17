'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const zlib = require('zlib')

const { app } = require('../src/app')
const { signToken } = require('../src/utils/jwt')
const { prisma } = require('../src/infra/postgres/client')
const { settingsService } = require('../src/modules/admin/settings.service')
const { setStorageAdapter } = require('../src/infra/s3/s3.client')
const { MemoryS3Adapter } = require('../src/infra/s3/s3Adapter')
const { inspectSebBuffer, generateStarterSebConfig, computeConfigKeyFromXml } = require('../src/modules/seb/sebConfigChecker')
const { sebDiagnosticsService } = require('../src/modules/seb/sebDiagnostics.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')

const TEST_ORIGIN = 'https://proctornet.duckdns.org'

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_3.0_Test</string>
    <key>startURL</key>
    <string>${TEST_ORIGIN}/seb/enter</string>
    <key>sendBrowserExamKey</key>
    <true/>
    <key>startURLAppendQueryParameter</key>
    <true/>
    <key>quitURL</key>
    <string>${TEST_ORIGIN}/seb/done</string>
    <key>quitURLConfirm</key>
    <true/>
    <key>URLFilterEnable</key>
    <true/>
</dict>
</plist>`

// Encrypted SEB header: 'pswd' + payload
const ENCRYPTED_PSWD_BUFFER = Buffer.concat([
  Buffer.from('pswd', 'utf8'),
  Buffer.from('encrypted-data-payload-binary-bytes')
])

let server
let baseUrl
let adminToken

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
      req.write(postBody)
    }
    req.end()
  })
}

describe('Phase 3: Admin SEB Setup & Verification Suite', () => {
  before(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Setup admin user
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin.seb.phase3@proctornet.test',
          name: 'SEB Admin Phase 3',
          passwordHash: 'hashed_pw',
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })
    }
    adminToken = signToken({ id: admin.id, email: admin.email, role: 'ADMIN', status: 'ACTIVE' })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    setStorageAdapter(new MemoryS3Adapter({ bucket: 'proctornet-storage' }))
    await settingsService.deleteSebConfig()
    invalidateInstitutionSebState()
    sebDiagnosticsService.clearHistory()
  })

  describe('1. Settings Checker (Plain & Encrypted Fixtures)', () => {
    it('accurately parses a plain XML plist and validates required settings', () => {
      const computedKey = computeConfigKeyFromXml(VALID_XML)
      const res = inspectSebBuffer(Buffer.from(VALID_XML, 'utf8'), {
        publicOrigin: TEST_ORIGIN,
        pastedKey: computedKey
      })

      assert.strictEqual(res.valid, true)
      assert.strictEqual(res.isEncrypted, false)
      assert.strictEqual(res.format, 'xml')
      assert.strictEqual(res.keyMatch, true)
      assert.strictEqual(res.keyWarning, null)

      const startCheck = res.checks.find(c => c.key === 'startURL')
      assert.strictEqual(startCheck.status, 'ok')

      const headerCheck = res.checks.find(c => c.key === 'sendBrowserExamKey')
      assert.strictEqual(headerCheck.status, 'ok')

      const queryCheck = res.checks.find(c => c.key === 'startURLAppendQueryParameter')
      assert.strictEqual(queryCheck.status, 'ok')
    })

    it('decompresses and inspects GZip-compressed plain XML .seb files', () => {
      const compressed = zlib.gzipSync(Buffer.from(VALID_XML, 'utf8'))
      const res = inspectSebBuffer(compressed, { publicOrigin: TEST_ORIGIN })

      assert.strictEqual(res.valid, true)
      assert.strictEqual(res.wasCompressed, true)
      assert.strictEqual(res.isEncrypted, false)
      assert.strictEqual(res.settingsSummary.sendBrowserExamKey, true)
    })

    it('detects Config Key mismatch and flags warning ("looks like Browser Exam Key")', () => {
      const wrongKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      const res = inspectSebBuffer(Buffer.from(VALID_XML, 'utf8'), {
        publicOrigin: TEST_ORIGIN,
        pastedKey: wrongKey
      })

      assert.strictEqual(res.valid, true)
      assert.strictEqual(res.keyMatch, false)
      assert.match(res.keyWarning, /looks like the Browser Exam Key/i)
    })

    it('identifies encrypted container (pswd) without rejecting it', () => {
      const res = inspectSebBuffer(ENCRYPTED_PSWD_BUFFER, { publicOrigin: TEST_ORIGIN })

      assert.strictEqual(res.valid, true)
      assert.strictEqual(res.isEncrypted, true)
      assert.strictEqual(res.format, 'encrypted')
      assert.match(res.notice, /protected with a settings password/i)
      assert.match(res.recommendation, /recommended in production/i)
    })

    it('rejects completely invalid non-SEB binary files', () => {
      const garbage = Buffer.from('just a random plain text document that is not xml')
      const res = inspectSebBuffer(garbage, { publicOrigin: TEST_ORIGIN })

      assert.strictEqual(res.valid, false)
      assert.match(res.error, /does not match a valid Safe Exam Browser configuration/i)
    })
  })

  describe('2. Starter Configuration Generator', () => {
    it('generates valid starter SEB XML with proper origin and settings', () => {
      const starterXml = generateStarterSebConfig({
        publicOrigin: TEST_ORIGIN,
        s3Host: 'test-bucket.s3.ap-south-1.amazonaws.com'
      })

      assert.match(starterXml, /<plist version="1.0">/)
      assert.match(starterXml, new RegExp(`${TEST_ORIGIN}/seb/enter`))
      assert.match(starterXml, /<key>sendBrowserExamKey<\/key>\s*<true\/>/)
      assert.match(starterXml, /<key>startURLAppendQueryParameter<\/key>\s*<true\/>/)

      // Verify generated starter file passes the inspector
      const inspection = inspectSebBuffer(Buffer.from(starterXml, 'utf8'), { publicOrigin: TEST_ORIGIN })
      assert.strictEqual(inspection.valid, true)
      assert.strictEqual(inspection.settingsSummary.sendBrowserExamKey, true)
      assert.strictEqual(inspection.settingsSummary.startURLAppendQueryParameter, true)
    })

    it('GET /api/v1/admin/seb/starter-config returns starter file download', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/starter-config',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.match(res.headers['content-type'], /application\/seb/)
      assert.match(res.headers['content-disposition'], /proctornet-starter\.seb/)
      assert.match(res.body, /<plist version="1.0">/)
    })
  })

  describe('3. Mode Gating & 7-Day Verified Ping Invariant', () => {
    it('refuses to enable enforce mode when lastVerifiedAt is null', async () => {
      // First save configuration without verification
      const computedKey = computeConfigKeyFromXml(VALID_XML)
      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: computedKey,
        lastVerifiedAt: null,
        requestedMode: 'audit'
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({ mode: 'enforce' }))

      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.json?.code, 'SEB_NOT_VERIFIED')
      assert.match(res.json?.message, /not been verified within the last 7 days/i)
    })

    it('refuses enforce mode when lastVerifiedAt is older than 7 days', async () => {
      const computedKey = computeConfigKeyFromXml(VALID_XML)
      const eightDaysAgo = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)).toISOString()

      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: computedKey,
        lastVerifiedAt: eightDaysAgo,
        requestedMode: 'audit'
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({ mode: 'enforce' }))

      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.json?.code, 'SEB_NOT_VERIFIED')
    })

    it('accepts enforce mode when verified within the last 7 days', async () => {
      const computedKey = computeConfigKeyFromXml(VALID_XML)
      const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString()

      // Also ensure S3 file is present so state is configured
      const storage = new MemoryS3Adapter({ bucket: 'proctornet-storage' })
      setStorageAdapter(storage)
      await storage.putObject('seb/institution-config.seb', Buffer.from(VALID_XML), 'application/seb')

      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: computedKey,
        lastVerifiedAt: oneHourAgo,
        requestedMode: 'audit'
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({ mode: 'enforce' }))

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(res.json?.requestedMode, 'enforce')
      assert.strictEqual(res.json?.effectiveMode, 'enforce')
    })

    it('always permits returning to audit mode', async () => {
      const computedKey = computeConfigKeyFromXml(VALID_XML)
      const storage = new MemoryS3Adapter({ bucket: 'proctornet-storage' })
      setStorageAdapter(storage)
      await storage.putObject('seb/institution-config.seb', Buffer.from(VALID_XML), 'application/seb')

      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: computedKey,
        requestedMode: 'enforce'
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/mode',
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({ mode: 'audit' }))

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.requestedMode, 'audit')
      assert.strictEqual(res.json?.effectiveMode, 'audit')
    })
  })

  describe('4. Diagnostics & Verification Attempts Tracking', () => {
    it('records attempts and GET /api/v1/admin/seb/attempts returns the last 5', async () => {
      sebDiagnosticsService.recordAttempt({
        purpose: 'admin_test',
        outcome: 'SUCCESS',
        userAgent: 'SEB/3.8.0 (Windows NT 10.0)',
        clientIp: '192.168.1.100'
      })
      sebDiagnosticsService.recordAttempt({
        purpose: 'check',
        outcome: 'HEADER_MISMATCH',
        userAgent: 'SEB/3.7.0 (Windows NT 10.0)',
        clientIp: '192.168.1.101'
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/seb/attempts',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.success, true)
      assert.strictEqual(res.json?.attempts?.length, 2)
      assert.strictEqual(res.json.attempts[0].outcome, 'HEADER_MISMATCH')
      assert.strictEqual(res.json.attempts[1].outcome, 'SUCCESS')
      assert.match(res.json.attempts[1].sebVersion, /SEB 3\.8\.0/)
    })
  })

  describe('5. Storage Health & Error Handling', () => {
    it('GET /api/v1/admin/health/storage returns status OK for active storage', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/admin/health/storage?refresh=true',
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.json?.status, 'OK')
      assert.strictEqual(res.json?.ok, true)
    })
  })
})
