#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/replay-failed-outbox.js
 *
 * Remediation script for F1:
 * - Lists outbox_events with status='FAILED' by event_type.
 * - Dry-run by default: displays count and samples.
 * - When run with --apply: resets status='PENDING', attempts=0, next_attempt_at=now().
 * - Prints before and after counts.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../proctornet/backend/.env') })
const { prisma } = require('../../proctornet/backend/src/infra/postgres/client')

async function main() {
  const isApply = process.argv.includes('--apply')
  console.log(`\n======================================================`)
  console.log(`ProctorNet Ops — Outbox FAILED Events Replayer`)
  console.log(`Mode: ${isApply ? 'APPLY (Mutating)' : 'DRY-RUN (Read-Only)'}`)
  console.log(`======================================================\n`)

  try {
    const failedRows = await prisma.$queryRawUnsafe(`
      SELECT event_type, COUNT(*)::int as count
      FROM outbox_events
      WHERE status = 'FAILED'
      GROUP BY event_type
      ORDER BY count DESC;
    `)

    const totalFailed = failedRows.reduce((acc, r) => acc + (r.count || 0), 0)
    console.log(`Current FAILED Outbox Events (Total: ${totalFailed}):`)
    if (failedRows.length === 0) {
      console.log('  No FAILED outbox events found. All events healthy.')
    } else {
      for (const row of failedRows) {
        console.log(`  - ${row.event_type}: ${row.count}`)
      }
    }

    if (!isApply) {
      console.log(`\n[DRY-RUN] To replay these failed events, run with:`)
      console.log(`  node scripts/ops/replay-failed-outbox.js --apply\n`)
      await prisma.$disconnect()
      process.exit(0)
    }

    if (totalFailed === 0) {
      console.log('\nNothing to replay. Exiting.\n')
      await prisma.$disconnect()
      process.exit(0)
    }

    console.log(`\nReplaying ${totalFailed} FAILED events...`)
    const updatedCount = await prisma.$executeRawUnsafe(`
      UPDATE outbox_events
      SET status = 'PENDING',
          attempts = 0,
          next_attempt_at = now(),
          last_error = NULL
      WHERE status = 'FAILED';
    `)

    console.log(`Successfully reset ${updatedCount} events to PENDING.`)

    // After counts
    const afterFailed = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM outbox_events
      WHERE status = 'FAILED';
    `)
    const remaining = afterFailed[0]?.count || 0
    console.log(`Remaining FAILED events after replay: ${remaining}\n`)

    await prisma.$disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Error replaying outbox events:', err)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }
