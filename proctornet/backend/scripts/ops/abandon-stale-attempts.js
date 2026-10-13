#!/usr/bin/env node
'use strict'

/**
 * abandon-stale-attempts.js
 *
 * Marks ACTIVE exam attempts as ABANDONED when the exam's endTime has
 * already passed. Called automatically by deploy-release.sh before the
 * exam-aware gate so that stale CI-seed or orphaned rows do not block
 * legitimate production deployments.
 *
 * Prints the count of abandoned rows to stdout and exits 0.
 * Never exits non-zero for operational use — a failure to clean up is
 * logged but does not abort the deploy script.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { prisma } = require('../../src/infra/postgres/client')

async function main () {
  const now = new Date()

  try {
    // Find ACTIVE attempts whose exam has already ended
    const stale = await prisma.examAttempt.findMany({
      where: {
        status: 'ACTIVE',
        exam: {
          endTime: { lt: now }
        }
      },
      select: { id: true, examId: true, exam: { select: { endTime: true } } }
    })

    if (stale.length === 0) {
      console.log('[abandon-stale-attempts] No stale ACTIVE attempts found.')
      process.exit(0)
    }

    const ids = stale.map(a => a.id)
    console.log(`[abandon-stale-attempts] Abandoning ${ids.length} stale attempt(s): ${ids.join(', ')}`)

    const result = await prisma.examAttempt.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'ABANDONED',
        submittedAt: now
      }
    })

    console.log(`[abandon-stale-attempts] Abandoned ${result.count} attempt(s).`)
    process.exit(0)
  } catch (err) {
    // Log but do not fail — let the gate decide
    console.error(`[abandon-stale-attempts] Error during cleanup: ${err.message}`)
    process.exit(0)
  } finally {
    try { await prisma.$disconnect() } catch { /* ignore */ }
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }
