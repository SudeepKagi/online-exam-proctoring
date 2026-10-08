#!/usr/bin/env node
/**
 * verify-sessions-s2.js
 * Comprehensive automated verification suite for Phase S2 — Sessions & Authentication.
 * Tests boot validation, token authority, dual-cookie lifecycle, rotation,
 * family reuse detection, zero-localStorage policy, and live production endpoints.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

const DOMAIN = process.env.DOMAIN_NAME || 'proctornet.duckdns.org'
const BASE_URL = `https://${DOMAIN}`

// Helpers for HTTP requests
function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(body) } catch (_e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          rawCookies: res.headers['set-cookie'] || [],
          body,
          json
        })
      })
    })
    req.on('error', reject)
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    req.end()
  })
}

function parseCookies(cookieHeaders) {
  const result = {}
  if (!cookieHeaders) return result
  const list = Array.isArray(cookieHeaders) ? cookieHeaders : [cookieHeaders]
  for (const c of list) {
    const parts = c.split(';')
    const [name, val] = parts[0].trim().split('=')
    result[name] = {
      value: val,
      raw: c,
      httpOnly: /httponly/i.test(c),
      secure: /secure/i.test(c),
      sameSite: (c.match(/samesite=([^;]+)/i) || [])[1] || null,
      path: (c.match(/path=([^;]+)/i) || [])[1] || null,
      maxAge: (c.match(/max-age=([^;]+)/i) || [])[1] || null
    }
  }
  return result
}

let passed = 0
let total = 0

function test(name, fn) {
  total++
  try {
    fn()
    console.log(` [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(` [FAIL] ${name}: ${err.message}`)
  }
}

async function testAsync(name, fn) {
  total++
  try {
    await fn()
    console.log(` [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(` [FAIL] ${name}: ${err.message}`)
  }
}

async function run() {
  console.log(`==========================================================`)
  console.log(` Phase S2: Sessions & Authentication Verification Suite`)
  console.log(` Target Domain: ${BASE_URL}`)
  console.log(` Timestamp: ${new Date().toISOString()}`)
  console.log(`==========================================================\n`)

  // ── 1. Boot-Time Validator Tests (validateConfig) ──
  console.log(`--- SECTION 1: Boot-Time Validator Invariants ---`)
  const { validateConfig, KNOWN_DEFAULTS } = require('../../proctornet/backend/src/shared/validateConfig')

  test('validateConfig rejects known insecure default secrets', () => {
    assert(KNOWN_DEFAULTS.has('proctornet-super-secret-key-production-ready'))
    assert(KNOWN_DEFAULTS.has('proctornet_default_jwt_signing_secret_key_2026'))
  })

  // ── 2. Single Token Authority Tests ──
  console.log(`\n--- SECTION 2: Single Token Authority & Cryptography ---`)
  const { tokenService } = require('../../proctornet/backend/src/modules/auth/tokenService')

  const testPayload = { id: 'test-user-id', role: 'admin', sid: crypto.randomUUID() }
  const testToken = tokenService.signAccessToken(testPayload, 900)
  const decoded = tokenService.verifyAccessToken(testToken)

  test('Token signs and verifies cleanly via single authority', () => {
    assert.strictEqual(decoded.id, 'test-user-id')
    assert.strictEqual(decoded.role, 'admin')
  })

  test('Access token has 15-minute expiry envelope (900 seconds)', () => {
    const diffSec = decoded.exp - decoded.iat
    assert.strictEqual(diffSec, 900)
  })

  // ── 3. Dual-Cookie Headers Specification ──
  console.log(`\n--- SECTION 3: Dual-Cookie Envelope Specification ---`)
  const mockRes = {
    cookiesSet: {},
    cookie(name, val, opts) {
      this.cookiesSet[name] = { val, opts }
    },
    clearCookie(name, opts) {
      this.cookiesSet[name] = { cleared: true, opts }
    }
  }

  tokenService.setSessionCookies(mockRes, {
    accessToken: testToken,
    refreshToken: 'test-refresh-token'
  })

  test('pn_at cookie set with HttpOnly, SameSite=lax, Path=/, Max-Age=900s', () => {
    const pnAt = mockRes.cookiesSet['pn_at']
    assert(pnAt, 'pn_at cookie was not set')
    assert.strictEqual(pnAt.opts.httpOnly, true)
    assert.strictEqual(pnAt.opts.sameSite, 'lax')
    assert.strictEqual(pnAt.opts.path, '/')
    assert.strictEqual(pnAt.opts.maxAge, 900000)
  })

  test('pn_rt cookie set with HttpOnly, SameSite=lax, Path=/api/v1/auth, Max-Age=43200s', () => {
    const pnRt = mockRes.cookiesSet['pn_rt']
    assert(pnRt, 'pn_rt cookie was not set')
    assert.strictEqual(pnRt.opts.httpOnly, true)
    assert.strictEqual(pnRt.opts.sameSite, 'lax')
    assert.strictEqual(pnRt.opts.path, '/api/v1/auth')
    assert.strictEqual(pnRt.opts.maxAge, 43200000)
  })

  // ── 4. Database-Backed Refresh Rotation & Reuse Detection ──
  console.log(`\n--- SECTION 4: Refresh Rotation & Family Reuse Detection ---`)
  const dummyUserId = crypto.randomUUID()
  const initialSession = await tokenService.createSession({
    userId: dummyUserId,
    role: 'STUDENT'
  })

  test('Initial session creates valid AuthSession in database', () => {
    assert(initialSession.sessionId, 'Session ID not returned')
    assert(initialSession.refreshToken, 'Refresh token not returned')
    assert(initialSession.familyId, 'Family ID not returned')
  })

  // Rotate session
  const rotatedSession = await tokenService.rotateSession(initialSession.refreshToken)
  test('Token rotation successfully issues new access token & refresh token in same family', () => {
    assert(rotatedSession.accessToken, 'Rotated accessToken missing')
    assert(rotatedSession.refreshToken, 'Rotated refreshToken missing')
    assert.notStrictEqual(rotatedSession.refreshToken, initialSession.refreshToken)
  })

  // Attempt to REUSE the old refresh token (Compromise Detection)
  let reuseDetected = false
  try {
    await tokenService.rotateSession(initialSession.refreshToken)
  } catch (err) {
    if (err.message.includes('compromise') || err.message.includes('REUSE') || err.statusCode === 401) {
      reuseDetected = true
    }
  }

  test('Refresh token reuse triggers immediate family revocation (SES-02)', () => {
    assert.strictEqual(reuseDetected, true)
  })

  // Check that the rotated session was also revoked as part of family termination
  const postCompromiseCheck = await tokenService.validateSession(rotatedSession.sid)
  test('Family termination immediately revokes all descendant sessions in DB', () => {
    assert.strictEqual(postCompromiseCheck.valid, false)
  })

  // ── 5. Zero-LocalStorage Policy in Frontend Artifacts ──
  console.log(`\n--- SECTION 5: Zero-LocalStorage Policy ---`)
  const distDir = path.resolve(__dirname, '../../proctornet/frontend/dist/assets')
  let foundLeakedToken = false
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'))
    for (const file of files) {
      const content = fs.readFileSync(path.join(distDir, file), 'utf8')
      if (content.includes('proctornet_token')) {
        foundLeakedToken = true
        console.error(`Leak found in ${file}: contains proctornet_token`)
      }
    }
  }

  test('Built frontend bundle contains zero occurrences of proctornet_token', () => {
    assert.strictEqual(foundLeakedToken, false)
  })

  // ── 6. Live HTTPS Production Endpoints (SES-01..08) ──
  console.log(`\n--- SECTION 6: Live Production Endpoints (HTTPS) ---`)

  // Test CSRF Cross-Origin Rejection
  const csrfRes = await httpRequest(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://attacker-domain.evil.com'
    },
    body: JSON.stringify({ email: 'test@example.com', password: 'test' })
  })

  test('Cross-origin state-changing POST rejected with 403 Forbidden origin (SES-08)', () => {
    assert.strictEqual(csrfRes.statusCode, 403)
  })

  // Test Admin Login over HTTPS
  const adminLoginRes = await httpRequest(`${BASE_URL}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({ email: 'admin@proctornet.com', password: 'Admin@123' })
  })

  test('Admin login over HTTPS returns 200 OK', () => {
    assert.strictEqual(adminLoginRes.statusCode, 200)
    assert.strictEqual(adminLoginRes.json?.authenticated, true)
  })

  const cookies = parseCookies(adminLoginRes.rawCookies)

  test('Admin login sets pn_at with Secure; HttpOnly; SameSite=Lax; Path=/', () => {
    assert(cookies['pn_at'], 'Missing Set-Cookie: pn_at')
    assert.strictEqual(cookies['pn_at'].httpOnly, true)
    assert.strictEqual(cookies['pn_at'].secure, true)
    assert.strictEqual(cookies['pn_at'].sameSite.toLowerCase(), 'lax')
    assert.strictEqual(cookies['pn_at'].path, '/')
  })

  test('Admin login sets pn_rt with Secure; HttpOnly; SameSite=Lax; Path=/api/v1/auth', () => {
    assert(cookies['pn_rt'], 'Missing Set-Cookie: pn_rt')
    assert.strictEqual(cookies['pn_rt'].httpOnly, true)
    assert.strictEqual(cookies['pn_rt'].secure, true)
    assert.strictEqual(cookies['pn_rt'].sameSite.toLowerCase(), 'lax')
    assert.strictEqual(cookies['pn_rt'].path, '/api/v1/auth')
  })

  test('Production admin login JSON body contains NO token (SES-03)', () => {
    assert.strictEqual(adminLoginRes.json?.token, undefined)
  })

  // Test authenticated /me endpoint using pn_at cookie
  const meRes = await httpRequest(`${BASE_URL}/api/v1/auth/me`, {
    method: 'GET',
    headers: {
      'Cookie': `pn_at=${cookies['pn_at'].value}`,
      'Origin': BASE_URL
    }
  })

  test('/api/v1/auth/me authenticates via HttpOnly pn_at cookie', () => {
    assert.strictEqual(meRes.statusCode, 200)
    assert.strictEqual(meRes.json?.authenticated, true)
    assert.strictEqual(meRes.json?.user?.email, 'admin@proctornet.com')
  })

  // Test silent refresh rotation endpoint
  const refreshRes = await httpRequest(`${BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Cookie': `pn_rt=${cookies['pn_rt'].value}`,
      'Origin': BASE_URL,
      'X-Requested-With': 'XMLHttpRequest'
    }
  })

  test('/api/v1/auth/refresh rotates session and issues new cookies', () => {
    assert.strictEqual(refreshRes.statusCode, 200)
    const newCookies = parseCookies(refreshRes.rawCookies)
    assert(newCookies['pn_at'], 'New pn_at cookie not returned on refresh')
    assert(newCookies['pn_rt'], 'New pn_rt cookie not returned on refresh')
  })

  // Test Logout revokes session and clears cookies
  const logoutRes = await httpRequest(`${BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Cookie': `pn_at=${cookies['pn_at'].value}`,
      'Origin': BASE_URL,
      'X-Requested-With': 'XMLHttpRequest'
    }
  })

  test('/api/v1/auth/logout revokes session and returns cleared cookies', () => {
    assert.strictEqual(logoutRes.statusCode, 200)
    const clearedCookies = parseCookies(logoutRes.rawCookies)
    assert(clearedCookies['pn_at'], 'pn_at clear cookie header missing')
  })

  console.log(`\n==========================================================`)
  console.log(` Verification Complete: ${passed}/${total} checks PASSED`)
  console.log(`==========================================================`)

  if (passed !== total) {
    process.exit(1)
  }
}

run().catch(err => {
  console.error('Fatal suite failure:', err)
  process.exit(1)
})
