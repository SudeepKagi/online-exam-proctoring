#!/usr/bin/env node
/**
 * boot-smoke.js
 * CI Boot Smoke Test (Prompt 8 / U2.3)
 * Starts the real server (`node src/app.js`), probes `/healthz` and `/api/v1/version`,
 * requests one route per module from ROUTE_INVENTORY.md (unauthenticated routes + 401s),
 * and fails if any ReferenceError, TypeError, or startup crash occurs.
 */

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')
const BACKEND_DIR = path.join(REPO_ROOT, 'proctornet/backend')
const TEST_PORT = process.env.BOOT_SMOKE_PORT || '5099'

console.log(`\n======================================================`)
console.log(`[BOOT-SMOKE] Starting Real Server Boot Smoke Test`)
console.log(`[BOOT-SMOKE] Port: ${TEST_PORT}`)
console.log(`======================================================\n`)

const MODULE_ROUTES = [
  { module: 'system', method: 'GET', path: '/healthz', expectedStatus: 200 },
  { module: 'system', method: 'GET', path: '/api/v1/version', expectedStatus: 200 },
  { module: 'system', method: 'GET', path: '/api/v1/config', expectedStatus: 200 },
  { module: 'auth', method: 'GET', path: '/api/v1/auth/me', expectedStatus: 401 },
  { module: 'admin', method: 'GET', path: '/api/v1/admin/dashboard', expectedStatus: 401 },
  { module: 'student', method: 'GET', path: '/api/v1/student/profile', expectedStatus: 401 },
  { module: 'faculty', method: 'GET', path: '/api/v1/faculty/exams', expectedStatus: 401 },
  { module: 'exams', method: 'GET', path: '/api/v1/exams/00000000-0000-0000-0000-000000000000', expectedStatus: 401 },
  { module: 'attempts', method: 'POST', path: '/api/v1/exams/00000000-0000-0000-0000-000000000000/readiness', expectedStatus: 401 },
  { module: 'audit', method: 'GET', path: '/api/v1/audit/logs', expectedStatus: 401 },
  { module: 'invigilator', method: 'GET', path: '/api/v1/invigilator/sessions', expectedStatus: 401 },
  { module: 'media', method: 'POST', path: '/api/v1/media/presign-upload', expectedStatus: 401 },
  { module: 'notifications', method: 'GET', path: '/api/v1/notifications', expectedStatus: 401 },
  { module: 'proctoring', method: 'POST', path: '/api/v1/proctoring/token', expectedStatus: 401 },
  { module: 'questions', method: 'DELETE', path: '/api/v1/questions/00000000-0000-0000-0000-000000000000', expectedStatus: 401 },
  { module: 'vpn', method: 'GET', path: '/api/v1/attempts/00000000-0000-0000-0000-000000000000/vpn', expectedStatus: 401 }
]

function makeRequest(method, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: reqPath,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000
      },
      (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout on ${method} ${reqPath}`))
    })
    req.end()
  })
}

async function waitForServer(maxAttempts = 30, intervalMs = 1000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await makeRequest('GET', '/healthz')
      if (res.status === 200) {
        return true
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

async function run() {
  let serverLogs = ''
  let hadFatalError = false

  const env = {
    ...process.env,
    PORT: TEST_PORT,
    INTERNAL_PORT: '9199',
    START_WORKERS: 'false',
    CACHE_DRIVER: process.env.CACHE_DRIVER || 'memory',
    QUEUE_DRIVER: process.env.QUEUE_DRIVER || 'postgres'
  }

  const serverProcess = spawn('node', ['src/app.js'], {
    cwd: BACKEND_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  serverProcess.stdout.on('data', data => {
    const text = data.toString()
    serverLogs += text
    process.stdout.write(`[SERVER] ${text}`)
  })

  serverProcess.stderr.on('data', data => {
    const text = data.toString()
    serverLogs += text
    process.stderr.write(`[SERVER-ERR] ${text}`)
  })

  let isCleaningUp = false

  serverProcess.on('exit', (code, signal) => {
    if (!isCleaningUp && code !== null && code !== 0) {
      console.error(`\x1b[31m[BOOT-SMOKE] Server process exited unexpectedly with code ${code}\x1b[0m`)
      hadFatalError = true
    }
  })

  const cleanup = async () => {
    isCleaningUp = true
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
      await new Promise(r => setTimeout(r, 1000))
      if (!serverProcess.killed) serverProcess.kill('SIGKILL')
    }
  }

  try {
    console.log(`[BOOT-SMOKE] Polling for server readiness at http://127.0.0.1:${TEST_PORT}/healthz ...`)
    const isReady = await waitForServer(25, 1000)
    if (!isReady) {
      throw new Error(`Server failed to respond on /healthz within 25 seconds.`)
    }
    console.log(`\x1b[32m[BOOT-SMOKE] Server is UP and healthy!\x1b[0m\n`)

    let failures = 0

    // Test routes across all modules
    for (const route of MODULE_ROUTES) {
      try {
        const res = await makeRequest(route.method, route.path)
        if (res.status === route.expectedStatus) {
          console.log(`  ✔ [${route.module.padEnd(14)}] ${route.method.padEnd(5)} ${route.path.padEnd(65)} -> HTTP ${res.status} (OK)`)
        } else {
          console.error(`  ✖ [${route.module.padEnd(14)}] ${route.method.padEnd(5)} ${route.path} -> Expected ${route.expectedStatus}, got ${res.status}`)
          failures++
        }
      } catch (err) {
        console.error(`  ✖ [${route.module.padEnd(14)}] ${route.method.padEnd(5)} ${route.path} -> Request Error: ${err.message}`)
        failures++
      }
    }

    // Inspect server log for fatal error patterns
    const forbiddenPatterns = [
      /\bReferenceError\b/,
      /\bTypeError\b/,
      /\bCannot find module\b/,
      /\bUnhandledPromiseRejection\b/
    ]

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(serverLogs)) {
        console.error(`\x1b[31m[BOOT-SMOKE] Fatal error detected in server log matching pattern: ${pattern}\x1b[0m`)
        failures++
      }
    }

    await cleanup()

    if (failures > 0 || hadFatalError) {
      console.error(`\n\x1b[31m[BOOT-SMOKE FAILED] ${failures} errors encountered during boot smoke test.\x1b[0m\n`)
      process.exit(1)
    } else {
      console.log(`\n\x1b[32m[BOOT-SMOKE PASSED] All modules routed successfully with zero ReferenceError / TypeError.\x1b[0m\n`)
      process.exit(0)
    }
  } catch (err) {
    await cleanup()
    console.error(`\n\x1b[31m[BOOT-SMOKE FAILED] Exception: ${err.message}\x1b[0m\n`)
    process.exit(1)
  }
}

run()
