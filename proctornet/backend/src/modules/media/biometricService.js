const { faceVerificationService } = require('./faceVerificationService')
const { rabbitmq } = require('../../infra/rabbitmq/client')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class BiometricService {
  /**
   * Verify candidate identity photo against live captured frame
   */
  async compareFaces(referenceKey, probeKeyOrBuffer) {
    if (!referenceKey) {
      logger.warn('Missing reference identity key for biometric comparison')
      return { matched: false, similarity: 0.0 }
    }

    try {
      const verifier = faceVerificationService.getVerifier()
      const result = await verifier.compare(referenceKey, probeKeyOrBuffer)
      const thresholds = faceVerificationService.getThresholds()
      const similarity = result.similarity ?? 0.0
      return {
        matched: similarity >= thresholds.pass,
        similarity,
        requestId: result.requestId,
        provider: result.provider
      }
    } catch (err) {
      logger.error({ error: err.message, referenceKey }, 'Error executing face comparison')
      return { matched: false, similarity: 0.0, error: err.message }
    }
  }

  /**
   * Enqueue asynchronous re-verification request to pn.verify queue
   */
  async enqueueReverification(attemptId, studentId, frameKey) {
    return await prisma.outboxEvent.create({
      data: {
        eventType: 'verify.face',
        payload: {
          attemptId,
          studentId,
          frameKey
        },
        status: 'PENDING',
        nextAttemptAt: new Date()
      }
    })
  }
}

/**
 * Worker consuming from pn.verify (prefetch 2)
 * Enforces two consecutive mismatches rule before raising violation (ADR-013 / Section R1)
 */
class VerificationWorker {
  constructor() {
    this.isStarted = false
    this.consumerTag = null
  }

  async start() {
    if (this.isStarted) return
    this.isStarted = true

    logger.info('Starting VerificationWorker for background candidate biometric re-verification')

    try {
      this.consumerTag = await rabbitmq.consume('verify', async (event, msg) => {
        await this.processEvent(event)
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not immediately start RabbitMQ verify consumer; will retry')
    }
  }

  async processEvent(event) {
    const payload = event.payload || event
    const { attemptId, studentId, frameKey } = payload

    if (!studentId || !frameKey) {
      logger.warn({ payload }, 'VerificationWorker received invalid payload')
      return
    }

    await faceVerificationService.verifyPeriodic({ attemptId, studentId, frameKey })
  }
}

/**
 * Direct biometric face verification check for pre-exam (fail-closed, multi-tier)
 */
async function verifyFaceBiometrics({ studentId, attemptId, liveFrame }) {
  if (!liveFrame) {
    return {
      verified: false,
      matchScore: 0.0,
      reason: 'Missing live frame for verification'
    }
  }

  try {
    const res = await faceVerificationService.verifyPreExam({
      attemptId,
      studentId,
      liveFrameKey: liveFrame
    })
    return {
      verified: res.verified === true,
      matchScore: typeof res.matchScore === 'number' ? res.matchScore : 0.0,
      reason: res.message || res.reason || (res.verified ? 'Verified' : 'Verification failed')
    }
  } catch (err) {
    return {
      verified: false,
      matchScore: 0.0,
      reason: `Biometric verification failed closed: ${err.message}`
    }
  }
}

const biometricService = new BiometricService()
const verificationWorker = new VerificationWorker()

module.exports = {
  biometricService,
  verificationWorker,
  verifyFaceBiometrics,
  faceVerificationService
}
