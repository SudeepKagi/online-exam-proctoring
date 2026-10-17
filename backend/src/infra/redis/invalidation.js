'use strict'

const Redis = require('ioredis')

const L1_INVALIDATE_CHANNEL = 'pn:l1:invalidate'

function setupPubSubInvalidation(manager, config, logger) {
  if (manager.subClient) return
  try {
    manager.subClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 5000)
    })

    manager.subClient.on('ready', async () => {
      try {
        await manager.subClient.subscribe(L1_INVALIDATE_CHANNEL)
        logger.info({ channel: L1_INVALIDATE_CHANNEL }, 'Subscribed to L1 cache invalidation channel')
      } catch (err) {
        logger.warn({ error: err.message }, 'Failed to subscribe to L1 invalidation channel')
      }
    })

    manager.subClient.on('message', (channel, message) => {
      if (channel === L1_INVALIDATE_CHANNEL) {
        try {
          const { key } = JSON.parse(message)
          if (key) manager.l1Cache.delete(key)
        } catch (parseErr) {
          logger.debug({ error: parseErr.message }, 'Ignored malformed invalidation payload')
        }
      }
    })

    manager.subClient.on('error', (err) => {
      logger.warn({ error: err.message }, 'L1 invalidation Redis subscriber connection error')
    })

    manager.subClient.connect().catch((err) => {
      logger.warn({ error: err.message }, 'Failed initial subClient connect')
    })
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not initialize L1 invalidation subscriber')
  }
}

async function publishInvalidation(client, isReady, key) {
  if (isReady && client) {
    try {
      await client.publish(L1_INVALIDATE_CHANNEL, JSON.stringify({ key }))
    } catch {
      // Non-blocking best-effort invalidation
    }
  }
}

module.exports = {
  L1_INVALIDATE_CHANNEL,
  setupPubSubInvalidation,
  publishInvalidation
}
