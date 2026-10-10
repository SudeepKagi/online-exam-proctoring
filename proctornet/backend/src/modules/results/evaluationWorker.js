const { resultRepository } = require('./repository')
const { rabbitmq } = require('../../infra/rabbitmq/client')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class EvaluationWorker {
  constructor() {
    this.consumerTag = null
    this.isStarted = false
  }

  async start() {
    if (this.isStarted) return
    this.isStarted = true

    if (process.env.QUEUE_DRIVER === 'postgres') {
      logger.info('EvaluationWorker: in-process postgres queue driver active, broker consumer skipped')
      return
    }

    logger.info('Starting EvaluationWorker for asynchronous grading')

    // Try consuming from RabbitMQ queue 'evaluation'
    try {
      this.consumerTag = await rabbitmq.consume('evaluation', async (event, msg) => {
        await this.processEvent(event)
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not immediately start RabbitMQ evaluation consumer; will retry')
    }
  }

  /**
   * Handle an outbox event dispatched by pgQueueDispatcher or broker
   */
  async handleEvent({ type, payload, eventId }) {
    const p = payload || {}
    const stableId = eventId || (p.attemptId ? `${type}:${p.attemptId}` : `${type}:${Date.now()}`)
    return this.processEvent({ type, payload: p, eventId: stableId })
  }

  /**
   * Process a single attempt evaluation event idempotently
   */
  async processEvent(event) {
    const payload = event.payload || event
    const eventId = event.eventId || payload.eventId || `${payload.attemptId}:eval`
    const attemptId = payload.attemptId

    if (!attemptId) {
      logger.warn({ event }, 'EvaluationWorker received event without attemptId')
      return
    }

    logger.info({ attemptId, eventId }, 'Evaluating exam attempt asynchronously')

    // 1. Check & record idempotent processing
    const processed = await prisma.$executeRawUnsafe(`
      INSERT INTO processed_events (id, event_id, handler_name, processed_at)
      VALUES (gen_random_uuid(), $1, 'evaluation_worker', now())
      ON CONFLICT (event_id, handler_name) DO NOTHING;
    `, eventId)

    // Even if already marked processed, evaluateAttemptSetBased is strictly idempotent via ON CONFLICT (attempt_id) DO NOTHING
    const result = await resultRepository.evaluateAttemptSetBased(attemptId)

    if (result) {
      logger.info({
        attemptId,
        score: result.score,
        totalMarks: result.total_marks || result.totalMarks,
        status: result.status
      }, 'Successfully evaluated attempt')

      // 2. Deliver result to student and staff via Redis Emitter (C-06 & test f)
      const examId = result.exam_id || result.examId
      try {
        const { socketEmitter } = require('../../infra/websocket/emitter')
        // Deliver to the right student via attempt room (Mandatory test f)
        socketEmitter.emitToAttempt(attemptId, 'result:ready', {
          attemptId,
          examId,
          resultId: result.id,
          score: result.score
        })
        // Notify invigilators room
        if (examId) {
          socketEmitter.emitToInvigilators(examId, 'result:ready', {
            attemptId,
            examId,
            resultId: result.id,
            score: result.score
          })
        }
      } catch (wsErr) {
        logger.warn({ error: wsErr.message }, 'Failed to emit WS result.ready notification')
      }

      // 3. Compute ranks once after the last result of an exam (job), not per read (C-07)
      if (examId) {
        try {
          const remainingUnevaluated = await prisma.examAttempt.count({
            where: {
              examId,
              status: { in: ['SUBMITTED', 'EXPIRED', 'TERMINATED'] },
              examResult: null
            }
          })
          if (remainingUnevaluated === 0) {
            logger.info({ examId }, 'Last result of exam evaluated: executing final rank computation job')
            await resultRepository.updateRanksForExam(examId)
          }
        } catch (rankErr) {
          logger.warn({ examId, error: rankErr.message }, 'Failed post-evaluation rank computation job')
        }
      }
    }

    return result
  }
}

const evaluationWorker = new EvaluationWorker()

module.exports = {
  EvaluationWorker,
  evaluationWorker
}
