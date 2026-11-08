#!/usr/bin/env node
'use strict'

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') })

const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawn, execSync } = require('child_process')
const { prisma } = require('../../backend/src/infra/postgres/client')
const { signToken } = require('../../backend/src/utils/jwt')

const CONFIG_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const PORT = 5000
const BASE_URL = `http://127.0.0.1:${PORT}`
const NUM_STUDENTS = 20

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => resolve(res.statusCode))
        req.on('error', reject)
        req.setTimeout(1000, () => req.destroy())
      })
      if (res === 200) return true
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Server did not respond on ${url} within ${timeoutMs}ms`)
}

async function main() {
  console.log('======================================================================')
  console.log(' ProctorNet SEB Enforce High-Concurrency k6 Load Test Runner')
  console.log('======================================================================')

  const now = Date.now()

  // 1. Ensure faculty owner exists
  console.log('[1/5] Setting up load test faculty and questions...')
  let faculty = await prisma.user.findFirst({ where: { role: 'FACULTY' } })
  if (!faculty) {
    faculty = await prisma.user.create({
      data: {
        email: `load-fac-${now}@proctornet.com`,
        fullName: 'Load Test Faculty',
        passwordHash: 'dummyhash',
        role: 'FACULTY',
        status: 'ACTIVE',
      },
    })
  }

  // 2. Create SEB Exam in ENFORCE mode
  const examsSql = require('../../backend/src/modules/exams/exams.sql')

  const exam = await examsSql.createExam({
    title: `SEB Enforce Load Test Exam ${now}`,
    courseCode: `SEB-${now % 10000}`,
    durationMinutes: 30,
    startTime: new Date(now + 2000).toISOString(),
    endTime: new Date(now + 7200000).toISOString(),
    createdBy: faculty.id,
    status: 'DRAFT',
    proctoringConfig: {
      sebRequired: true,
      sebConfigKey: CONFIG_KEY,
    },
  })

  // 3. Create MCQ questions
  const q1 = await examsSql.addQuestion({
    examId: exam.id,
    questionText: 'What is the primary function of Safe Exam Browser?',
    options: ['Kiosk lock-down', 'Game emulator', 'Torrent client', 'Text editor'],
    correctOptionIndex: 0,
    marks: 4,
  })

  const q2 = await examsSql.addQuestion({
    examId: exam.id,
    questionText: 'Which HTTP header carries the Config Key hash in SEB?',
    options: ['Authorization', 'X-SafeExamBrowser-ConfigKeyHash', 'X-Forwarded-For', 'User-Agent'],
    correctOptionIndex: 1,
    marks: 4,
  })

  const { examService } = require('../../backend/src/modules/exams/exams.service')
  await examService.publishExam(exam.id)

  // 4. Provision N test students
  console.log(`[2/5] Provisioning ${NUM_STUDENTS} students and generating auth tokens...`)
  const students = []
  for (let i = 0; i < NUM_STUDENTS; i++) {
    const email = `load-student-${now}-${i}@proctornet.com`
    const user = await prisma.user.create({
      data: {
        email,
        fullName: `Load Student ${i + 1}`,
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    })
    const token = signToken({
      sub: user.id,
      id: user.id,
      email: user.email,
      role: 'STUDENT',
      name: user.fullName,
    })
    students.push({ id: user.id, email: user.email, token })
  }

  // 5. Write data file for k6
  const dataFilePath = path.resolve(__dirname, '../../tests/load/load-test-data.json')
  fs.writeFileSync(
    dataFilePath,
    JSON.stringify({
      baseUrl: BASE_URL,
      publicOrigin: BASE_URL,
      examId: exam.id,
      configKey: CONFIG_KEY,
      questions: [{ id: q1.id }, { id: q2.id }],
      students,
    }, null, 2)
  )

  // 6. Spawn backend server in SEB_MODE=enforce
  console.log('[3/5] Launching backend server with SEB_MODE=enforce...')
  const backendEntry = path.resolve(__dirname, '../../backend/src/app.js')
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    SEB_MODE: 'enforce',
    SEB_CONFIG_KEY: CONFIG_KEY,
    PUBLIC_ORIGIN: BASE_URL,
    CACHE_DRIVER: 'memory',
  }

  const serverProc = spawn('node', [backendEntry], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProc.stdout.on('data', (d) => {
    // console.log('[BACKEND]', d.toString().trim())
  })
  serverProc.stderr.on('data', (d) => {
    // console.error('[BACKEND ERR]', d.toString().trim())
  })

  try {
    await waitForServer(`${BASE_URL}/healthz`, 15000)
    console.log('[3/5] Backend is healthy and ready on port 5000 in enforce mode.')
    await new Promise((r) => setTimeout(r, 2000))

    // 7. Run k6
    console.log('[4/5] Running k6 load scenario (20 concurrent students)...')
    const k6Script = path.resolve(__dirname, '../../tests/load/exam-lifecycle-seb.k6.js')
    const k6Output = execSync(`k6 run "${k6Script}"`, {
      cwd: path.resolve(__dirname, '../../tests/load'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    console.log('[5/5] k6 execution output:')
    console.log('----------------------------------------------------------------------')
    console.log(k6Output)
    console.log('----------------------------------------------------------------------')

    return k6Output
  } finally {
    console.log('[CLEANUP] Stopping backend server, cleaning test exam/students and removing temporary files...')
    if (serverProc) serverProc.kill()
    if (fs.existsSync(dataFilePath)) fs.unlinkSync(dataFilePath)
    try {
      if (exam?.id) await prisma.exam.deleteMany({ where: { id: exam.id } }).catch(() => {})
      await prisma.user.deleteMany({ where: { email: { startsWith: `load-student-${now}` } } }).catch(() => {})
    } catch (_) {}
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('Load test completed successfully.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Load test failed:', err)
      process.exit(1)
    })
}

module.exports = { main }
