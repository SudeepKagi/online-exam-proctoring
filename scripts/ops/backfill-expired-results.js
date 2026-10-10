#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/backfill-expired-results.js
 *
 * Idempotent backfill script for F2:
 * - Finds attempts with status in ('SUBMITTED', 'EXPIRED', 'TERMINATED') that have NO exam_results row.
 * - Dry-run by default: reports count of unevaluated attempts.
 * - When run with --apply: directly evaluates them via resultRepository.evaluateAttemptSetBased
 *   and/or enqueues evaluation outbox events.
 * - Safe & idempotent: evaluateAttemptSetBased uses ON CONFLICT (attempt_id) DO NOTHING.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../proctornet/backend/.env') })
const { prisma } = require('../../proctornet/backend/src/infra/postgres/client')
const { resultRepository } = require('../../proctornet/backend/src/modules/results/repository')

async function main() {
  const isApply = process.argv.includes('--apply')
  console.log(`\n======================================================`)
  console.log(`ProctorNet Ops — Terminal Attempts Results Backfill`)
  console.log(`Mode: ${isApply ? 'APPLY (Mutating)' : 'DRY-RUN (Read-Only)'}`)
  console.log(`======================================================\n`)

  try {
    const unevaluated = await prisma.$queryRawUnsafe(`
      SELECT ea.id, ea.exam_id, ea.student_id, ea.status, ea.updated_at
      FROM exam_attempts ea
      WHERE ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
        AND NOT EXISTS (
          SELECT 1 FROM exam_results er WHERE er.attempt_id = ea.id
        )
      ORDER BY ea.created_at ASC;
    `)

    console.log(`Found ${unevaluated.length} terminal attempts without results:`)
    if (unevaluated.length === 0) {
      console.log('  All terminal attempts have evaluation results. Nothing to backfill.')
      await prisma.$disconnect()
      process.exit(0)
    }

    for (const att of unevaluated) {
      console.log(`  - Attempt ${att.id}: Status=${att.status}, Exam=${att.exam_id}, Student=${att.student_id}`)
    }

    if (!isApply) {
      console.log(`\n[DRY-RUN] To backfill these attempts, run with:`)
      console.log(`  node scripts/ops/backfill-expired-results.js --apply\n`)
      await prisma.$disconnect()
      process.exit(0)
    }

    console.log(`\nEvaluating ${unevaluated.length} attempts...`)
    let successCount = 0
    let failCount = 0

    for (const att of unevaluated) {
      try {
        const result = await resultRepository.evaluateAttemptSetBased(att.id)
        if (result) {
          successCount++
          console.log(`  ✓ Evaluated attempt ${att.id} -> Score: ${result.score}/${result.total_marks}`)
        } else {
          console.log(`  - Attempt ${att.id} already evaluated or skipped`)
        }
      } catch (err) {
        failCount++
        console.error(`  ✗ Error evaluating attempt ${att.id}: ${err.message}`)
      }
    }

    console.log(`\nBackfill summary: ${successCount} evaluated, ${failCount} failed.`)

    // Remaining check
    const remaining = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM exam_attempts ea
      WHERE ea.status IN ('SUBMITTED', 'EXPIRED', 'TERMINATED')
        AND NOT EXISTS (
          SELECT 1 FROM exam_results er WHERE er.attempt_id = ea.id
        );
    `)
    console.log(`Remaining terminal attempts without results: ${remaining[0]?.count || 0}\n`)

    await prisma.$disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Error during backfill:', err)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }
