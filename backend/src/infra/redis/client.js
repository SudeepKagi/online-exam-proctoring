'use strict'

const Redis = require('ioredis')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')
const { BoundedLruCache } = require('./lruCache')
const { L1_INVALIDATE_CHANNEL, setupPubSubInvalidation, publishInvalidation } = require('./invalidation')

class RedisManager {
  constructor() {
    this.client = null
    this.subClient = null
    this.isReady = false
    this.inFlightRequests = new Map()
    this.l1Cache = new BoundedLruCache(5000, 60000)
    this.localMemoryFallback = this.l1Cache
    this._init()
  }

  _init() {
    if (config.cacheDriver === 'memory') {
      logger.info('CACHE_DRIVER=memory: skipping Redis connection; operating purely on in-memory BoundedLruCache')
      this.isReady = false
      return
    }
    try {
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        connectTimeout: 2000,
        lazyConnect: true,
        keyPrefix: config.redisPrefix,
        retryStrategy: (times) => Math.min(times * 200, 5000)
      })

      this.client.on('connect', () => {
        logger.info('Connected to Redis server')
      })

      this.client.on('ready', () => {
        this.isReady = true
        logger.info('Redis client is ready to accept commands')
        setupPubSubInvalidation(this, config, logger)
      })

      this.client.on('error', (err) => {
        this.isReady = false
        logger.warn({ error: err.message }, 'Redis client connection issue, operating in fallback mode')
      })

      this.client.on('close', () => {
        this.isReady = false
      })

      this.client.connect().catch((err) => {
        logger.warn({ error: err.message }, 'Initial Redis connection failed; caching will use bounded LRU L1 fallback')
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to initialize Redis client, using bounded LRU L1 fallback')
      this.isReady = false
    }
  }

  async _publishInvalidation(key) {
    return publishInvalidation(this.client, this.isReady, key)
  }

  async getOrSet(key, fetcher, ttlSeconds = 21600) {
    const memEntry = this.l1Cache.get(key)
    if (memEntry !== null && memEntry !== undefined) return memEntry
    if (this.inFlightRequests.has(key)) return this.inFlightRequests.get(key)

    const fetchPromise = (async () => {
      if (this.isReady && this.client) {
        try {
          const cached = await this.client.get(key)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (!this.l1Cache.isEmpty(parsed)) {
              this.l1Cache.set(key, parsed, 60000)
              return parsed
            }
          }
        } catch (err) {
          logger.warn({ key, error: err.message }, 'Redis GET failed, falling back to database fetcher')
        }
      }

      const data = await fetcher()
      if (!this.l1Cache.isEmpty(data)) {
        const jitter = Math.floor(ttlSeconds * 0.1 * (Math.random() * 2 - 1))
        const finalTtl = Math.max(60, ttlSeconds + jitter)
        this.l1Cache.set(key, data, 60000)
        if (this.isReady && this.client) {
          try {
            await this.client.set(key, JSON.stringify(data), 'EX', finalTtl)
          } catch (err) {
            logger.warn({ key, error: err.message }, 'Redis SET failed')
          }
        }
      }
      return data
    })().finally(() => {
      this.inFlightRequests.delete(key)
    })

    this.inFlightRequests.set(key, fetchPromise)
    return fetchPromise
  }

  async set(key, value, ttlSeconds = null) {
    if (this.l1Cache.isEmpty(value)) return
    const l1TtlMs = ttlSeconds ? Math.min(ttlSeconds * 1000, 60000) : 60000
    this.l1Cache.set(key, value, l1TtlMs)

    if (this.isReady && this.client) {
      try {
        const stringVal = typeof value === 'string' ? value : JSON.stringify(value)
        if (ttlSeconds) {
          await this.client.set(key, stringVal, 'EX', ttlSeconds)
        } else {
          await this.client.set(key, stringVal)
        }
        await this._publishInvalidation(key)
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis SET error')
      }
    }
  }

  async get(key) {
    const memEntry = this.l1Cache.get(key)
    if (memEntry !== null && memEntry !== undefined) return memEntry

    if (this.isReady && this.client) {
      try {
        const val = await this.client.get(key)
        if (val !== null) {
          try {
            const parsed = JSON.parse(val)
            if (!this.l1Cache.isEmpty(parsed)) this.l1Cache.set(key, parsed, 60000)
            return parsed
          } catch {
            return val
          }
        }
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis GET error')
      }
    }
    return null
  }

  async del(key) {
    this.l1Cache.delete(key)
    if (this.isReady && this.client) {
      try {
        const res = await this.client.del(key)
        await this._publishInvalidation(key)
        return res
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis DEL error')
      }
    }
  }

  async setnxpx(key, value, ttlMs) {
    if (this.isReady && this.client) {
      try {
        const result = await this.client.set(key, value, 'PX', ttlMs, 'NX')
        return result === 'OK'
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis SETNX PX error')
      }
    }
    const mem = this.l1Cache.get(key)
    if (mem !== null && mem !== undefined) return false
    this.l1Cache.set(key, value, ttlMs)
    return true
  }

  async getWithL1(key) { return this.get(key) }
  async setWithL1(key, value, ttlSeconds = null) { return this.set(key, value, ttlSeconds) }
  async singleflight(key, fetcher, ttlSeconds = 21600) { return this.getOrSet(key, fetcher, ttlSeconds) }
  async quit() { return this.disconnect() }

  async disconnect() {
    if (this.subClient) {
      try {
        await Promise.race([this.subClient.quit(), new Promise((r) => setTimeout(r, 300))])
      } catch (_) { }
      try { this.subClient.disconnect(false) } catch (_) { }
      this.subClient = null
    }
    if (this.client) {
      try {
        await Promise.race([this.client.quit(), new Promise((r) => setTimeout(r, 300))])
      } catch (_) { }
      try { this.client.disconnect(false) } catch (_) { }
      this.client = null
    }
    this.isReady = false
  }

  async ping() {
    if (!this.client) return false
    try {
      const res = await this.client.ping()
      return res === 'PONG'
    } catch {
      return false
    }
  }
}

const redis = new RedisManager()

module.exports = {
  redis,
  redisClient: redis,
  RedisManager,
  BoundedLruCache,
  L1_INVALIDATE_CHANNEL
}
