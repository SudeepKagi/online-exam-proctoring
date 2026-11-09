#!/usr/bin/env node
'use strict'

/**
 * scripts/ops/run-retention-cleanup.js
 * Standalone CLI command for running evidence retention purge.
 * Suitable for systemd timers, ECS scheduled tasks, or Kubernetes CronJobs.
 *
 * Usage:
 *   node backend/scripts/ops/run-retention-cleanup.js [--dry-run] [--days=90]
 */

const { runRetentionCleanup } = require('../../src/jobs/retentionJob')

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const daysArg = args.find(a => a.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : undefined

  console.log(`[RetentionCLI] Starting retention cleanup (dryRun: ${isDryRun}, days: ${days || 90})...`)
  const summary = await runRetentionCleanup({ dryRun: isDryRun, retentionDays: days })
  console.log('[RetentionCLI] Summary:', JSON.stringify(summary, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('[RetentionCLI] Retention cleanup failed:', err)
  process.exit(1)
})

