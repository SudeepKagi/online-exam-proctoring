/**
 * queue.js
 * R4 — Queue Driver Abstraction (QUEUE_DRIVER=postgres|rabbitmq)
 *
 * Exposes a common lifecycle and dispatch interface:
 *   start(): start polling or consumer loop
 *   stop(): stop gracefully
 *   replayFailed(limit): replay DEAD / FAILED events
 *   registerHandler(eventType, fn): route event types to in-process handlers
 */

'use strict'

const config = require('../../shared/config')
const { logger } = require('../../shared/logging')
const { pgQueueDispatcher, registerHandler: registerPgHandler, registerAllHandlers } = require('../postgres/pgQueueDispatcher')
const { outboxPublisher } = require('../rabbitmq/outboxPublisher')

let activeQueueDriver = null

function getQueueDriver(driverName = null) {
  const chosen = (driverName || config.queueDriver || 'rabbitmq').toLowerCase().trim()
  if (activeQueueDriver && activeQueueDriver.name === chosen) {
    return activeQueueDriver
  }

  if (chosen === 'postgres') {
    activeQueueDriver = {
      name: 'postgres',
      start: () => pgQueueDispatcher.start(),
      stop: () => pgQueueDispatcher.stop(),
      replayFailed: (limit) => pgQueueDispatcher.replayFailed(limit),
      registerHandler: (eventType, fn) => registerPgHandler(eventType, fn),
      pollAndDispatch: () => pgQueueDispatcher.pollAndDispatch(),
      instance: pgQueueDispatcher
    }
    logger.info({ driver: 'postgres' }, 'Queue driver initialized: in-process Postgres outbox dispatcher')
  } else {
    activeQueueDriver = {
      name: 'rabbitmq',
      start: () => outboxPublisher.start(),
      stop: () => outboxPublisher.stop(),
      replayFailed: (limit) => outboxPublisher.replayFailed(limit),
      registerHandler: (eventType, fn) => {
        // RabbitMQ routes via AMQP exchanges and queues, but allow registration for testing/parity
        registerPgHandler(eventType, fn)
      },
      instance: outboxPublisher
    }
    logger.info({ driver: 'rabbitmq' }, 'Queue driver initialized: RabbitMQ outbox publisher')
  }

  return activeQueueDriver
}

function registerQueueHandler(eventType, fn) {
  registerPgHandler(eventType, fn)
}

module.exports = {
  getQueueDriver,
  registerQueueHandler,
  registerAllHandlers
}
