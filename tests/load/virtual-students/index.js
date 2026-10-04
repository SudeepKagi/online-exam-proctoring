#!/usr/bin/env node
/**
 * ==============================================================================
 * ProctorNet Virtual Students Orchestrator (Phase P10 Task 10.3)
 * Full-fidelity concurrent simulation matching Section 10.1 load model
 * ==============================================================================
 */

const fs = require('fs')
const path = require('path')
module.paths.push(path.resolve(__dirname, '../../../proctornet/backend/node_modules'))
const { DeterministicPRNG } = require('./prng')
const { WriteLedger } = require('./ledger')
const { MetricsCollector } = require('./metrics')
const { VirtualStudent } = require('./student')
const { VirtualInvigilator } = require('./invigilator')

// CLI argument parsing
const args = process.argv.slice(2)
function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const N_STUDENTS = parseInt(getArg('--students', '100'), 10)
const PROFILE = getArg('--profile', 'ramp') // smoke, spike, autosave, submit, ramp, tierA, tierB, breakpoint
const RUN_ID = getArg('--run-id', `run-${Date.now()}`)
const MASTER_SEED = getArg('--seed', 'proctornet-p10-seed-2026')
const BASE_URL = getArg('--base-url', process.env.API_BASE_URL || 'http://localhost:5000')
const WS_URL = getArg('--ws-url', process.env.WS_BASE_URL || BASE_URL)
const TIME_SCALE = parseFloat(getArg('--scale', '0.1')) // Default 10x accelerated for test runs
const CONCURRENCY = parseInt(getArg('--concurrency', '50'), 10)

async function main() {
  console.log(`\n================================================================================`)
  console.log(`🎓 ProctorNet Virtual Students Load Campaign`)
  console.log(`   Run ID:      ${RUN_ID}`)
  console.log(`   Profile:     ${PROFILE.toUpperCase()}`)
  console.log(`   Students:    ${N_STUDENTS}`)
  console.log(`   Concurrency: ${CONCURRENCY}`)
  console.log(`   Time Scale:  ${TIME_SCALE}x (1.0 = real-time)`)
  console.log(`   Master Seed: ${MASTER_SEED}`)
  console.log(`   Target API:  ${BASE_URL}`)
  console.log(`================================================================================\n`)

  // Initialize components
  const prng = new DeterministicPRNG(MASTER_SEED)
  const ledger = new WriteLedger(RUN_ID)
  const metrics = new MetricsCollector()

  // Load fixture students
  const fixturesPath = path.resolve(__dirname, '../../../reports/load/fixtures/students.json')
  let fixtureStudents = []
  if (fs.existsSync(fixturesPath)) {
    try {
      fixtureStudents = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'))
    } catch (e) {
      console.warn('[-] Could not parse existing fixture file, generating fallback credentials...')
    }
  }

  // Build student list
  const students = []
  for (let i = 1; i <= N_STUDENTS; i++) {
    const fixture = fixtureStudents[i - 1]
    const email = fixture ? fixture.email : `loadtest-student-${i}@proctornet.test`
    const password = fixture ? fixture.password : 'Student123!'
    const examId = fixture ? fixture.examId : 'a0000000-0000-4000-8000-000000000001'

    const studentPrng = prng.fork(`student-${i}`)
    students.push(new VirtualStudent({
      index: i,
      email,
      password,
      examId,
      baseUrl: BASE_URL,
      wsUrl: WS_URL,
      prng: studentPrng,
      ledger,
      metrics
    }))
  }

  // Build invigilator agents (1 per 50 students)
  const nInvigilators = Math.max(1, Math.ceil(N_STUDENTS / 50))
  const invigilators = []
  for (let j = 1; j <= nInvigilators; j++) {
    const invPrng = prng.fork(`invigilator-${j}`)
    invigilators.push(new VirtualInvigilator({
      index: j,
      examId: 'a0000000-0000-4000-8000-000000000001',
      baseUrl: BASE_URL,
      wsUrl: WS_URL,
      prng: invPrng,
      metrics
    }))
  }

  console.log(`[+] Initialized ${students.length} virtual student agents and ${invigilators.length} virtual invigilators.`)

  // Launch Invigilators in background
  const invPromises = invigilators.map(inv => inv.runLifecycle({ timeScale: TIME_SCALE }))

  // Student simulation options per profile
  const simulationOptions = {
    timeScale: TIME_SCALE,
    pathologicalStart: PROFILE === 'spike_pathological',
    startSigma: PROFILE === 'spike' ? 8.0 : 4.0,
    skipStartDelay: PROFILE === 'smoke' || PROFILE === 'quick'
  }

  // Concurrent execution pool
  let activeIndex = 0
  let completedCount = 0
  const total = students.length

  const worker = async (workerId) => {
    while (activeIndex < total) {
      const idx = activeIndex++
      const student = students[idx]
      try {
        await student.runLifecycle(simulationOptions)
      } catch (err) {
        // Individual error logged in metrics
      } finally {
        completedCount++
        if (completedCount % 10 === 0 || completedCount === total) {
          process.stdout.write(`    Completed: ${completedCount}/${total} students (${Math.round((completedCount/total)*100)}%)\r`)
        }
      }
    }
  }

  console.log(`[+] Executing simulation workers...`)
  const poolSize = Math.min(CONCURRENCY, N_STUDENTS)
  const workers = []
  for (let w = 0; w < poolSize; w++) {
    workers.push(worker(w))
  }

  await Promise.all(workers)
  console.log(`\n[✓] All student lifecycle simulations finished.`)

  // Stop invigilators
  invigilators.forEach(inv => inv.cleanup())
  await Promise.allSettled(invPromises)

  // Finalize metrics & ledger
  metrics.endTime = Date.now()
  await ledger.close()

  // Save report
  const summary = metrics.getSummary(N_STUDENTS >= 500 ? 'A' : 'A')
  const summaryPath = path.join(ledger.reportDir, 'summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  // Print results
  metrics.printReport(N_STUDENTS >= 500 ? 'A' : 'A')
  console.log(`💾 Run artifacts saved to: ${ledger.reportDir}`)
  console.log(`   - summary.json`)
  console.log(`   - ledger.ndjson\n`)

  if (!summary.allSlosPassed) {
    console.warn(`⚠️ Warning: Some SLO thresholds were breached during this run.`)
  }

  return summary
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Virtual Students Orchestrator Error:', err)
    process.exit(1)
  })
}

module.exports = { main }
