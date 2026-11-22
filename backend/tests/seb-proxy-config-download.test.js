'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { sebTokenService } = require('../src/modules/seb/sebToken.service')
const { sebDiagnosticsService } = require('../src/modules/seb/sebDiagnostics.service')
const { settingsService } = require('../src/modules/admin/settings.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { server: appServer } = require('../src/app')

const SEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.140 SEB/3.10.3 (x64)'

function requestServer(server, { path, method = 'GET', headers = {} }) {
  return new Promise((resolve, reject) => {
    const addr = server.address()
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        'User-Agent': SEB_UA,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'proctornet.duckdns.org',
        'X-Forwarded-For': '198.51.100.42',
        ...headers
      }
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        })
      })
    })

    req.on('error', reject)
    req.end()
  })
}

describe('SEB Proxy Config Download Integration Test (§Phase 1 Hop 2/3)', () => {
  let server
  let launchInfo

  before(async () => {
    // Seed in-memory token
    launchInfo = sebTokenService.createLaunchToken({
      userId: 'test-student-id-1234',
      userRole: 'STUDENT',
      examId: null,
      purpose: 'check'
    })

    await new Promise((resolve) => {
      server = appServer.listen(0, '127.0.0.1', () => {
        resolve()
      })
    })
  })

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('HEAD request through proxy returns HTTP 200 with headers and 0-byte body', async () => {
    const res = await requestServer(server, {
      method: 'HEAD',
      path: `/api/v1/seb/config/${launchInfo.downloadToken}.seb`
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'application/seb')
    assert.equal(res.headers['content-disposition'], 'attachment; filename="ProctorNet-Exam.seb"')
    assert.equal(res.headers['cache-control'], 'no-store, no-cache, must-revalidate')
    assert.equal(res.body.length, 0, 'HEAD request must return zero body bytes')
  })

  it('GET request through proxy preserves body integrity, XML plist format and headers', async () => {
    const res = await requestServer(server, {
      method: 'GET',
      path: `/api/v1/seb/config/${launchInfo.downloadToken}.seb`
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'application/seb')
    assert.equal(res.headers['content-disposition'], 'attachment; filename="ProctorNet-Exam.seb"')
    assert.equal(res.headers['cache-control'], 'no-store, no-cache, must-revalidate')

    assert.ok(res.body.length > 500, 'Payload must be non-empty .seb config')
    const xml = res.body.toString('utf8')
    assert.ok(xml.includes('<?xml') || xml.includes('<plist'), 'Must be valid XML Property List')
    assert.match(xml, /<key>sendBrowserExamKey<\/key>\s*<true\s*\/>/)
    assert.match(xml, /<key>startURL<\/key>/)
  })

  it('sanitizes dangerous Windows background services in uploaded S3 config to prevent SEB crash', async () => {
    const storage = getStorageAdapter()
    const rawDangerousConfig = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>startURL</key>
  <string>https://proctornet.duckdns.org/seb/enter</string>
  <key>prohibitedProcesses</key>
  <array>
    <dict>
      <key>active</key>
      <true/>
      <key>currentUser</key>
      <true/>
      <key>description</key>
      <string></string>
      <key>executable</key>
      <string>UltraViewer_Service.exe</string>
      <key>originalName</key>
      <string>UltraViewer_Service.exe</string>
      <key>os</key>
      <integer>1</integer>
    </dict>
  </array>
</dict>
</plist>`

    await storage.putObject('seb/institution-config.seb', Buffer.from(rawDangerousConfig, 'utf8'), 'application/seb')
    const originalGetSebConfig = settingsService.getSebConfig.bind(settingsService)
    settingsService.getSebConfig = async () => ({
      fileKey: 'seb/institution-config.seb',
      configKey: '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a',
      uploadedAt: new Date().toISOString()
    })

    const freshLaunch = sebTokenService.createLaunchToken({
      userId: 'test-student-id-5678',
      userRole: 'STUDENT',
      purpose: 'check'
    })

    const res = await requestServer(server, {
      method: 'GET',
      path: `/api/v1/seb/config/${freshLaunch.downloadToken}.seb`
    })

    settingsService.getSebConfig = originalGetSebConfig

    assert.equal(res.statusCode, 200)
    const xml = res.body.toString('utf8')
    assert.ok(xml.includes('UltraViewer_Service.exe'))
    const uvDict = xml.match(/<dict>[\s\S]*?<string>UltraViewer_Service\.exe<\/string>[\s\S]*?<\/dict>/)
    assert.ok(uvDict, 'UltraViewer_Service dict must exist')
    assert.match(uvDict[0], /<key>active<\/key>\s*<false\s*\/>/, 'Must be sanitized to active: false')
  })

  it('records correlationId and CONFIG_DOWNLOAD_REQUEST hop in sebDiagnosticsService', async () => {
    const traces = sebDiagnosticsService.getLaunchTraces()
    assert.ok(Array.isArray(traces), 'Traces must be an array')
    assert.ok(traces.length > 0, 'Must contain recorded traces')

    const matchingTrace = traces.find(t => t.correlationId === launchInfo.correlationId)
    assert.ok(matchingTrace, `Trace for correlationId ${launchInfo.correlationId} must exist`)
    assert.ok(matchingTrace.hops.some(h => h.step === 'CONFIG_DOWNLOAD_REQUEST' && h.status === 200))
  })
})
