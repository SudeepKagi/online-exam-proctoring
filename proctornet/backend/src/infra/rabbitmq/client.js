/**
 * client.js
 * Production-hardened RabbitMQ Manager via amqp-connection-manager (Q4 Task 1 & 2).
 * - Confirm channel for publish
 * - Channel setup asserting:
 *   - Exchanges: pn.events, pn.retry, pn.dlx
 *   - Retry ladder queues: pn.retry.5s, pn.retry.30s, pn.retry.5m
 *   - Main domain queues: pn.evaluation, pn.evidence, pn.notify, pn.vpn, pn.verify
 *   - DLQ queues with headers (x-error, x-attempts, x-last-failed-at)
 * - Automatic consumer re-attachment across broker drops & reconnects
 * - Bounded retries via retry ladder; poison messages routed to DLQ
 * - Never process.exit on broker loss
 */

const amqp = require('amqp-connection-manager')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

class RabbitMQManager {
  constructor() {
    this.connection = null
    this.channelWrapper = null
    this.isReady = false
    this.exchange = 'pn.events'
    this.retryExchange = 'pn.retry'
    this.dlxExchange = 'pn.dlx'

    this.queues = {
      evaluation: 'pn.evaluation',
      evidence: 'pn.evidence',
      notify: 'pn.notify',
      vpn: 'pn.vpn',
      verify: 'pn.verify'
    }

    this.prefetchMap = {
      evaluation: 10,
      evidence: 4,
      verify: 2,
      notify: 20,
      vpn: 5
    }

    // Registered consumer catalog for auto-(re)attaching on every (re)connect
    this.consumers = new Map() // queueKey -> { handler, options, prefetch }

    this._init()
  }

