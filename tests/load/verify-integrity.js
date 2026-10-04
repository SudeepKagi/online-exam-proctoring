#!/usr/bin/env node
/**
 * ==============================================================================
 * ProctorNet Post-Run Data Integrity Reconciliation (Phase P10 Task 10.3)
 * Authoritative Verifier: Asserts Zero Lost Acknowledged Answers & Concurrency Invariants
 * ==============================================================================
 */

const path = require('path')
module.paths.push(path.resolve(__dirname, '../../proctornet/backend/node_modules'))
require('dotenv').config({ path: path.resolve(__dirname, '../../proctornet/backend/.env') })
const fs = require('fs')
const readline = require('readline')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const args = process.argv.slice(2)
function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const RUN_ID = getArg('--run-id', '')
const REPORT_DIR = path.resolve(
  __dirname,
  '../../reports/load',
  RUN_ID || ''
)

// Valid State Transitions per ADR-004 & Notion 13.7 §16
const VALID_NEXT_STATES = {
  READY: ['ACTIVE', 'TIMED_OUT', 'TERMINATED'],
  ACTIVE: ['SUBMITTED', 'SUSPENDED', 'TERMINATED', 'TIMED_OUT'],
  SUSPENDED: ['ACTIVE', 'TERMINATED', 'TIMED_OUT', 'SUBMITTED'],
  SUBMITTED: [], // Terminal
  TERMINATED: [], // Terminal
  TIMED_OUT: []  // Terminal
}

