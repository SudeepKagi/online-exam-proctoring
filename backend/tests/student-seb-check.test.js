'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const { app } = require('../src/app')
const { signToken } = require('../src/utils/jwt')
const { prisma } = require('../src/infra/postgres/client')
const { settingsService } = require('../src/modules/admin/settings.service')
const { setStorageAdapter } = require('../src/infra/s3/s3.client')
const { MemoryS3Adapter } = require('../src/infra/s3/s3Adapter')
const { sebTokenService } = require('../src/modules/seb/sebToken.service')
const { invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')

let server
let baseUrl
let studentUser
let studentToken

function httpRequest(options, postBody = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(body)
        } catch {
          json = body
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        })
      })
    })

    req.on('error', reject)

    if (postBody) {
      if (typeof postBody === 'object' && !Buffer.isBuffer(postBody)) {
        req.setHeader('Content-Type', 'application/json')
        req.write(JSON.stringify(postBody))
      } else {
        req.write(postBody)
      }
    }
    req.end()
  })
}

describe('Phase 4: Student Pre-Exam Check & Secure Browser Flow', () => {
  before(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Ensure student user exists
    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: 'student.seb.phase4@proctornet.test',
          fullName: 'SEB Test Student',
          passwordHash: 'hashed_pw',
          role: 'STUDENT',
          status: 'ACTIVE',
          profileMetadata: {}
        }
      })
    } else {
      // Clear previous SEB check metadata
      await prisma.user.update({
        where: { id: studentUser.id },
        data: { profileMetadata: {} }
      })
    }

    studentToken = signToken({
      id: studentUser.id,
      email: studentUser.email,
      role: 'STUDENT',
      status: 'ACTIVE'
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    setStorageAdapter(new MemoryS3Adapter({ bucket: 'proctornet-storage' }))
    sebTokenService.clear()
    invalidateInstitutionSebState()
  })

  describe('1. Student Check Status Endpoint', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/student-check-status',
        method: 'GET'
      })

      assert.equal(res.statusCode, 401)
    })

    it('returns unchecked status when student has not yet completed check', async () => {
      // Reset user profileMetadata
      await prisma.user.update({
        where: { id: studentUser.id },
        data: { profileMetadata: {} }
      })

      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/student-check-status',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      })

      assert.equal(res.statusCode, 200)
      assert.equal(res.data.checked, false)
      assert.equal(res.data.lastCheckedAt, null)
      assert.equal(res.data.sebVersion, null)
      assert.ok(res.data.institutionSeb)
    })
  })

  describe('2. Launch Token Generation with purpose=check', () => {
    it('generates a launch token and PIN even without active exam', async () => {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      }, { purpose: 'check' })

      assert.equal(res.statusCode, 200)
      assert.equal(res.data.success, true)
      assert.ok(res.data.launchUrl.startsWith('seb://') || res.data.launchUrl.startsWith('sebs://'))
      assert.ok(res.data.launchToken)
      assert.ok(res.data.pin)
      assert.equal(res.data.pin.length, 6)
      assert.equal(res.data.purpose, 'check')
    })
  })

  describe('3. Token Status Polling', () => {
    it('returns PENDING and consumed=false before SEB connects', async () => {
      const launchRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      }, { purpose: 'check' })

      const token = launchRes.data.launchToken

      const statusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: `/api/v1/seb/token-status/${token}`,
        method: 'GET'
      })

      assert.equal(statusRes.statusCode, 200)
      assert.equal(statusRes.data.status, 'PENDING')
      assert.equal(statusRes.data.consumed, false)
      assert.equal(statusRes.data.purpose, 'check')
    })

    it('returns NOT_FOUND for unknown token', async () => {
      const statusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/token-status/00000000000000000000000000000000',
        method: 'GET'
      })

      assert.equal(statusRes.statusCode, 200)
      assert.equal(statusRes.data.status, 'NOT_FOUND')
      assert.equal(statusRes.data.consumed, false)
    })
  })

  describe('4. Token Exchange & Student Verification Persistence', () => {
    it('exchanges token, sets destination, and updates student profileMetadata', async () => {
      // Create launch token
      const launchRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      }, { purpose: 'check' })

      const token = launchRes.data.launchToken

      // Simulate SEB browser opening exchange endpoint
      const exchangeRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: `/api/v1/seb/exchange?launch=${token}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 SEB/3.8.0.742 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json'
        }
      })

      assert.equal(exchangeRes.statusCode, 200)
      assert.equal(exchangeRes.data.success, true)
      assert.equal(exchangeRes.data.redirectUrl, '/student/secure-browser?verified=1')
      assert.ok(exchangeRes.data.token)

      // Verify token polling now reports CONSUMED
      const pollRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: `/api/v1/seb/token-status/${token}`,
        method: 'GET'
      })
      assert.equal(pollRes.data.status, 'CONSUMED')
      assert.equal(pollRes.data.consumed, true)

      // Verify student check status endpoint reports verified
      const checkStatusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/student-check-status',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      })

      assert.equal(checkStatusRes.statusCode, 200)
      assert.equal(checkStatusRes.data.checked, true)
      assert.ok(checkStatusRes.data.lastCheckedAt)
      assert.equal(checkStatusRes.data.sebVersion, '3.8.0.742')
    })

    it('exchanges 6-digit PIN and updates student verification', async () => {
      // Create launch token
      const launchRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/launch-link',
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      }, { purpose: 'check' })

      const { pin } = launchRes.data

      // Exchange PIN
      const pinRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/exchange-pin',
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 SEB/3.8.0 (Windows NT 10.0)'
        }
      }, { pin })

      assert.equal(pinRes.statusCode, 200)
      assert.equal(pinRes.data.success, true)
      assert.equal(pinRes.data.redirectUrl, '/student/secure-browser?verified=1')

      // Verify student check status updated
      const checkStatusRes = await httpRequest({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/seb/student-check-status',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      })

      assert.equal(checkStatusRes.statusCode, 200)
      assert.equal(checkStatusRes.data.checked, true)
      assert.ok(checkStatusRes.data.lastCheckedAt)
    })
  })
})
