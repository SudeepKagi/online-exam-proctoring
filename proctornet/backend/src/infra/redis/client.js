const Redis = require('ioredis')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

const L1_INVALIDATE_CHANNEL = 'pn:l1:invalidate'

/**
 * Bounded LRU Cache for L1 in-memory tier (C-05)
 * - Maximum 5,000 entries
 * - Maximum TTL 60 seconds
 * - Never caches empty content (null, undefined, [], {})
 */
class BoundedLruCache {
  constructor(maxEntries = 5000, defaultTtlMs = 60000) {
    this.maxEntries = maxEntries
    this.defaultTtlMs = Math.min(defaultTtlMs, 60000)
    this.cache = new Map()
  }

  isEmpty(data) {
    if (data === null || data === undefined) return true
    if (Array.isArray(data) && data.length === 0) return true
    if (typeof data === 'object' && Object.keys(data).length === 0) return true
    if (typeof data === 'string' && data.trim() === '') return true
    return false
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    // Refresh LRU order: delete and re-insert
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key, data, ttlMs = this.defaultTtlMs) {
    if (this.isEmpty(data)) return

    const effectiveTtl = Math.min(ttlMs, 60000)
    const entry = { data, expiresAt: Date.now() + effectiveTtl }

    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, entry)
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  size() {
    return this.cache.size
  }
}

class RedisManager {
  constructor() {
    this.client = null
    this.subClient = null
    this.isReady = false
    this.inFlightRequests = new Map()
    this.l1Cache = new BoundedLruCache(5000, 60000)
    this.localMemoryFallback = this.l1Cache // Backward compatibility alias
    this._init()
  }

  _init() {
    try {
      // Primary Redis connection with non-null retry strategy (C-05)
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        lazyConnect: true,
        keyPrefix: config.redisPrefix,
        retryStrategy: (times) => Math.min(times * 200, 5000) // Never null
      })

      this.client.on('connect', () => {
        logger.info('Connected to Redis server')
      })

      this.client.on('ready', () => {
        this.isReady = true
        logger.info('Redis client is ready to accept commands')
        this._setupPubSubInvalidation()
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

  _setupPubSubInvalidation() {
    if (this.subClient) return
    try {
      this.subClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 200, 5000)
      })

      this.subClient.on('ready', async () => {
        try {
          await this.subClient.subscribe(L1_INVALIDATE_CHANNEL)
          logger.info({ channel: L1_INVALIDATE_CHANNEL }, 'Subscribed to L1 cache invalidation channel')
        } catch (err) {
          logger.warn({ error: err.message }, 'Failed to subscribe to L1 invalidation channel')
        }
      })

      this.subClient.on('message', (channel, message) => {
        if (channel === L1_INVALIDATE_CHANNEL) {
          try {
            const { key } = JSON.parse(message)
            if (key) {
              this.l1Cache.delete(key)
            }
          } catch (parseErr) {
            logger.debug({ error: parseErr.message }, 'Ignored malformed invalidation payload')
          }
        }
      })

      this.subClient.on('error', (err) => {
        logger.warn({ error: err.message }, 'L1 invalidation Redis subscriber connection error')
      })

      this.subClient.connect().catch((err) => {
        logger.warn({ error: err.message }, 'Failed initial subClient connect')
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not initialize L1 invalidation subscriber')
    }
  }

  async _publishInvalidation(key) {
    if (this.isReady && this.client) {
      try {
        await this.client.publish(L1_INVALIDATE_CHANNEL, JSON.stringify({ key }))
      } catch {
        // Non-blocking best-effort invalidation
      }
    }
  }

  /**
   * Singleflight Cache-Aside Get with Bounded L1 LRU and Redis L2 (C-05)
   */
  async getOrSet(key, fetcher, ttlSeconds = 21600) {
    // 1. Check L1 Memory cache first (capped at 60s)
    const memEntry = this.l1Cache.get(key)
    if (memEntry !== null && memEntry !== undefined) {
      return memEntry
    }

    // 2. Singleflight coalescing: If a fetch for this key is already running, join it
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)
    }

    const fetchPromise = (async () => {
      // 3. Try reading from Redis L2
      if (this.isReady && this.client) {
        try {
          const cached = await this.client.get(key)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (!this.l1Cache.isEmpty(parsed)) {
              this.l1Cache.set(key, parsed, 60000) // L1 <= 60s
              return parsed
            }
          }
        } catch (err) {
          logger.warn({ key, error: err.message }, 'Redis GET failed, falling back to database fetcher')
        }
      }

      // 4. Cache miss: Execute fetcher
      const data = await fetcher()
      if (!this.l1Cache.isEmpty(data)) {
        // Add 10% jitter to TTL
        const jitter = Math.floor(ttlSeconds * 0.1 * (Math.random() * 2 - 1))
        const finalTtl = Math.max(60, ttlSeconds + jitter)

        // Store in L1 Memory cache (capped at 60s)
        this.l1Cache.set(key, data, 60000)

        // Store in Redis L2
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
    if (this.l1Cache.isEmpty(value)) {
      // Do not cache empty content (C-05)
      return
    }

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
    if (memEntry !== null && memEntry !== undefined) {
      return memEntry
    }

    if (this.isReady && this.client) {
      try {
        const val = await this.client.get(key)
        if (val !== null) {
          try {
            const parsed = JSON.parse(val)
            if (!this.l1Cache.isEmpty(parsed)) {
              this.l1Cache.set(key, parsed, 60000)
            }
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

  /**
   * Atomic SET if Not Exists with Expiry (for cooldowns and distributed locks)
   */
  async setnxpx(key, value, ttlMs) {
    if (this.isReady && this.client) {
      try {
        const result = await this.client.set(key, value, 'PX', ttlMs, 'NX')
        return result === 'OK'
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis SETNX PX error')
      }
    }
    // Bounded L1 fallback
    const mem = this.l1Cache.get(key)
    if (mem !== null && mem !== undefined) {
      return false
    }
    this.l1Cache.set(key, value, ttlMs)
    return true
  }

  async getWithL1(key) {
    return this.get(key)
  }

  async setWithL1(key, value, ttlSeconds = null) {
    return this.set(key, value, ttlSeconds)
  }

  async singleflight(key, fetcher, ttlSeconds = 21600) {
    return this.getOrSet(key, fetcher, ttlSeconds)
  }

  async quit() {
    return this.disconnect()
  }

  async disconnect() {
    if (this.subClient) {
      try { await this.subClient.quit() } catch (_err) {
        // Ignored during disconnection
      }
    }
    if (this.client) {
      try { await this.client.quit() } catch (_err) {
        // Ignored during disconnection
      }
    }
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


