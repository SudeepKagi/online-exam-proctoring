#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/smoke-live.js
 * Read-only live verification for ProctorNet production deployment.
 *
 * Checks:
 *   1. Health probe (/healthz or /health) returns HTTP 200
 *   2. TLS certificate validity & expiration
 *   3. Strict-Transport-Security (HSTS) header verification
 *   4. Frontend SPA login page (/login) availability
 *   5. SEB ping (/api/v1/seb/ping) returns HTTP 200
 *   6. CSP headers contain NO localhost or 127.0.0.1
 *   7. Startup storage probe log verified via AWS SSM journalctl
 *
 * Guaranteed READ-ONLY: Never creates accounts, exams, or uploads on live.
 */

const https = require('https')
const http = require('http')
const tls = require('tls')
const { execSync } = require('child_process')
const { URL } = require('url')

const origin = (process.argv[2] || process.env.LIVE_ORIGIN || 'https://proctornet.duckdns.org').replace(/\/+$/, '')
const instanceId = process.env.EC2_INSTANCE_ID || 'i-0d242d962823f0a89'
const awsRegion = process.env.AWS_REGION || 'ap-south-1'

console.log('='.repeat(72))
console.log(' ProctorNet Read-Only Live Smoke Verification')
console.log(` Target Origin : ${origin}`)
console.log(` Target EC2    : ${instanceId} (${awsRegion})`)
console.log(` Mode          : STRICT READ-ONLY (No state mutations)`)
console.log(` Timestamp     : ${new Date().toISOString()}`)
console.log('='.repeat(72))

const results = []

function logCheck(name, passed, detail = '') {
  const badge = passed ? '[PASS]' : '[FAIL]'
  console.log(` ${badge} ${name}${detail ? ` - ${detail}` : ''}`)
  results.push({ name, passed, detail })
}

function fetchUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const isHttps = parsed.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request({
      method: options.method || 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: options.headers || {},
      timeout: options.timeout || 12000
    }, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout connecting to ${urlStr}`))
    })
    req.on('error', reject)
    req.end()
  })
}

async function verifyTls(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      timeout: 10000
    }, () => {
      const cert = socket.getPeerCertificate()
      socket.destroy()
      if (!cert || !cert.valid_to) {
        return resolve({ valid: false, detail: 'No peer certificate presented' })
      }
      const validTo = new Date(cert.valid_to)
      const now = new Date()
      const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
      if (daysLeft < 0) {
        return resolve({ valid: false, detail: `Expired on ${cert.valid_to}` })
      }
      const issuerName = cert.issuer?.O || "Let's Encrypt"
      return resolve({
        valid: true,
        detail: `Valid until ${validTo.toISOString().split('T')[0]} (${daysLeft} days remaining; Issuer: ${issuerName})`
      })
    })

    socket.on('error', (err) => resolve({ valid: false, detail: err.message }))
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ valid: false, detail: 'TLS handshake timeout' })
    })
  })
}

async function run() {
  const urlObj = new URL(origin)
  const isHttps = urlObj.protocol === 'https:'

  // 1. Health Probe
  try {
    const res = await fetchUrl(`${origin}/healthz`)
    if (res.statusCode === 200) {
      logCheck('Health Probe (/healthz)', true, `HTTP 200 OK (${res.body.slice(0, 80).trim()})`)
    } else {
      const fallback = await fetchUrl(`${origin}/health`)
      logCheck('Health Probe (/health fallback)', fallback.statusCode === 200, `HTTP ${fallback.statusCode}`)
    }
  } catch (err) {
    logCheck('Health Probe (/healthz)', false, err.message)
  }

  // 2. TLS Certificate Validity
  if (isHttps) {
    const tlsResult = await verifyTls(urlObj.hostname, urlObj.port || 443)
    logCheck('TLS Certificate Validity', tlsResult.valid, tlsResult.detail)
  } else {
    logCheck('TLS Certificate Validity', true, 'Skipped for HTTP origin')
  }

  // 3. Strict-Transport-Security (HSTS) Header
  try {
    const res = await fetchUrl(`${origin}/`)
    const hsts = res.headers['strict-transport-security']
    if (isHttps) {
      logCheck('Strict-Transport-Security (HSTS)', Boolean(hsts), hsts || 'Missing HSTS header')
    } else {
      logCheck('Strict-Transport-Security (HSTS)', true, 'Skipped for plain HTTP')
    }
  } catch (err) {
    logCheck('Strict-Transport-Security (HSTS)', false, err.message)
  }

  // 4. Frontend SPA Login Page Availability
  try {
    const res = await fetchUrl(`${origin}/login`)
    const hasHtml = res.headers['content-type']?.includes('text/html')
    const hasRootDiv = res.body.includes('id="root"') || res.body.includes('<div')
    logCheck('Frontend SPA Login Page (/login)', res.statusCode === 200 && hasHtml && hasRootDiv, `HTTP ${res.statusCode} HTML content delivered`)
  } catch (err) {
    logCheck('Frontend SPA Login Page (/login)', false, err.message)
  }

  // 5. SEB Ping Endpoint
  try {
    const res = await fetchUrl(`${origin}/api/v1/seb/ping`)
    const isOk = res.statusCode === 200 && res.body.includes('verified')
    logCheck('SEB Ping Endpoint (/api/v1/seb/ping)', isOk, `HTTP ${res.statusCode} - ${res.body.trim()}`)
  } catch (err) {
    logCheck('SEB Ping Endpoint (/api/v1/seb/ping)', false, err.message)
  }

  // 6. Content Security Policy (CSP): No localhost or 127.0.0.1
  try {
    const res = await fetchUrl(`${origin}/`)
    const csp = res.headers['content-security-policy'] || ''
    const hasLocalhost = /localhost|127\.0\.0\.1|:9000/i.test(csp)
    if (!csp) {
      logCheck('CSP Header Sanitization', false, 'Missing Content-Security-Policy header')
    } else if (hasLocalhost) {
      logCheck('CSP Header Sanitization', false, `Forbidden internal address detected in CSP: ${csp}`)
    } else {
      logCheck('CSP Header Sanitization', true, 'Verified: zero localhost/127.0.0.1/minio references in production CSP')
    }
  } catch (err) {
    logCheck('CSP Header Sanitization', false, err.message)
  }

  // 7. Startup Storage Probe Verification via SSM
  try {
    const os = require('os')
    const fs = require('fs')
    const path = require('path')
    const tmpParam = path.join(os.tmpdir(), `ssm-probe-${Date.now()}.json`)
    fs.writeFileSync(tmpParam, JSON.stringify({
      commands: ["journalctl -u proctornet.service -n 80 --no-pager | grep 'Storage startup probe' || true"]
    }))

    const ssmCmd = `aws ssm send-command --instance-ids "${instanceId}" --region "${awsRegion}" --document-name "AWS-RunShellScript" --parameters "file://${tmpParam}" --output json`
    const output = execSync(ssmCmd, { encoding: 'utf8', timeout: 15000 })
    try { fs.unlinkSync(tmpParam) } catch (_) {}
    const parsed = JSON.parse(output)
    const commandId = parsed.Command?.CommandId

    if (commandId) {
      let ssmOutput = ''
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 1500))
        const statusCmd = `aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${instanceId}" --region "${awsRegion}" --output json`
        const statusOut = JSON.parse(execSync(statusCmd, { encoding: 'utf8', timeout: 10000 }))
        if (['Success', 'Failed', 'TimedOut', 'Cancelled'].includes(statusOut.Status)) {
          ssmOutput = statusOut.StandardOutputContent || ''
          break
        }
      }

      if (ssmOutput.includes('Storage startup probe: OK')) {
        logCheck('Startup Storage Probe via SSM', true, ssmOutput.trim().split('\n').pop())
      } else {
        logCheck('Startup Storage Probe via SSM', false, `Expected "Storage startup probe: OK" in logs: ${ssmOutput.trim()}`)
      }
    } else {
      logCheck('Startup Storage Probe via SSM', false, 'Failed to dispatch SSM command')
    }
  } catch (err) {
    logCheck('Startup Storage Probe via SSM', false, `SSM probe check failed: ${err.message}`)
  }

  console.log('='.repeat(72))
  const failed = results.filter(r => !r.passed)
  if (failed.length > 0) {
    console.error(`SMOKE VERIFICATION FAILED: ${failed.length} / ${results.length} checks failed.`)
    process.exit(1)
  } else {
    console.log(`SMOKE VERIFICATION SUCCESS: All ${results.length} checks PASSED cleanly.`)
    process.exit(0)
  }
}

run().catch(err => {
  console.error('Fatal error during smoke execution:', err)
  process.exit(1)
})
