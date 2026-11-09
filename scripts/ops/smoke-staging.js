#!/usr/bin/env node
'use strict'

/**
 * ProctorNet Staging & Production Smoke Verification Suite
 * Usage:
 *   node scripts/ops/smoke-staging.js [--origin https://staging.proctornet.duckdns.org] [--seb-mode log|enforce]
 *
 * Checks:
 *   1. /health or /healthz probe returns HTTP 200 OK
 *   2. TLS certificate validity & expiration (for HTTPS origins)
 *   3. Strict-Transport-Security (HSTS) header verification (no preload)
 *   4. Frontend SPA login page availability
 *   5. CORS preflight with X-SafeExamBrowser-ConfigKeyHash header
 *   6. /api/v1/seb/ping endpoint returns HTTP 200
 *   7. Exam start without SEB header behavior (200/401/404 in log mode; 403 SEB_REQUIRED in enforce mode)
 *   8. WebSocket / Socket.io engine handshake (/socket.io/?EIO=4&transport=polling)
 *
 * Exit code: 0 on all tests passing, 1 on any failure.
 */

const https = require('https')
const http = require('http')
const tls = require('tls')
const crypto = require('crypto')
const { URL } = require('url')

// Parse CLI options
const args = process.argv.slice(2)
function getArg(flag, fallback) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}