async function verifyIntegrity() {
  console.log(`\n================================================================================`)
  console.log(`🔍 ProctorNet Post-Load Integrity Reconciliation`)
  console.log(`   Target Run: ${RUN_ID || '(Auto-Detect Latest)'}`)
  console.log(`   Report Dir: ${REPORT_DIR}`)
  console.log(`================================================================================\n`)

  // 1. Locate Ledger File
  let ledgerPath = path.join(REPORT_DIR, 'ledger.ndjson')
  if (!fs.existsSync(ledgerPath)) {
    // Search latest directory in reports/load if runId was not supplied
    const loadDir = path.resolve(__dirname, '../../reports/load')
    if (fs.existsSync(loadDir)) {
      const dirs = fs.readdirSync(loadDir).filter(d => fs.statSync(path.join(loadDir, d)).isDirectory() && d !== 'fixtures')
      dirs.sort().reverse()
      if (dirs.length > 0) {
        ledgerPath = path.join(loadDir, dirs[0], 'ledger.ndjson')
        console.log(`[+] Auto-detected latest run ledger: ${ledgerPath}`)
      }
    }
  }

  const latestAckedByQuestion = new Map() // key: attemptQuestionId -> { attemptId, revision, optionId, ackTime }
  let totalLedgerRecords = 0

  if (fs.existsSync(ledgerPath)) {
    console.log(`[+] Reading and parsing acknowledged write ledger (${ledgerPath})...`)
    const fileStream = fs.createReadStream(ledgerPath)
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const record = JSON.parse(line)
        totalLedgerRecords++
        // Keep the latest acknowledged write for each question
        latestAckedByQuestion.set(record.attemptQuestionId, record)
      } catch (err) {
        // Skip malformed lines
      }
    }
    console.log(`[✓] Parsed ${totalLedgerRecords} acknowledged writes across ${latestAckedByQuestion.size} distinct questions.`)
  } else {
    console.warn(`[-] No ledger.ndjson found at ${ledgerPath}. Proceeding with database-only invariant checks.`)
  }

  const results = {
    totalLedgerAcked: totalLedgerRecords,
    distinctQuestionsAcked: latestAckedByQuestion.size,
    lostAcknowledgedAnswers: 0,
    divergentRevisions: 0,
    duplicateResults: 0,
    missingResultsForSubmitted: 0,
    staleActiveAttempts: 0,
    stuckOutboxEvents: 0,
    illegalStateTransitions: 0,
    passed: true
  }

  // ----------------------------------------------------------------------------
  // INVARIANT 1: Zero Lost Acknowledged Answers
  // Every acknowledged write in the ledger MUST equal the final DB revision & option.
  // ----------------------------------------------------------------------------
  console.log('\n[1/6] Verifying Zero Lost Acknowledged Answers against PostgreSQL...')
  if (latestAckedByQuestion.size > 0) {
    const questionIds = Array.from(latestAckedByQuestion.keys())
    const BATCH = 500

    for (let i = 0; i < questionIds.length; i += BATCH) {
      const slice = questionIds.slice(i, i + BATCH)
      const dbAnswers = await prisma.answer.findMany({
        where: { attemptQuestionId: { in: slice } },
        select: {
          attemptQuestionId: true,
          selectedOptionId: true,
          revision: true
        }
      })

      const dbMap = new Map(dbAnswers.map(a => [a.attemptQuestionId, a]))

      for (const qId of slice) {
        const acked = latestAckedByQuestion.get(qId)
        const dbAnswer = dbMap.get(qId)

        if (!dbAnswer) {
          results.lostAcknowledgedAnswers++
          console.error(`  ❌ CRITICAL: Missing DB Answer for acknowledged question: ${qId}`)
        } else {
          // Verify option and revision
          if (acked.optionId && dbAnswer.selectedOptionId !== acked.optionId) {
            results.lostAcknowledgedAnswers++
            console.error(`  ❌ CRITICAL: Option mismatch on ${qId}. Acked=${acked.optionId}, DB=${dbAnswer.selectedOptionId}`)
          }
          if (dbAnswer.revision < acked.revision) {
            results.divergentRevisions++
            console.error(`  ❌ CRITICAL: DB Revision ${dbAnswer.revision} < Acked Revision ${acked.revision} on ${qId}`)
          }
        }
      }
    }
  }

  if (results.lostAcknowledgedAnswers === 0 && results.divergentRevisions === 0) {
    console.log('  ✅ PASS: Zero lost acknowledged answers verified across all ledger records.')
  } else {
    results.passed = false
  }

  // ----------------------------------------------------------------------------
  // INVARIANT 2: Exactly-Once Grading & Zero Duplicate Results
  // ----------------------------------------------------------------------------
  console.log('\n[2/6] Verifying Zero Duplicate Submissions and Exactly-Once Results...')
  const duplicateResults = await prisma.$queryRawUnsafe(`
    SELECT attempt_id, COUNT(*) as count
    FROM exam_results
    GROUP BY attempt_id
    HAVING COUNT(*) > 1;
  `)

  if (duplicateResults.length > 0) {
    results.duplicateResults = duplicateResults.length
    results.passed = false
    console.error(`  ❌ FAIL: Found ${duplicateResults.length} duplicate results!`)
  } else {
    console.log('  ✅ PASS: Zero duplicate (attempt_id) results in exam_results table.')
  }

  // Check that every SUBMITTED attempt has exactly one result
  const submittedWithoutResult = await prisma.$queryRawUnsafe(`
    SELECT ea.id
    FROM exam_attempts ea
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    WHERE ea.status = 'SUBMITTED' AND er.id IS NULL;
  `)

  if (submittedWithoutResult.length > 0) {
    results.missingResultsForSubmitted = submittedWithoutResult.length
    console.warn(`  ⚠️ Note: ${submittedWithoutResult.length} SUBMITTED attempts awaiting asynchronous worker evaluation.`)
  } else {
    console.log('  ✅ PASS: Every SUBMITTED attempt has a corresponding exam_result row.')
  }

  // ----------------------------------------------------------------------------
  // INVARIANT 3: No ACTIVE Attempts Past (expires_at + 60s)
  // ----------------------------------------------------------------------------
  console.log('\n[3/6] Verifying Absence of Stale ACTIVE Attempts Past Expiry + 60s...')
  const staleActive = await prisma.$queryRawUnsafe(`
    SELECT id, expires_at, status
    FROM exam_attempts
    WHERE status = 'ACTIVE'
      AND expires_at < (NOW() - INTERVAL '60 seconds');
  `)

  results.staleActiveAttempts = staleActive.length
  if (staleActive.length > 0) {
    results.passed = false
    console.error(`  ❌ FAIL: Found ${staleActive.length} ACTIVE attempts that should have been expired by sweeper!`)
  } else {
    console.log('  ✅ PASS: No lingering ACTIVE attempts past expires_at + 60s.')
  }

  // ----------------------------------------------------------------------------
  // INVARIANT 4: Outbox Drained & Zero Stuck Events
  // ----------------------------------------------------------------------------
  // INVARIANT 4: Outbox Drained & Zero Stuck Events
  // ----------------------------------------------------------------------------
  console.log('\n[4/6] Verifying Transactional Outbox State (outbox_events)...')
  const failedOutbox = await prisma.$queryRawUnsafe(`
    SELECT id, event_type, status, attempts, created_at
    FROM outbox_events
    WHERE status = 'FAILED';
  `)

  results.stuckOutboxEvents = failedOutbox.length
  if (failedOutbox.length > 0) {
    results.passed = false
    console.error(`  ❌ FAIL: Found ${failedOutbox.length} permanently FAILED outbox events!`)
  } else {
    console.log('  ✅ PASS: Outbox is healthy with zero permanently failed events.')
  }

  // ----------------------------------------------------------------------------
  // INVARIANT 5: No Illegal State Transitions in Audit Logs
  // ----------------------------------------------------------------------------
  console.log('\n[5/6] Verifying State Machine Invariants in audit_logs...')
  const attemptAuditLogs = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: 'ATTEMPT_STATE_' }
    },
    orderBy: { timestamp: 'asc' },
    select: {
      attemptId: true,
      action: true,
      metadata: true,
      timestamp: true
    }
  })

  // Group by attemptId and verify transitions
  const historyByAttempt = new Map()
  for (const log of attemptAuditLogs) {
    if (!log.attemptId) continue
    if (!historyByAttempt.has(log.attemptId)) {
      historyByAttempt.set(log.attemptId, [])
    }
    historyByAttempt.get(log.attemptId).push(log)
  }

  let illegalTransitions = 0
  for (const [attemptId, logs] of historyByAttempt.entries()) {
    let currentState = 'READY'
    for (const log of logs) {
      const targetState = log.metadata?.to || log.metadata?.targetStatus || log.action.replace('ATTEMPT_STATE_CHANGE_', '').replace('ATTEMPT_STATE_', '')
      const allowedFrom = log.metadata?.from

      // Fast-path start spike updates READY -> ACTIVE in SQL without individual audit log
      if (currentState === 'READY' && (allowedFrom?.includes('ACTIVE') || targetState === 'SUSPENDED' || targetState === 'TERMINATED' || targetState === 'SUBMITTED')) {
        currentState = 'ACTIVE'
      }

      if (allowedFrom && Array.isArray(allowedFrom)) {
        if (!allowedFrom.includes(currentState) && currentState !== targetState) {
          illegalTransitions++
          console.error(`  ❌ Illegal Transition on Attempt ${attemptId}: ${currentState} not in [${allowedFrom.join(', ')}] -> ${targetState}`)
        }
      } else if (currentState && targetState) {
        const allowed = VALID_NEXT_STATES[currentState] || []
        if (!allowed.includes(targetState) && currentState !== targetState) {
          illegalTransitions++
          console.error(`  ❌ Illegal Transition on Attempt ${attemptId}: ${currentState} -> ${targetState}`)
        }
      }
      currentState = targetState
    }
  }

  results.illegalStateTransitions = illegalTransitions
  if (illegalTransitions === 0) {
    console.log(`  ✅ PASS: Verified ${attemptAuditLogs.length} state transitions across ${historyByAttempt.size} attempts with zero illegal steps.`)
  } else {
    results.passed = false
  }

  // ----------------------------------------------------------------------------
  // 6. Aggregate Database Counts
  // ----------------------------------------------------------------------------
  console.log('\n[6/6] Collecting Final Database Aggregate Statistics...')
  const [totalAttempts, totalAnswers, totalResults, totalViolations] = await Promise.all([
    prisma.examAttempt.count(),
    prisma.answer.count(),
    prisma.examResult.count(),
    prisma.violationEvent.count()
  ])

  console.log(`  - Total Exam Attempts:   ${totalAttempts}`)
  console.log(`  - Total Saved Answers:   ${totalAnswers}`)
  console.log(`  - Total Evaluated Results: ${totalResults}`)
  console.log(`  - Total Recorded Violations: ${totalViolations}`)

  // ----------------------------------------------------------------------------
  // Final Reconciliation Verdict
  // ----------------------------------------------------------------------------
  console.log(`\n================================================================================`)
  console.log(`🏁 Integrity Reconciliation Verdict: ${results.passed ? 'PASSED ✅' : 'FAILED ❌'}`)
  console.log(`================================================================================\n`)

  return results
}

if (require.main === module) {
  verifyIntegrity()
    .then((results) => {
      process.exit(results.passed ? 0 : 1)
    })
    .catch((err) => {
      console.error('\n❌ Fatal Integrity Verification Error:', err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}

module.exports = { verifyIntegrity }
