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

      // 2. Broadcast result.ready via WebSocket
      try {
        if (global.io) {
          global.io.to(`exam:${result.exam_id || result.examId}`).emit('result:ready', {
            attemptId,
            examId: result.exam_id || result.examId,
            resultId: result.id
          })
        }
      } catch (wsErr) {
        logger.warn({ error: wsErr.message }, 'Failed to emit WS result.ready notification')
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
