#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/seb-smoke-check.js
 * SEB Smoke Verification:
 * Starts/verifies against backend with SEB_MODE=enforce and a known SEB_CONFIG_KEY.
 * 1. Checks that an attempt start request WITHOUT SEB header returns HTTP 403 { code: 'SEB_REQUIRED' }.
 * 2. Computes the canonical hash using the formula (Variant A: sha256_hex(url + key)).
 * 3. Checks that an attempt start request WITH X-SafeExamBrowser-ConfigKeyHash header returns HTTP 200.
 */

const http = require('http')
const crypto = require('crypto')
const path = require('path')

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') })
} catch (_) {}

const TEST_CONFIG_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(data)
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data })
      })
    })
    req.on('error', reject)
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData))
    }
    req.end()
  })
}

async function runSmokeCheck() {
  const publicOrigin = process.env.PUBLIC_ORIGIN || 'http://localhost:5000'
  const originUrl = new URL(publicOrigin)
  const port = parseInt(originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80'), 10)
  const host = originUrl.hostname

  console.log(`[SEB Smoke] Target backend: ${publicOrigin} (host: ${host}, port: ${port})`)
  console.log(`[SEB Smoke] Using known test key: ${TEST_CONFIG_KEY}`)

  // 1. Health check
  console.log('[SEB Smoke] 1. Checking backend health (/health)...')
  let healthOk = false
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const healthRes = await request({ host, port, path: '/health', method: 'GET' })
      if (healthRes.status === 200) {
        healthOk = true
        console.log(`[✓] Backend healthy on attempt ${attempt}`)
        break
      }
    } catch (_) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  if (!healthOk) {
    throw new Error('Backend failed health probe')
  }

  // 2. Log in as student to obtain JWT token
  console.log('[SEB Smoke] 2. Logging in as student (student1@proctornet.com)...')
  const loginRes = await request(
    {
      host,
      port,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { email: 'student1@proctornet.com', password: 'Password@12345' }
  )

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    throw new Error(`Student login failed with HTTP ${loginRes.status}: ${JSON.stringify(loginRes.body)}`)
  }
  const token = loginRes.body.token
  console.log('[✓] Student authenticated successfully')

  // 3. Find or seed an exam that requires SEB
  const { prisma } = require(path.resolve(__dirname, '../../backend/src/infra/postgres/client'))
  let exam = await prisma.exam.findFirst({
    where: {
      proctoringConfig: {
        path: ['sebRequired'],
        equals: true
      },
      status: 'PUBLISHED'
    }
  })

  if (!exam) {
    console.log('[SEB Smoke] No published SEB exam found, creating and publishing a test exam...')
    const faculty = await prisma.user.findFirst({ where: { email: 'faculty@proctornet.com' } })
    if (!faculty) throw new Error('Faculty user not found for seeding test exam')

    const now = Date.now()
    exam = await prisma.exam.create({
      data: {
        title: 'CI SEB Smoke Verification Exam',
        courseCode: 'SEB101',
        startTime: new Date(now - 60000),
        endTime: new Date(now + 3600000),
        durationMinutes: 60,
        status: 'PUBLISHED',
        createdById: faculty.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: TEST_CONFIG_KEY
        },
        questions: {
          create: [
            {
              questionText: 'Is Safe Exam Browser required for this exam?',
              options: ['Yes', 'No'],
              correctOptionIndex: 0,
              marks: 10,
              displayOrder: 0
            }
          ]
        }
      }
    })
    console.log(`[✓] Created test exam ID: ${exam.id}`)
  }

  const startPath = `/api/v1/attempts/exams/${exam.id}/start`
  const canonicalUrl = `${publicOrigin}${startPath}`

  // 4. Test 1: Request WITHOUT SEB header in enforce mode
  console.log(`[SEB Smoke] 3. Sending POST ${startPath} WITHOUT SEB header...`)
  const rejectRes = await request({
    host,
    port,
    path: startPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })

  console.log(`[SEB Smoke] Response Status: ${rejectRes.status}, Body:`, rejectRes.body)
  if (rejectRes.status !== 403 || rejectRes.body?.code !== 'SEB_REQUIRED') {
    throw new Error(`Expected HTTP 403 with code SEB_REQUIRED, got HTTP ${rejectRes.status}: ${JSON.stringify(rejectRes.body)}`)
  }
  console.log('[✓] Successfully blocked with 403 SEB_REQUIRED when header is absent')

  // 5. Test 2: Calculate expected hash using formula (Variant A: sha256(canonicalUrl + key))
  console.log(`[SEB Smoke] 4. Calculating SEB Config Key hash for canonical URL: ${canonicalUrl}`)
  const expectedHash = crypto
    .createHash('sha256')
    .update(canonicalUrl + TEST_CONFIG_KEY)
    .digest('hex')
    .toLowerCase()
  console.log(`[SEB Smoke] Computed X-SafeExamBrowser-ConfigKeyHash: ${expectedHash}`)

  // 6. Test 3: Request WITH valid SEB header
  console.log(`[SEB Smoke] 5. Sending POST ${startPath} WITH valid SEB header...`)
  const allowRes = await request({
    host,
    port,
    path: startPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-SafeExamBrowser-ConfigKeyHash': expectedHash
    }
  })

  console.log(`[SEB Smoke] Response Status: ${allowRes.status}, Body:`, allowRes.body)
  if (allowRes.status !== 200 || allowRes.body?.status !== 'success') {
    throw new Error(`Expected HTTP 200 with status success, got HTTP ${allowRes.status}: ${JSON.stringify(allowRes.body)}`)
  }
  console.log('[✓] Successfully allowed with 200 OK when valid SEB header is present!')
  console.log('[SEB Smoke] All SEB smoke assertions passed successfully.')
  process.exit(0)
}

runSmokeCheck().catch((err) => {
  console.error('[x] SEB Smoke Verification failed:', err)
  process.exit(1)
})
