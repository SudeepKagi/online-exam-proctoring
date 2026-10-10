#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/outbox-health.js
 *
 * Read-only health and invariants gate for production deployment and CI (§5).
 * Validates:
 * 1. outbox_events with status = 'FAILED' is 0
 * 2. outbox_events with status = 'PENDING' older than 60s is 0
 * 3. terminal exam_attempts ('SUBMITTED', 'EXPIRED', 'TERMINATED') older than 90s without exam_results is 0
 *
 * Exit code 0: Healthy
 * Exit code 1: Violation detected
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../proctornet/backend/.env') })
const { prisma } = require('../../proctornet/backend/src/infra/postgres/client')

async function checkOutboxHealth() {
  console.log('\n======================================================')
  console.log('ProctorNet Ops — Outbox & Terminal Results Health Gate')
  console.log('Mode: READ-ONLY INVARIANT AUDIT')
  console.log('======================================================\n')

  let hasViolations = false

  try {
    // 1. FAILED outbox events
    const failedRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM outbox_events
      WHERE status = 'FAILED';
    `)
    const failedCount = failedRows[0]?.count || 0
    if (failedCount > 0) {
      console.error(`[HEALTH VIOLATION] FAILED outbox events: ${failedCount} (expected: 0)`)
      const failedBreakdown = await prisma.$queryRawUnsafe(`
        SELECT event_type, COUNT(*)::int as count, MIN(last_error) as sample_error
        FROM outbox_events
        WHERE status = 'FAILED'
        GROUP BY event_type;
      `)
      for (const row of failedBreakdown) {
        console.error(`  - Type: ${row.event_type}, Count: ${row.count}, Error: ${row.sample_error}`)
      }
      hasViolations = true
    } else {
      console.log('  [PASS] FAILED outbox events: 0')
    }

    // 2. PENDING outbox events older than 60s
    const pendingOldRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM outbox_events
      WHERE status = 'PENDING'
        AND created_at < NOW() - INTERVAL '60 seconds';
    `)
    const pendingOldCount = pendingOldRows[0]?.count || 0
    if (pendingOldCount > 0) {
      console.error(`[HEALTH VIOLATION] Stale PENDING outbox events (>60s old): ${pendingOldCount} (expected: 0)`)
      hasViolations = true
    } else {
      console.log('  [PASS] Stale PENDING outbox events (>60s old): 0')
    }

    // 3. Terminal attempts older than 90s without results
    const terminalWithoutResultRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM exam_attempts ea
      WHERE ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
        AND ea.updated_at < NOW() - INTERVAL '90 seconds'
        AND NOT EXISTS (
          SELECT 1 FROM exam_results er WHERE er.attempt_id = ea.id
        );
    `)
    const terminalWithoutResultCount = terminalWithoutResultRows[0]?.count || 0
    if (terminalWithoutResultCount > 0) {
      console.error(`[HEALTH VIOLATION] Terminal attempts without results (>90s old): ${terminalWithoutResultCount} (expected: 0)`)
      const sampleAttempts = await prisma.$queryRawUnsafe(`
        SELECT ea.id, ea.exam_id, ea.student_id, ea.status, ea.updated_at
        FROM exam_attempts ea
        WHERE ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
          AND ea.updated_at < NOW() - INTERVAL '90 seconds'
          AND NOT EXISTS (
            SELECT 1 FROM exam_results er WHERE er.attempt_id = ea.id
          )
        LIMIT 5;
      `)
      for (const att of sampleAttempts) {
        console.error(`  - Attempt ${att.id}: Status=${att.status}, Exam=${att.exam_id}, Student=${att.student_id}`)
      }
      hasViolations = true
    } else {
      console.log('  [PASS] Terminal attempts without results (>90s old): 0')
    }

    console.log('')
    if (hasViolations) {
      console.error('[STATUS: UNHEALTHY] One or more invariant checks failed!\n')
      await prisma.$disconnect()
      return 1
    }

    console.log('[STATUS: HEALTHY] All outbox and attempt invariants satisfied.\n')
    await prisma.$disconnect()
    return 0
  } catch (err) {
    console.error('[FATAL] Database error executing outbox health check:', err)
    await prisma.$disconnect().catch(() => {})
    return 1
  }
}

if (require.main === module) {
  checkOutboxHealth()
    .then((exitCode) => {
      process.exit(exitCode)
    })
    .catch((err) => {
      console.error('[FATAL] Unhandled error:', err)
      process.exit(1)
    })
}

module.exports = { checkOutboxHealth }
