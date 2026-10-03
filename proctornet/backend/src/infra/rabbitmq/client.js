const amqp = require('amqplib')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

class RabbitMQManager {
  constructor() {
    this.connection = null
    this.channel = null
    this.isReady = false
    this.exchange = 'pn.events'
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
    this._init()
  }

  async _init() {
    try {
      this.connection = await amqp.connect(config.rabbitmqUrl, {
        clientProperties: { connection_name: 'proctornet-api' }
      })

      this.connection.on('error', (err) => {
        logger.warn({ error: err.message }, 'RabbitMQ connection error; outbox will queue in Postgres')
        this.isReady = false
      })

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed; outbox will queue in Postgres')
        this.isReady = false
      })

      this.channel = await this.connection.createConfirmChannel()
      await this._assertTopology()
      this.isReady = true
      logger.info('RabbitMQ connection and topology established successfully')
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not connect to RabbitMQ; outbox events will accumulate in Postgres')
      this.isReady = false
    }
  }

  async _assertTopology() {
    if (!this.channel) return

    // 1. Topic Exchange
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true })

    // 2. Dead Letter Exchange
    const dlx = 'pn.dlx'
    await this.channel.assertExchange(dlx, 'topic', { durable: true })

    // 3. Durable queues with retry / dead letter routing
    for (const [key, queueName] of Object.entries(this.queues)) {
      const deadLetterQueue = `${queueName}.dlq`
      await this.channel.assertQueue(deadLetterQueue, { durable: true })
      await this.channel.bindQueue(deadLetterQueue, dlx, `${key}.#`)

      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': dlx,
          'x-dead-letter-routing-key': `${key}.dead`
        }
      })

      // Bind to main topic exchange
      await this.channel.bindQueue(queueName, this.exchange, `${key}.#`)
      await this.channel.bindQueue(queueName, this.exchange, `attempt.${key}.#`)
    }

    // Specific routing bindings
    await this.channel.bindQueue(this.queues.evaluation, this.exchange, 'attempt.submitted')
    await this.channel.bindQueue(this.queues.evaluation, this.exchange, 'attempt.expired')
    await this.channel.bindQueue(this.queues.notify, this.exchange, 'result.ready')
  }

  /**
   * Publishes an event payload using RabbitMQ confirm channel
   */
  async publish(routingKey, message, options = {}) {
    if (!this.isReady || !this.channel) {
      throw new Error('RabbitMQ channel is not ready')
    }

    const payload = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message))

    return new Promise((resolve, reject) => {
      this.channel.publish(
        this.exchange,
        routingKey,
        payload,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
          ...options
        },
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve(true)
          }
        }
      )
    })
  }

  async consume(queueKey, handler, options = {}) {
    if (!this.isReady || !this.channel) {
      logger.warn({ queueKey }, 'Cannot consume; RabbitMQ not ready')
      return null
    }

    const queueName = this.queues[queueKey] || queueKey
    const prefetch = this.prefetchMap[queueKey] || 10
    await this.channel.prefetch(prefetch)

    return this.channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return
        try {
          const content = JSON.parse(msg.content.toString('utf8'))
          await handler(content, msg)
          this.channel.ack(msg)
        } catch (err) {
          logger.error({ error: err.message, queue: queueName }, 'Consumer error in RabbitMQ message')
          // Requeue or route to dead-letter based on redelivery
          if (msg.fields.redelivered) {
            this.channel.nack(msg, false, false) // Send to DLQ
          } else {
            this.channel.nack(msg, false, true) // Requeue once
          }
        }
      },
      options
    )
  }

  async close() {
    try {
      if (this.channel) await this.channel.close()
      if (this.connection) await this.connection.close()
    } catch {}
  }
}

const rabbitmq = new RabbitMQManager()

module.exports = {
  rabbitmq,
  RabbitMQManager
}
