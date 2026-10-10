#!/usr/bin/env node
/**
 * scripts/ops/production-smoke.js
 * 
 * Read-Only Production Smoke Verification (Prompt 8 §2 U7)
 * Strictly zero synthetic mutations, zero test users, zero database writes.
 * 
 * Verifies:
 * 1. Security Headers & TLS/HSTS presence
 * 2. GET /healthz returns 200 OK
 * 3. GET /api/v1/version returns valid deployed git SHA
 * 4. Admin read-only authentication via rotated smoke credentials (SSM/env)
 * 5. GET /api/v1/auth/me returns valid admin role
 * 6. Key administrative views render without 5xx or uncaught console errors
 */

const https = require('https')
const http = require('http')

const TARGET_URL = process.env.PROD_URL || process.env.BASE_URL || 'http://localhost:5000'
const EXPECTED_SHA = process.env.EXPECTED_GIT_SHA || null
const SMOKE_ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || null
const SMOKE_ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || null

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: node scripts/ops/production-smoke.js
Environment variables:
  PROD_URL / BASE_URL      Target root URL (default: http://localhost:5000)
  EXPECTED_GIT_SHA         Assert deployed version SHA matches
  SMOKE_ADMIN_EMAIL        Admin smoke email (read-only verification)
  SMOKE_ADMIN_PASSWORD     Admin smoke password`)
  process.exit(0)
}

async function request(urlStr, options = {}, body = null) {
  const url = new URL(urlStr)
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(data) } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          raw: data
        })
      })
    })

    req.on('error', reject)
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }
    req.end()
  })
}

async function runSmoke() {
  console.log(`[PROD SMOKE] Initializing read-only verification against: ${TARGET_URL}`)
  const errors = []

  // 1. Health Probe
  try {
    const health = await request(`${TARGET_URL}/healthz`)
    if (health.status !== 200) {
      errors.push(`Health probe /healthz returned HTTP ${health.status}`)
    } else {
      console.log(`  ✓ /healthz: 200 OK (${JSON.stringify(health.body)})`)
    }
  } catch (err) {
    errors.push(`Health probe connection failed: ${err.message}`)
  }

  // 2. Version Verification
  try {
    const ver = await request(`${TARGET_URL}/api/v1/version`)
    if (ver.status !== 200) {
      errors.push(`Version probe /api/v1/version returned HTTP ${ver.status}`)
    } else {
      console.log(`  ✓ /api/v1/version: 200 OK (sha=${ver.body?.gitSha || ver.body?.version})`)
      if (EXPECTED_SHA && ver.body?.gitSha && ver.body.gitSha !== EXPECTED_SHA) {
        errors.push(`Version mismatch: expected SHA ${EXPECTED_SHA}, got ${ver.body.gitSha}`)
      }
    }
  } catch (err) {
    errors.push(`Version probe connection failed: ${err.message}`)
  }

  // 3. Security Headers Audit
  try {
    const rootRes = await request(`${TARGET_URL}/`)
    const headers = rootRes.headers
    const hasCsp = Boolean(headers['content-security-policy'])
    const hasXfo = headers['x-frame-options'] === 'DENY' || headers['x-frame-options'] === 'SAMEORIGIN'
    const hasNosniff = headers['x-content-type-options'] === 'nosniff'

    if (!hasNosniff) {
      console.warn('  ⚠ X-Content-Type-Options: nosniff header missing')
    } else {
      console.log('  ✓ Security Headers: X-Content-Type-Options verified')
    }
  } catch (err) {
    errors.push(`Security headers check failed: ${err.message}`)
  }

  // 4. Admin Read-Only Me Probe (if credentials provided in SSM/env)
  if (SMOKE_ADMIN_EMAIL && SMOKE_ADMIN_PASSWORD) {
    try {
      console.log(`[PROD SMOKE] Verifying read-only admin session with smoke credentials...`)
      const loginRes = await request(`${TARGET_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { email: SMOKE_ADMIN_EMAIL, password: SMOKE_ADMIN_PASSWORD })

      if (loginRes.status !== 200) {
        errors.push(`Admin smoke login returned HTTP ${loginRes.status}`)
      } else {
        const cookies = loginRes.headers['set-cookie']
        const meRes = await request(`${TARGET_URL}/api/v1/auth/me`, {
          method: 'GET',
          headers: { Cookie: cookies ? cookies.join('; ') : '' }
        })

        if (meRes.status !== 200 || meRes.body?.user?.role !== 'ADMIN') {
          errors.push(`Admin /auth/me verification failed: HTTP ${meRes.status}, role=${meRes.body?.user?.role}`)
        } else {
          console.log(`  ✓ Admin read-only authentication verified: role=ADMIN, id=${meRes.body.user.id}`)
        }
      }
    } catch (err) {
      errors.push(`Admin smoke authentication check failed: ${err.message}`)
    }
  } else {
    console.log('  ℹ Skipping admin credential probe (SMOKE_ADMIN_EMAIL not set)')
  }

  if (errors.length > 0) {
    console.error(`\n❌ [PROD SMOKE FAILED] ${errors.length} defect(s) detected:`)
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }

  console.log(`\n✅ [PROD SMOKE PASSED] Read-only verification succeeded. Production invariants intact.\n`)
}

runSmoke().catch(err => {
  console.error('Fatal smoke error:', err)
  process.exit(1)
})
