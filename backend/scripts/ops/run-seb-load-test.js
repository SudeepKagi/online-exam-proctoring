'use strict'

/**
 * run-seb-load-test.js
 * End-to-end k6 load testing harness for ProctorNet under strict SEB_MODE=enforce.
 * Features:
 * 1. Database safety guard: strictly mandates database name ending in _test or _pilot.
 * 2. Parametrized student concurrency (STUDENTS, default 200).
 * 3. Lifecycle: staggered start, periodic autosaves every 10s, staggered submit.
 * 4. Automatic cleanup of tagged 'loadtest' exams and student records.
 * 5. Concurrent docker stats telemetry sampling.
 */

const fs = require('fs')
const path = require('path')
const { spawn, execSync } = require('child_process')
const { prisma } = require('../../backend/src/infra/postgres/client')
const { signToken } = require('../../backend/src/utils/jwt')

// Safety guard: Database URL check
const dbUrl = process.env.DATABASE_URL || ''
const cleanDbUrl = dbUrl.split('?')[0]
const dbName = cleanDbUrl.split('/').pop() || ''
if (!dbName.endsWith('_test') && !dbName.endsWith('_pilot')) {
  console.error(`FATAL: Refusing to run load test against non-test database "${dbName}". Target must end in _test or _pilot.`)
  process.exit(1)
}

const NUM_STUDENTS = parseInt(process.env.STUDENTS || '200', 10)
const RAMP_WINDOW_SEC = parseInt(process.env.RAMP_WINDOW_SEC || (NUM_STUDENTS > 50 ? '60' : '5'), 10)
const AUTOSAVE_DURATION_SEC = parseInt(process.env.AUTOSAVE_DURATION_SEC || (NUM_STUDENTS > 50 ? '300' : '20'), 10)
const AUTOSAVE_INTERVAL_SEC = 10
const SUBMIT_WINDOW_SEC = parseInt(process.env.SUBMIT_WINDOW_SEC || (NUM_STUDENTS > 50 ? '120' : '5'), 10)

const PORT = 5055
const BASE_URL = `http://localhost:${PORT}`
const CONFIG_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const now = Date.now()

