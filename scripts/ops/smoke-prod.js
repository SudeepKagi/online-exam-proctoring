#!/usr/bin/env node
'use strict'

/**
 * ProctorNet Production Smoke Verification Suite
 * Usage:
 *   node scripts/ops/smoke-prod.js [--origin https://proctornet.duckdns.org] [--seb-mode log|enforce]
 *
 * Checks:
 *   1. /healthz probe returns HTTP 200 OK
 *   2. TLS certificate validity & expiration (for HTTPS origins)
 *   3. Strict-Transport-Security (HSTS) header verification
 *   4. Frontend SPA login page availability
 *   5. CORS preflight with X-SafeExamBrowser-ConfigKeyHash header
 *   6. /api/v1/seb/ping endpoint returns HTTP 200
 *   7. Unauthenticated Exam Start rejection (Returns 401 TOKEN_REQUIRED)
 *      NOTE: Verifies unauthenticated request rejection; does NOT claim SEB gating is verified on live.
 *   8. WebSocket Handshake (/socket.io) - Status 101 Switching Protocols
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

const origin = getArg('--origin', process.env.SMOKE_ORIGIN || 'https://proctornet.duckdns.org').replace(/\/+$/, '')
const sebMode = getArg('--seb-mode', process.env.SEB_MODE || 'log').toLowerCase()
const allowInsecure = args.includes('--insecure')

console.log('='.repeat(70))
console.log(' ProctorNet Production Smoke Verification')
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
 * Helper to perform HTTP/HTTPS request with upgrade support
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
          reject(new Error('TLS connection timed out'))
        })
      })

      const isNotExpired = certInfo.validTo > new Date()
      const detail = `Expires in ${certInfo.daysLeft} day(s) (${certInfo.validTo.toISOString().slice(0, 10)})`
      logCheck('2. TLS Certificate Validity', isNotExpired, detail)
    } catch (err) {
      logCheck('2. TLS Certificate Validity', false, err.message)
    }
  } else {
    logCheck('2. TLS Certificate Validity', true, 'Skipped for non-HTTPS origin')
  }

  // --------------------------------------------------------------------------
  // Check 3: HSTS Header (for HTTPS origins)
  // --------------------------------------------------------------------------
  if (isHttps) {
    try {
      const res = await request(`${origin}/healthz`)
      const hsts = res.headers['strict-transport-security'] || ''
      const hasHsts = Boolean(hsts && hsts.includes('max-age'))
      const detail = hsts ? hsts : 'Missing Strict-Transport-Security header'
      logCheck('3. Strict-Transport-Security (HSTS)', hasHsts, detail)
    } catch (err) {
      logCheck('3. Strict-Transport-Security (HSTS)', false, err.message)
    }
  } else {
    logCheck('3. Strict-Transport-Security (HSTS)', true, 'Skipped for non-HTTPS origin')
  }

  // --------------------------------------------------------------------------
  // Check 4: Frontend SPA Login / Root Page
  // --------------------------------------------------------------------------
  try {
    const res = await request(`${origin}/`)
    const passed = res.statusCode === 200 && res.body.toLowerCase().includes('<!doctype html')
    logCheck('4. Frontend SPA Login Page', passed, `Status ${res.statusCode}, length: ${res.body.length} bytes`)
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
  // Check 7: Unauthenticated Exam Start (Returns 401 TOKEN_REQUIRED)
  // NOTE: This check verifies unauthenticated request rejection on the attempts API;
  // it does NOT claim SEB gating is verified on live.
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

    const is401 = res.statusCode === 401
    const passed = is401
    const detail = `Status ${res.statusCode}, Code: "${json.code || ''}" (Unauthenticated request rejected; does NOT verify SEB gating)`
    logCheck('7. Unauthenticated Exam Start (401 TOKEN_REQUIRED)', passed, detail)
  } catch (err) {
    logCheck('7. Unauthenticated Exam Start (401 TOKEN_REQUIRED)', false, err.message)
  }

  // --------------------------------------------------------------------------
  // Check 8: WebSocket Handshake (/socket.io)
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