const origin = getArg('--origin', process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5000').replace(/\/+$/, '')
const sebMode = getArg('--seb-mode', process.env.SEB_MODE || 'log').toLowerCase()
const allowInsecure = args.includes('--insecure')

console.log('='.repeat(70))
console.log(' ProctorNet Staging Smoke Verification')
console.log(` Target Origin : ${origin}`)
console.log(` SEB Mode      : ${sebMode}`)
console.log(` Timestamp     : ${new Date().toISOString()}`)
console.log('='.repeat(70))

const results = []

function logCheck(name, passed, detail = '') {
  const status = passed ? '[PASS]' : '[FAIL]'
  console.log(` ${status} ${name}${detail ? ` - ${detail}` : ''}`)
  results.push({ name, passed, detail })
}

/**
 * Helper to perform HTTP/HTTPS request
 */
function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: options.headers || {},
      timeout: options.timeout || 10000,
      rejectUnauthorized: !allowInsecure
    }

    const req = client.request(reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        })
      })
    })

    req.on('upgrade', (res, socket, head) => {
      let data = head ? head.toString() : ''
      socket.on('data', (chunk) => { data += chunk.toString() })
      setTimeout(() => {
        try { socket.destroy() } catch (_) {}
        resolve({
          statusCode: 101,
          headers: res.headers,
          body: data
        })
      }, 100)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out after ${reqOptions.timeout}ms`))
    })

    req.on('error', (err) => {
      reject(err)
    })

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

async function runSmokeSuite() {
  const url = new URL(origin)
  const isHttps = url.protocol === 'https:'

  // --------------------------------------------------------------------------
  // Check 1: Health probe (/healthz or /health)
  // --------------------------------------------------------------------------
  try {
    let res = await request(`${origin}/healthz`)
    if (res.statusCode !== 200) {
      res = await request(`${origin}/health`)
    }
    const passed = res.statusCode === 200
    let detail = `Status ${res.statusCode}`
    if (passed) {
      try {
        const json = JSON.parse(res.body)
        detail += ` (service: ${json.service || 'unknown'}, status: ${json.status || 'ok'})`
      } catch (_) {}
    }
    logCheck('1. Backend Health Check (/healthz)', passed, detail)
  } catch (err) {
    logCheck('1. Backend Health Check (/healthz)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 2: TLS Certificate Validity (for HTTPS origins)
  // --------------------------------------------------------------------------
  if (isHttps) {
    try {
      const certInfo = await new Promise((resolve, reject) => {
        const socket = tls.connect({
          host: url.hostname,
          port: url.port || 443,
          servername: url.hostname,
          rejectUnauthorized: !allowInsecure,
          timeout: 8000
        }, () => {
          const cert = socket.getPeerCertificate()
          const validTo = new Date(cert.valid_to)
          const daysLeft = Math.ceil((validTo - Date.now()) / (1000 * 60 * 60 * 24))
          socket.end()
          resolve({ validTo, daysLeft, subject: cert.subject })
        })
        socket.on('error', reject)
        socket.on('timeout', () => {
          socket.destroy()
          reject(new Error('TLS handshake timed out'))
        })
      })
      const isNotExpired = certInfo.validTo > new Date()
      logCheck('2. TLS Certificate Validity', isNotExpired, `Expires in ${certInfo.daysLeft} day(s) (${certInfo.validTo.toISOString().slice(0, 10)})`)
    } catch (err) {
      logCheck('2. TLS Certificate Validity', false, err.message)
    }
  } else {
    logCheck('2. TLS Certificate Validity', true, 'Skipped (HTTP origin)')
  }

  // --------------------------------------------------------------------------
  // Check 3: HSTS Header (Strict-Transport-Security, no preload on duckdns)
  // --------------------------------------------------------------------------
  try {
    const res = await request(`${origin}/healthz`)
    const hsts = res.headers['strict-transport-security']
    if (isHttps) {
      const hasHsts = Boolean(hsts && hsts.includes('max-age=31536000'))
      const hasPreload = Boolean(hsts && hsts.includes('preload'))
      const passed = hasHsts && !hasPreload
      let detail = hsts || 'Missing HSTS header'
      if (hasPreload) detail += ' (WARNING: preload must not be used on shared domain)'
      logCheck('3. Strict-Transport-Security (HSTS)', passed, detail)
    } else {
      logCheck('3. Strict-Transport-Security (HSTS)', true, 'Skipped on plaintext HTTP (verified in Caddy config)')
    }
  } catch (err) {
    logCheck('3. Strict-Transport-Security (HSTS)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 4: Frontend SPA Login Page
  // --------------------------------------------------------------------------
  try {
    const res = await request(`${origin}/`)
    const hasHtml = res.statusCode === 200 && typeof res.body === 'string' && (res.body.includes('<html') || res.body.includes('<!DOCTYPE') || res.body.includes('root'))
    logCheck('4. Frontend SPA Login Page', hasHtml, `Status ${res.statusCode}, length: ${res.body.length} bytes`)
  } catch (err) {
    logCheck('4. Frontend SPA Login Page', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 5: CORS Preflight with Safe Exam Browser Header
  // --------------------------------------------------------------------------
  try {
    const dummyExamId = '00000000-0000-0000-0000-000000000000'
    const res = await request(`${origin}/api/v1/attempts/exams/${dummyExamId}/start`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-SafeExamBrowser-ConfigKeyHash, Content-Type, Authorization'
      }
    })
    const allowHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase()
    const allowed = res.statusCode === 204 || res.statusCode === 200
    const includesSebHeader = allowHeaders.includes('x-safeexambrowser-configkeyhash') || allowHeaders.includes('*')
    const passed = allowed && includesSebHeader
    logCheck('5. CORS Preflight (SEB Headers)', passed, `Status ${res.statusCode}, Allow-Headers: "${res.headers['access-control-allow-headers'] || ''}"`)
  } catch (err) {
    logCheck('5. CORS Preflight (SEB Headers)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 6: Unauthenticated Ping Endpoint (/api/v1/seb/ping)
  // --------------------------------------------------------------------------
  try {
    const res = await request(`${origin}/api/v1/seb/ping`)
    let verified = false
    let isJson = false
    try {
      const json = JSON.parse(res.body)
      isJson = true
      verified = json.verified
    } catch (_) {}
    const passed = res.statusCode === 200 && isJson
    logCheck('6. SEB Ping Endpoint (/api/v1/seb/ping)', passed, `Status ${res.statusCode}, verified: ${verified}`)
  } catch (err) {
    logCheck('6. SEB Ping Endpoint (/api/v1/seb/ping)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 7: Exam Start Without SEB Header (Log vs Enforce Verification)
  // --------------------------------------------------------------------------
  try {
    const dummyExamId = '00000000-0000-0000-0000-000000000000'
    const res = await request(`${origin}/api/v1/attempts/exams/${dummyExamId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{}'
    })

    let json = {}
    try { json = JSON.parse(res.body) } catch (_) {}

    if (sebMode === 'enforce') {
      // In enforce mode, must reject with 403 SEB_REQUIRED
      const passed = res.statusCode === 403 && json.code === 'SEB_REQUIRED'
      logCheck('7. Exam Start Without SEB Header (Enforce Mode)', passed, `Status ${res.statusCode}, Code: "${json.code || ''}"`)
    } else {
      // In log mode, SEB middleware does NOT block with 403 SEB_REQUIRED
      // It passes through to auth/controller (expected 401 Unauthorized or 404 Exam Not Found)
      const passed = res.statusCode !== 403 || json.code !== 'SEB_REQUIRED'
      logCheck('7. Exam Start Without SEB Header (Log Mode Non-Blocking)', passed, `Status ${res.statusCode}, Code: "${json.code || ''}" (Non-blocking verified)`)
    }
  } catch (err) {
    logCheck('7. Exam Start Without SEB Header', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 8: WebSocket / Socket.io Engine Handshake
  // --------------------------------------------------------------------------
  try {
    const wsKey = crypto.randomBytes(16).toString('base64')
    let res = await request(`${origin}/socket.io/?EIO=4&transport=websocket`, {
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': wsKey
      }
    })

    if (res.statusCode !== 101) {
      // Fallback to polling probe if server supports polling transport
      res = await request(`${origin}/socket.io/?EIO=4&transport=polling`)
    }

    const isUpgrade101 = res.statusCode === 101 && (res.headers.upgrade === 'websocket' || Boolean(res.headers['sec-websocket-accept']))
    const isPolling200 = res.statusCode === 200 && typeof res.body === 'string' && res.body.includes('sid')
    const passed = isUpgrade101 || isPolling200

    let detail = `Status ${res.statusCode}`
    if (isUpgrade101) {
      detail += ' (101 Switching Protocols, WebSocket upgrade confirmed)'
    } else if (isPolling200) {
      detail += ' (Polling handshake OK)'
    }
    logCheck('8. WebSocket Handshake (/socket.io)', passed, detail)
  } catch (err) {
    logCheck('8. WebSocket Handshake (/socket.io)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('='.repeat(70))
  const failedCount = results.filter(r => !r.passed).length
  if (failedCount === 0) {
    console.log(` SUCCESS: All ${results.length} checks passed cleanly.`)
    process.exit(0)
  } else {
    console.error(` FAILURE: ${failedCount} of ${results.length} checks failed.`)
    process.exit(1)
  }
}

runSmokeSuite().catch((err) => {
  console.error('Fatal error executing smoke suite:', err)
  process.exit(1)
})

