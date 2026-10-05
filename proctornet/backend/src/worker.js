/**
 * Dedicated Background Worker Process for ProctorNet (Phase P9 Task 1)
 *
 * Runs asynchronous background processors in an isolated container:
 * - Transactional Outbox Publisher (Postgres -> RabbitMQ)
 * - Exam Evaluation Worker (Async grading)
 * - Media Evidence Worker (Sharp thumbnails & validation)
 * - Biometric Verification Worker (Facial recognition matching)
 * - Attempt Expiry Sweeper (Timed exam lifecycle maintenance)
 * - WireGuard VPN Worker & Reconciler (Flag-gated via VPN_ENABLED)
 */
require('dotenv').config()
const { prisma } = require('./infra/postgres/client')
const { outboxPublisher } = require('./infra/rabbitmq/outboxPublisher')
const { evaluationWorker } = require('./modules/results/evaluationWorker')
const { evidenceWorker } = require('./modules/media/evidenceWorker')
const { verificationWorker } = require('./modules/media/biometricService')
const { expirySweeper } = require('./modules/attempts/expirySweeper')
const { examScheduler } = require('./modules/exams/examScheduler')
const { vpnWorker } = require('./modules/vpn/vpnWorker')
const { vpnReconciler } = require('./modules/vpn/vpnReconciler')
const { redisClient } = require('./infra/redis/client')
const { rabbitmq } = require('./infra/rabbitmq/client')
const { logger } = require('./observability/logger')

logger.info({ pid: process.pid }, 'Starting ProctorNet Background Worker daemon')

// Connect database client
prisma.$connect()
  .then(() => logger.info('Worker connected to PostgreSQL'))
  .catch((err) => {
    logger.error({ error: err.message }, 'Worker failed to connect to PostgreSQL')
    process.exit(1)
  })

// Start Core Asynchronous Workers
outboxPublisher.start()
evaluationWorker.start()
evidenceWorker.start()
verificationWorker.start()
expirySweeper.start()
examScheduler.start()
logger.info('Core background workers successfully started')

// Start WireGuard VPN Workers (Flag-gated)
if (process.env.VPN_ENABLED === 'true') {
  vpnWorker.start()
  vpnReconciler.start()
  logger.info('WireGuard VPN worker & reconciler started in worker daemon')
} else {
  logger.info('VPN_ENABLED is false; WireGuard workers remain inactive')
}

// Graceful Shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Worker received termination signal; shutting down background processors')

  expirySweeper.stop()
  examScheduler.stop()
  outboxPublisher.stop()

  if (process.env.VPN_ENABLED === 'true') {
    vpnReconciler.stop()
  }

  // Allow in-flight worker tasks up to 10s to complete
  await new Promise((resolve) => setTimeout(resolve, 2000))

  await Promise.allSettled([
    prisma.$disconnect(),
    redisClient.quit(),
    rabbitmq.close()
  ])

  logger.info('Worker connections closed cleanly; exiting')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