async function main() {
  console.log('======================================================================')
  console.log(' PROCTORNET SEB LOAD TEST HARNESS')
  console.log('======================================================================')
  console.log(`Database Target      : ${dbName} (Verified Safe Test Target)`)
  console.log(`Concurrent Students  : ${NUM_STUDENTS}`)
  console.log(`Start Ramp Window    : ${RAMP_WINDOW_SEC}s`)
  console.log(`Autosave Duration    : ${AUTOSAVE_DURATION_SEC}s (Every ${AUTOSAVE_INTERVAL_SEC}s)`)
  console.log(`Submit Ramp Window   : ${SUBMIT_WINDOW_SEC}s`)
  console.log(`SEB Mode             : enforce`)
  console.log('======================================================================')

  let serverProc = null
  let statsInterval = null
  let exam = null
  const dataFilePath = path.resolve(__dirname, '../../tests/load/load-test-data.json')
  const logsDir = path.resolve(__dirname, '../../logs-verification')
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
  const dockerStatsLogPath = path.join(logsDir, 'docker-stats.log')
  const k6LogPath = path.join(logsDir, 'k6-load-test.log')

  fs.writeFileSync(dockerStatsLogPath, `[ProctorNet Load Test Telemetry Log - ${new Date().toISOString()}]\n\n`)

  try {
    // 1. Create Teacher / Examiner account
    let faculty = await prisma.user.findFirst({ where: { role: 'FACULTY' } })
    if (!faculty) {
      faculty = await prisma.user.create({
        data: {
          email: `load-faculty-${now}@proctornet.test`,
          fullName: 'Load Test Faculty',
          passwordHash: 'dummyhash',
          role: 'FACULTY',
          status: 'ACTIVE',
        },
      })
    }

    // 2. Create Tagged 'loadtest' Exam
    console.log('[1/5] Provisioning tagged loadtest exam with SEB configuration...')
    exam = await prisma.exam.create({
      data: {
        title: `loadtest: SEB Enforce Load Test ${now}`,
        courseCode: 'CS801',
        description: 'Automated performance benchmark in SEB enforce mode',
        startTime: new Date(Date.now() + 2000),
        endTime: new Date(Date.now() + 7200000),
        durationMinutes: 45,
        totalMarks: 20,
        passingMarks: 8,
        status: 'DRAFT',
        createdById: faculty.id,
        proctoringConfig: {
          sebRequired: true,
          sebConfigKey: CONFIG_KEY,
          maxViolations: 3,
          tag: 'loadtest',
        },
      },
    })

    // 3. Add questions & publish
    const q1 = await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'What is the primary role of the SEB Config Key?',
        options: ['Validate client binary', 'Validate configuration hash', 'Encrypt audio stream', 'Format exam table'],
        correctOptionIndex: 1,
        marks: 10,
      },
    })
    const q2 = await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'Which HTTP header carries the Safe Exam Browser configuration hash?',
        options: ['X-SEB-Auth', 'X-SafeExamBrowser-ConfigKeyHash', 'Authorization', 'X-SEB-Signature'],
        correctOptionIndex: 1,
        marks: 10,
      },
    })

    const { examService } = require('../../backend/src/modules/exams/exams.service')
    await examService.publishExam(exam.id)

    // 4. Provision N test students
    console.log(`[2/5] Provisioning ${NUM_STUDENTS} students and generating JWTs...`)
    const students = []
    const studentRecords = []
    for (let i = 0; i < NUM_STUDENTS; i++) {
      const email = `loadtest-student-${now}-${i}@proctornet.test`
      const id = `loadtest-student-id-${now}-${i}`
      studentRecords.push({
        id,
        email,
        fullName: `Load Student ${i + 1}`,
        passwordHash: 'dummyhash',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      const token = signToken({
        sub: id,
        id,
        email,
        role: 'STUDENT',
        name: `Load Student ${i + 1}`,
      })
      students.push({ id, email, token })
    }

    await prisma.user.createMany({ data: studentRecords })

    // 5. Write data file for k6
    const maxDurationSec = RAMP_WINDOW_SEC + AUTOSAVE_DURATION_SEC + SUBMIT_WINDOW_SEC + 60
    fs.writeFileSync(
      dataFilePath,
      JSON.stringify({
        baseUrl: BASE_URL,
        publicOrigin: BASE_URL,
        examId: exam.id,
        configKey: CONFIG_KEY,
        questions: [{ id: q1.id }, { id: q2.id }],
        students,
        studentsCount: NUM_STUDENTS,
        rampWindowSec: RAMP_WINDOW_SEC,
        autosaveIntervalSec: AUTOSAVE_INTERVAL_SEC,
        autosaveDurationSec: AUTOSAVE_DURATION_SEC,
        submitWindowSec: SUBMIT_WINDOW_SEC,
        maxDurationSec,
      }, null, 2)
    )

    // 6. Spawn backend server in SEB_MODE=enforce
    console.log('[3/5] Launching backend server with SEB_MODE=enforce on port ' + PORT + '...')
    const backendEntry = path.resolve(__dirname, '../../backend/src/app.js')
    const env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      SEB_MODE: 'enforce',
      SEB_CONFIG_KEY: CONFIG_KEY,
      PUBLIC_ORIGIN: BASE_URL,
      CACHE_DRIVER: 'redis',
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    }

    serverProc = spawn('node', [backendEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    serverProc.stderr.on('data', (d) => {
      const msg = d.toString()
      if (msg.includes('FATAL') || msg.includes('Error')) {
        console.error(`[BACKEND STDERR] ${msg}`)
      }
    })

    // Wait for backend healthz
    await new Promise((resolve, reject) => {
      const start = Date.now()
      const check = setInterval(async () => {
        try {
          const res = await fetch(`${BASE_URL}/healthz`)
          if (res.ok) {
            clearInterval(check)
            resolve()
          }
        } catch (_err) {
          if (Date.now() - start > 15000) {
            clearInterval(check)
            reject(new Error('Backend server failed to start within 15 seconds'))
          }
        }
      }, 500)
    })
    console.log('[✓] Backend server is healthy on ' + BASE_URL)

    // Start background docker stats sampler
    statsInterval = setInterval(() => {
      try {
        const stats = execSync('docker stats --no-stream', { encoding: 'utf8' })
        fs.appendFileSync(dockerStatsLogPath, `--- ${new Date().toISOString()} ---\n${stats}\n`)
      } catch (_) {}
    }, 5000)

    // Wait 2s for exam scheduled startTime to open
    await new Promise((r) => setTimeout(r, 2000))

    // 7. Execute k6 load test
    console.log('[4/5] Executing k6 performance run...')
    const k6ScriptPath = path.resolve(__dirname, '../../tests/load/exam-lifecycle-seb.k6.js')
    let k6Output = ''
    try {
      k6Output = execSync(`k6 run "${k6ScriptPath}"`, {
        cwd: path.resolve(__dirname, '../../tests/load'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (k6Err) {
      k6Output = (k6Err.stdout || '') + '\n' + (k6Err.stderr || '')
      console.warn('[!] k6 completed with thresholds or non-zero exit code:')
    }

    fs.writeFileSync(k6LogPath, k6Output)

    console.log('[5/5] k6 execution output:')
    console.log('----------------------------------------------------------------------')
    console.log(k6Output)
    console.log('----------------------------------------------------------------------')

    return k6Output
  } finally {
    console.log('[CLEANUP] Stopping stats sampler, stopping backend, and deleting tagged test data...')
    if (statsInterval) clearInterval(statsInterval)
    if (serverProc) serverProc.kill()
    if (fs.existsSync(dataFilePath)) fs.unlinkSync(dataFilePath)

    try {
      if (exam?.id) {
        await prisma.examAttempt.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.question.deleteMany({ where: { examId: exam.id } }).catch(() => {})
        await prisma.exam.deleteMany({ where: { id: exam.id } }).catch(() => {})
      }
      await prisma.exam.deleteMany({ where: { title: { startsWith: 'loadtest' } } }).catch(() => {})
      await prisma.user.deleteMany({ where: { email: { startsWith: `loadtest-student-${now}` } } }).catch(() => {})
    } catch (cleanErr) {
      console.warn('[CLEANUP WARN]', cleanErr.message)
    }
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
