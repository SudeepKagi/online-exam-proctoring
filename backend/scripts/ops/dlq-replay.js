#!/usr/bin/env node
/**
 * dlq-replay.js
 * CLI script to replay poison / failed messages from RabbitMQ DLQ back to primary exchange (Q4 Task 2).
 * Usage:
 *   npm run ops:dlq-replay -- --queue pn.evaluation --limit 100
 *   node scripts/ops/dlq-replay.js --queue pn.evaluation --limit 100
 */

const amqplib = require('amqplib')
const config = require('../../src/shared/config')

async function replayDLQ() {
  const args = process.argv.slice(2)
  let queueArg = 'pn.evaluation'
  let limit = 100

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--queue' && args[i + 1]) {
      queueArg = args[i + 1]
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10)
      i++
    }
  }

  // Support both 'pn.evaluation' and 'pn.evaluation.dlq'
  const dlqQueue = queueArg.endsWith('.dlq') ? queueArg : `${queueArg}.dlq`
  const mainExchange = 'pn.events'

  console.log(`\n🔄 [DLQ-Replay] Starting replay from ${dlqQueue} (limit: ${limit})...`)

  let connection
  try {
    connection = await amqplib.connect(config.rabbitmqUrl || 'amqp://localhost:5672')
    const channel = await connection.createConfirmChannel()

    let replayed = 0

    for (let i = 0; i < limit; i++) {
      const msg = await channel.get(dlqQueue, { noAck: false })
      if (!msg) {
        break // No more messages in DLQ
      }

      const headers = msg.properties.headers || {}
      const routingKey = headers['x-original-routing-key'] || queueArg.replace('pn.', 'attempt.') || 'attempt.submitted'

      // Reset attempts and strip poison headers
      const cleanHeaders = {
        ...headers,
        'x-attempts': 1,
        'x-replayed-at': new Date().toISOString()
      }
      delete cleanHeaders['x-error']
      delete cleanHeaders['x-poison']

      await new Promise((resolve, reject) => {
        channel.publish(
          mainExchange,
          routingKey,
          msg.content,
          {
            headers: cleanHeaders,
            persistent: true,
            contentType: msg.properties.contentType || 'application/json'
          },
          (err) => {
            if (err) reject(err)
            else resolve()
          }
        )
      })

      // Ack from DLQ
      channel.ack(msg)
      replayed++
    }

    console.log(`✅ [DLQ-Replay] Successfully replayed ${replayed} messages from ${dlqQueue} to ${mainExchange}`)
    await channel.close()
    await connection.close()
    process.exit(0)
  } catch (err) {
    console.error(`❌ [DLQ-Replay] Failed:`, err.message)
    if (connection) await connection.close().catch(() => {})
    process.exit(1)
  }
}

replayDLQ()
