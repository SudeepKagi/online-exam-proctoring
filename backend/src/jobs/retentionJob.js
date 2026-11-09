/**
 * backend/src/jobs/retentionJob.js
 * Automated Retention Cleanup Worker (§Task 9)
 *
 * Enforces data minimization by purging proctoring evidence and logs older than
 * RETENTION_DAYS (default 90) for completed examinations whose results have been released.
 *
 * Invariants:
 * 1. Strictly skips any attempt under review hold (reviewStatus === 'PENDING' | 'CONFIRMED' or isFlagged === true).
 * 2. Purges S3 evidence objects and proctoring_logs database rows.
 * 3. Supports dryRun mode without modifying storage or database.
 * 4. Logs counts only (never logs student names, emails, or personal identifiers).
 */

'use strict'

const cron = require('node-cron')
const { prisma } = require('../infra/postgres/client')
const { deleteObject } = require('../infra/s3/s3.client')
const { logger } = require('../shared/logging')

async function runRetentionCleanup(options = {}) {
  const retentionDays = Number(options.retentionDays || process.env.RETENTION_DAYS || 90)
  const dryRun = Boolean(options.dryRun ?? process.argv.includes('--dry-run'))
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  // 1. Scan for candidate attempts finalized prior to cutoff in closed/evaluated exams
  const candidateAttempts = await prisma.examAttempt.findMany({
    where: {
      status: { in: ['SUBMITTED', 'TIMED_OUT'] },
      OR: [
        { submittedAt: { lte: cutoffDate } },
        { startedAt: { lte: cutoffDate } }
      ],
      exam: {
        OR: [
          { status: 'COMPLETED' },
          { endTime: { lte: cutoffDate } }
        ]
      }
    },
    select: {
      id: true,
      reviewStatus: true,
      isFlagged: true,
      proctoringLogs: {
        select: {
          id: true,
          evidenceKey: true
        }
      }
    }
  })

  let heldUnderReviewCount = 0
  const eligibleAttemptIds = []
  const evidenceKeysToDelete = []
  let totalEligibleLogs = 0

  for (const attempt of candidateAttempts) {
    // Review Hold Check: Never purge evidence for attempts currently under review or confirmed violations
    const isUnderReviewHold =
      attempt.reviewStatus === 'PENDING' ||
      attempt.reviewStatus === 'CONFIRMED' ||
      Boolean(attempt.isFlagged)

    if (isUnderReviewHold) {
      heldUnderReviewCount++
      continue
    }

    eligibleAttemptIds.push(attempt.id)
    totalEligibleLogs += attempt.proctoringLogs.length

    for (const log of attempt.proctoringLogs) {
      if (log.evidenceKey) {
        evidenceKeysToDelete.push(log.evidenceKey)
      }
    }
  }

  let deletedEvidenceCount = 0
  let deletedLogRowsCount = 0

  if (!dryRun && eligibleAttemptIds.length > 0) {
    // 2. Delete S3 snapshots
    for (const key of evidenceKeysToDelete) {
      try {
        await deleteObject(key)
        deletedEvidenceCount++
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Failed to delete S3 evidence key during retention purge')
      }
    }

    // 3. Delete proctoring_logs DB rows
    const deleteResult = await prisma.proctoringLog.deleteMany({
      where: {
        attemptId: { in: eligibleAttemptIds }
      }
    })
    deletedLogRowsCount = deleteResult.count
  } else if (dryRun) {
    deletedEvidenceCount = evidenceKeysToDelete.length
    deletedLogRowsCount = totalEligibleLogs
  }

  const summary = {
    dryRun,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    scannedAttempts: candidateAttempts.length,
    eligibleAttempts: eligibleAttemptIds.length,
    heldUnderReviewCount,
    deletedEvidenceCount,
    deletedLogRowsCount
  }

  // Count-only operational logging
  logger.info(
    { ...summary, event: 'RETENTION_CLEANUP_COMPLETED' },
    `[RetentionJob] Purge complete: ${deletedEvidenceCount} snapshots and ${deletedLogRowsCount} logs purged (${heldUnderReviewCount} held under review, dryRun: ${dryRun})`
  )

  return summary
}

function scheduleRetentionJob(cronSchedule = '0 2 * * *') {
  logger.info({ cronSchedule }, '[RetentionJob] Scheduling automated evidence retention job')
  return cron.schedule(cronSchedule, async () => {
    try {
      await runRetentionCleanup()
    } catch (err) {
      logger.error({ err: err.message }, '[RetentionJob] Scheduled cleanup failed')
    }
  })
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const daysArg = args.find(a => a.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : undefined

  runRetentionCleanup({ dryRun: isDryRun, retentionDays: days })
    .then((summary) => {
      console.log('Retention cleanup summary:', JSON.stringify(summary, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('Retention cleanup failed:', err)
      process.exit(1)
    })
}

module.exports = {
  runRetentionCleanup,
  scheduleRetentionJob
}