  _init() {
    if (config.queueDriver === 'postgres') {
      logger.info('QUEUE_DRIVER=postgres: skipping RabbitMQ connection')
      this.isReady = false
      return
    }

    const urls = [config.rabbitmqUrl || 'amqp://localhost:5672']

    this.connection = amqp.connect(urls, {
      reconnectTimeInSeconds: 2,
      heartbeatIntervalInSeconds: 5,
      connectionOptions: {
        clientProperties: { connection_name: 'proctornet-async-plane' }
      }
    })

    this.connection.on('connect', () => {
      logger.info('RabbitMQ connection established via connection manager')
      this.isReady = true
    })

    this.connection.on('disconnect', (params) => {
      this.isReady = false
      logger.warn({ err: params.err?.message }, 'RabbitMQ disconnected; will auto-reconnect')
    })

    this.connection.on('connectFailed', (params) => {
      this.isReady = false
      logger.warn({ err: params.err?.message }, 'RabbitMQ connect failed; retrying in background')
    })

    // Create confirm channel with auto-setup
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel) => {
        logger.info('Asserting RabbitMQ topology and (re)attaching registered consumers')
        await this._assertTopology(channel)
        await this._reattachConsumers(channel)
      }
    })
  }

  async _assertTopology(channel) {
    // 1. Primary Event Topic Exchange
    await channel.assertExchange(this.exchange, 'topic', { durable: true })

    // 2. Retry Exchange
    await channel.assertExchange(this.retryExchange, 'topic', { durable: true })

    // 3. Dead Letter Exchange (DLX)
    await channel.assertExchange(this.dlxExchange, 'topic', { durable: true })

    // 4. Retry Ladder Queues (TTL + dead-letter back to pn.events)
    const retryTtls = [
      { name: 'pn.retry.5s', key: 'retry.5s', ttl: 5000 },
      { name: 'pn.retry.30s', key: 'retry.30s', ttl: 30000 },
      { name: 'pn.retry.5m', key: 'retry.5m', ttl: 300000 }
    ]

    for (const r of retryTtls) {
      await channel.assertQueue(r.name, {
        durable: true,
        arguments: {
          'x-message-ttl': r.ttl,
          'x-dead-letter-exchange': this.exchange
        }
      })
      await channel.bindQueue(r.name, this.retryExchange, r.key)
    }

    // 5. Assert Main Queues & DLQ Queues
    for (const [key, queueName] of Object.entries(this.queues)) {
      const deadLetterQueue = `${queueName}.dlq`
      await channel.assertQueue(deadLetterQueue, { durable: true })
      await channel.bindQueue(deadLetterQueue, this.dlxExchange, `${key}.#`)
      await channel.bindQueue(deadLetterQueue, this.dlxExchange, `${queueName}.#`)

      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': this.dlxExchange,
          'x-dead-letter-routing-key': `${key}.dead`
        }
      })

      // Bind primary routing keys
      await channel.bindQueue(queueName, this.exchange, `${key}.#`)
      await channel.bindQueue(queueName, this.exchange, `attempt.${key}.#`)
    }

    // Specific domain routing bindings
    await channel.bindQueue(this.queues.evaluation, this.exchange, 'attempt.submitted')
    await channel.bindQueue(this.queues.evaluation, this.exchange, 'attempt.expired')
    await channel.bindQueue(this.queues.evaluation, this.exchange, 'attempt.terminated')
    await channel.bindQueue(this.queues.notify, this.exchange, 'result.ready')
    await channel.bindQueue(this.queues.evidence, this.exchange, 'evidence.uploaded')
    await channel.bindQueue(this.queues.verify, this.exchange, 'verify.face')
    await channel.bindQueue(this.queues.vpn, this.exchange, 'vpn.peer.remove')
  }

  async _reattachConsumers(channel) {
    for (const [queueKey, reg] of this.consumers.entries()) {
      await this._bindConsumerOnChannel(channel, queueKey, reg.handler, reg.options)
    }
  }

  async _bindConsumerOnChannel(channel, queueKey, handler, options = {}) {
    const queueName = this.queues[queueKey] || queueKey
    const prefetch = this.prefetchMap[queueKey] || 10
    await channel.prefetch(prefetch)

    logger.info({ queueName, prefetch }, 'Starting consumer on RabbitMQ channel')

    return channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return

        let content
        try {
          content = JSON.parse(msg.content.toString('utf8'))
        } catch (parseErr) {
          logger.error({ error: parseErr.message, queue: queueName }, 'Poison message: JSON parse failed. Routing to DLQ')
          this._routeToDLQ(channel, queueKey, msg, 'JSON_PARSE_ERROR', 99)
          channel.ack(msg)
          return
        }

        const headers = msg.properties.headers || {}
        const currentAttempts = parseInt(headers['x-attempts'] || '1', 10)

        try {
          await handler(content, msg)
          channel.ack(msg)
        } catch (err) {
          logger.error({
            error: err.message,
            queue: queueName,
            attempt: currentAttempts
          }, 'Consumer failed to process message; evaluating retry ladder')

          await this._handleConsumerFailure(channel, queueKey, msg, content, currentAttempts, err)
          channel.ack(msg) // Ack original after forwarding to retry ladder or DLQ
        }
      },
      options
    )
  }

  async _handleConsumerFailure(channel, queueKey, msg, content, currentAttempts, err) {
    const originalRoutingKey = msg.fields.routingKey || msg.properties.headers?.['x-original-routing-key'] || `${queueKey}.task`

    if (currentAttempts === 1) {
      // Step 1: 5-second retry
      await channel.publish(this.retryExchange, 'retry.5s', Buffer.from(JSON.stringify(content)), {
        headers: {
          ...msg.properties.headers,
          'x-attempts': 2,
          'x-error': err.message,
          'x-original-queue': queueKey,
          'x-original-routing-key': originalRoutingKey
        },
        persistent: true
      })
      logger.info({ queueKey, nextAttempt: 2 }, 'Routed message to pn.retry.5s')
    } else if (currentAttempts === 2) {
      // Step 2: 30-second retry
      await channel.publish(this.retryExchange, 'retry.30s', Buffer.from(JSON.stringify(content)), {
        headers: {
          ...msg.properties.headers,
          'x-attempts': 3,
          'x-error': err.message,
          'x-original-queue': queueKey,
          'x-original-routing-key': originalRoutingKey
        },
        persistent: true
      })
      logger.info({ queueKey, nextAttempt: 3 }, 'Routed message to pn.retry.30s')
    } else if (currentAttempts === 3) {
      // Step 3: 5-minute retry
      await channel.publish(this.retryExchange, 'retry.5m', Buffer.from(JSON.stringify(content)), {
        headers: {
          ...msg.properties.headers,
          'x-attempts': 4,
          'x-error': err.message,
          'x-original-queue': queueKey,
          'x-original-routing-key': originalRoutingKey
        },
        persistent: true
      })
      logger.info({ queueKey, nextAttempt: 4 }, 'Routed message to pn.retry.5m')
    } else {
      // Step 4: Bounded retries exhausted -> Poison DLQ
      await this._routeToDLQ(channel, queueKey, msg, err.message, currentAttempts)
    }
  }

  async _routeToDLQ(channel, queueKey, msg, errorMessage, attempts) {
    const originalRoutingKey = msg.fields.routingKey || msg.properties.headers?.['x-original-routing-key'] || `${queueKey}.poison`
    await channel.publish(this.dlxExchange, `${queueKey}.dead`, msg.content, {
      headers: {
        ...msg.properties.headers,
        'x-error': errorMessage,
        'x-attempts': attempts,
        'x-poison': true,
        'x-original-routing-key': originalRoutingKey,
        'x-last-failed-at': new Date().toISOString()
      },
      persistent: true
    })
    logger.warn({ queueKey, attempts, error: errorMessage }, 'Message routed to DLQ after exhausting retry ladder')
  }

  /**
   * Publishes an event payload using RabbitMQ confirm channel wrapper
   */
  async publish(routingKey, message, options = {}) {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ channel wrapper is not initialized')
    }

    const payload = typeof message === 'string' ? JSON.parse(message) : message

    return this.channelWrapper.publish(
      this.exchange,
      routingKey,
      payload,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        ...options
      }
    )
  }

  /**
   * Register a persistent consumer for a queue.
   * Consumer survives broker disconnects and re-attaches automatically.
   */
  async consume(queueKey, handler, options = {}) {
    this.consumers.set(queueKey, { handler, options })

    // If channel is already alive, attach immediately
    if (this.channelWrapper) {
      await this.channelWrapper.addSetup(async (channel) => {
        await this._bindConsumerOnChannel(channel, queueKey, handler, options)
      })
    }
  }

  async close() {
    try {
      if (this.channelWrapper) await this.channelWrapper.close()
      if (this.connection) await this.connection.close()
    } catch {
      // ignore close errors
    }
  }

  async checkHealth() {
    return Boolean(this.isReady && this.connection && this.channelWrapper)
  }
}

const rabbitmq = new RabbitMQManager()

module.exports = {
  rabbitmq,
  RabbitMQManager
}
