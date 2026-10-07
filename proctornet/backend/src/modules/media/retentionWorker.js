const { prisma } = require('../../infra/postgres/client')
const { deleteObjects } = require('../../infra/s3/s3.client')
const { EVIDENCE_RETENTION_DAYS } = require('../../shared/evidencePolicy')
const { logger } = require('../../shared/logging')

const RETENTION_LOCK_ID = 987654323

class RetentionWorker {
  constructor() {
    this.timer = null
    this.isRunning = false
  }

  start(intervalMs = 3600000) {
    if (this.isRunning) return
    this.isRunning = true
    logger.info({ intervalMs }, 'RetentionWorker scheduler started')
    this.timer = setInterval(() => {
      this.tick().catch(err => logger.error({ error: err.message }, 'RetentionWorker scheduler error'))
    }, intervalMs)
    setTimeout(() => this.tick().catch((err) => logger.debug({ error: err.message }, 'Initial retention check deferred')), 5000)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
    logger.info('RetentionWorker scheduler stopped')
  }

  async tick() {
    const lockRes = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock($1) AS acquired;`, RETENTION_LOCK_ID).catch(() => null)
    if (!lockRes || !lockRes[0]?.acquired) return
    try {
      await this.runRetentionPurge()
    } finally {
      await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock($1);`, RETENTION_LOCK_ID).catch((err) => {
        logger.debug({ error: err.message }, 'Failed releasing retention lock')
      })
    }
  }

  /**
   * Purge evidence assets older than retention threshold (default 180 days)
   */
  async runRetentionPurge(options = {}) {
    const retentionDays = options.retentionDays || EVIDENCE_RETENTION_DAYS
    const batchSize = options.batchSize || 500

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    logger.info({ retentionDays, cutoff: cutoffDate.toISOString() }, 'Running evidence retention purge job')

    // Find expired violation events with evidence keys
    const expiredEvents = await prisma.violationEvent.findMany({
      where: {
        serverTimestamp: { lt: cutoffDate },
        OR: [
          { evidenceKey: { not: null } },
          { thumbKey: { not: null } }
        ]
      },
      select: {
        id: true,
        evidenceKey: true,
        thumbKey: true
      },
      take: batchSize
    })

    if (expiredEvents.length === 0) {
      logger.info('No expired evidence objects found to purge')
      return { purgedEvents: 0, deletedObjects: 0, cutoffDate }
    }

    // Collect S3 keys
    const keysToDelete = []
    const eventIds = []

    for (const ev of expiredEvents) {
      eventIds.push(ev.id)
      if (ev.evidenceKey) keysToDelete.push(ev.evidenceKey)
      if (ev.thumbKey) keysToDelete.push(ev.thumbKey)
    }

    // Delete in batches of 1,000 from S3
    let deletedCount = 0
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      const slice = keysToDelete.slice(i, i + 1000)
      try {
        await deleteObjects(slice)
        deletedCount += slice.length
      } catch (err) {
        logger.error({ error: err.message, batchCount: slice.length }, 'Failed to delete S3 objects during retention purge')
      }
    }

    // Update DB violation records: nullify keys and update status
    await prisma.violationEvent.updateMany({
      where: {
        id: { in: eventIds }
      },
      data: {
        evidenceKey: null,
        thumbKey: null,
        evidenceStatus: 'NONE'
      }
    })

    // Write immutable audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EVIDENCE_RETENTION_PURGE',
        actorRole: 'SYSTEM',
        resourceType: 'VIOLATION_EVIDENCE',
        metadata: {
          purgedEventsCount: expiredEvents.length,
          deletedObjectsCount: deletedCount,
          retentionDays,
          cutoff: cutoffDate.toISOString()
        }
      }
    })

    logger.info({
      purgedEvents: expiredEvents.length,
      deletedObjects: deletedCount,
      cutoff: cutoffDate.toISOString()
    }, 'Successfully completed evidence retention purge')

    return {
      purgedEvents: expiredEvents.length,
      deletedObjects: deletedCount,
      cutoffDate
    }
  }
}

module.exports = {
  RetentionWorker,
  retentionWorker: new RetentionWorker()
}
