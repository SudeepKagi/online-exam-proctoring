const Redis = require('ioredis')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

class RedisManager {
  constructor() {
    this.client = null
    this.isReady = false
    this.inFlightRequests = new Map() // Singleflight coalescing map
    this.localMemoryFallback = new Map() // In-memory fallback if Redis is down
    this._init()
  }

  _init() {
    try {
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        lazyConnect: true,
        keyPrefix: config.redisPrefix,
        retryStrategy: (times) => {
          if (times > 3) {
            return null // Stop retrying aggressively; allow graceful fallback
          }
          return Math.min(times * 200, 1000)
        }
      })

      this.client.on('connect', () => {
        logger.info('Connected to Redis server')
      })

      this.client.on('ready', () => {
        this.isReady = true
        logger.info('Redis client is ready to accept commands')
      })

      this.client.on('error', (err) => {
        this.isReady = false
        logger.warn({ error: err.message }, 'Redis client connection issue, operating in fallback mode')
      })

      this.client.on('close', () => {
        this.isReady = false
      })

      // Attempt initial connection asynchronously
      this.client.connect().catch((err) => {
        logger.warn({ error: err.message }, 'Initial Redis connection failed; caching will use in-memory fallback')
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to initialize Redis client, using in-memory fallback')
      this.isReady = false
    }
  }

  /**
   * Singleflight Cache-Aside Get with L1 Memory and Redis L2
   */
  async getOrSet(key, fetcher, ttlSeconds = 21600) {
    // 1. Check L1 Memory cache first
    const now = Date.now()
    const memEntry = this.localMemoryFallback.get(key)
    if (memEntry && memEntry.expiresAt > now) {
      return memEntry.data
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
            // Populate L1 cache (60s TTL)
            this.localMemoryFallback.set(key, { data: parsed, expiresAt: now + 60000 })
            return parsed
          }
        } catch (err) {
          logger.warn({ key, error: err.message }, 'Redis GET failed, falling back to database fetcher')
        }
      }

      // 4. Cache miss: Execute fetcher
      const data = await fetcher()
      if (data !== undefined && data !== null) {
        // Add 10% jitter to TTL
        const jitter = Math.floor(ttlSeconds * 0.1 * (Math.random() * 2 - 1))
        const finalTtl = Math.max(60, ttlSeconds + jitter)

        // Store in L1 Memory cache
        this.localMemoryFallback.set(key, { data, expiresAt: now + Math.min(60000, finalTtl * 1000) })

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
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value)
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Date.now() + 3600000
    this.localMemoryFallback.set(key, { data: value, expiresAt })

    if (this.isReady && this.client) {
      try {
        if (ttlSeconds) {
          return await this.client.set(key, stringVal, 'EX', ttlSeconds)
        }
        return await this.client.set(key, stringVal)
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis SET error')
      }
    }
  }

  async get(key) {
    if (this.isReady && this.client) {
      try {
        const val = await this.client.get(key)
        if (val !== null) {
          try { return JSON.parse(val) } catch { return val }
        }
      } catch (err) {
        logger.warn({ key, error: err.message }, 'Redis GET error')
      }
    }
    const memEntry = this.localMemoryFallback.get(key)
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.data
    }
    return null
  }

  async del(key) {
    this.localMemoryFallback.delete(key)
    if (this.isReady && this.client) {
      try {
        return await this.client.del(key)
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
    // Local fallback
    const now = Date.now()
    const mem = this.localMemoryFallback.get(key)
    if (mem && mem.expiresAt > now) {
      return false
    }
    this.localMemoryFallback.set(key, { data: value, expiresAt: now + ttlMs })
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
    if (this.client) {
      try {
        await this.client.quit()
      } catch {}
    }
  }
}

const redis = new RedisManager()

module.exports = {
  redis,
  redisClient: redis,
  RedisManager
}

