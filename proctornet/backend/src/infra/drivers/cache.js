/**
 * cache.js
 * R4 — Cache Driver Abstraction (CACHE_DRIVER=memory|redis)
 *
 * Provides a unified cache interface selected at boot:
 * - 'memory': Pure bounded LRU (<= 5,000 entries) in-process cache, zero network dependencies.
 *             Enforced: single-instance only (APP_INSTANCES <= 1).
 * - 'redis': Dual-tier L1 in-process bounded LRU + L2 Redis cluster/instance.
 */

'use strict'

const config = require('../../shared/config')
const { logger } = require('../../shared/logging')
const { BoundedLruCache, RedisManager, redis: defaultRedisInstance } = require('../redis/client')

class MemoryCacheDriver {
  constructor(maxEntries = 5000, defaultTtlMs = 60000) {
    this.lru = new BoundedLruCache(maxEntries, defaultTtlMs)
    this.inFlight = new Map()
    this.driver = 'memory'
    this.isReady = true
  }

  async get(key) {
    return this.lru.get(key)
  }

  async set(key, value, ttlSeconds = null) {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : 60000
    this.lru.set(key, value, ttlMs)
  }

  async del(key) {
    this.lru.delete(key)
    return 1
  }

  async getOrSet(key, fetcher, ttlSeconds = 60) {
    const cached = this.lru.get(key)
    if (cached !== null && cached !== undefined) {
      return cached
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)
    }

    const p = (async () => {
      const data = await fetcher()
      if (!this.lru.isEmpty(data)) {
        this.lru.set(key, data, ttlSeconds * 1000)
      }
      return data
    })().finally(() => {
      this.inFlight.delete(key)
    })

    this.inFlight.set(key, p)
    return p
  }

  async setnxpx(key, value, ttlMs = 5000) {
    const existing = this.lru.get(key)
    if (existing !== null && existing !== undefined) {
      return false
    }
    this.lru.set(key, value, ttlMs)
    return true
  }

  async incr(key) {
    const cur = parseInt(this.lru.get(key) || '0', 10)
    const next = cur + 1
    this.lru.set(key, next, 3600000) // 1 hour default
    return next
  }

  async expire(key, seconds) {
    const cur = this.lru.get(key)
    if (cur !== null && cur !== undefined) {
      this.lru.set(key, cur, seconds * 1000)
      return true
    }
    return false
  }

  async ping() {
    return true
  }

  async disconnect() {
    this.lru.clear()
  }
}

class RedisCacheDriver {
  constructor(redisManager = defaultRedisInstance) {
    this.manager = redisManager
    this.driver = 'redis'
  }

  get isReady() {
    return this.manager.isReady
  }

  get client() {
    return this.manager.client
  }

  async get(key) {
    return this.manager.get(key)
  }

  async set(key, value, ttlSeconds = null) {
    return this.manager.set(key, value, ttlSeconds)
  }

  async del(key) {
    return this.manager.del(key)
  }

  async getOrSet(key, fetcher, ttlSeconds = 21600) {
    return this.manager.getOrSet(key, fetcher, ttlSeconds)
  }

  async setnxpx(key, value, ttlMs = 5000) {
    return this.manager.setnxpx(key, value, ttlMs)
  }

  async incr(key) {
    if (this.manager.isReady && this.manager.client) {
      return this.manager.client.incr(key)
    }
    return this.manager.localMemoryFallback.get(key) || 1
  }

  async expire(key, seconds) {
    if (this.manager.isReady && this.manager.client) {
      return this.manager.client.expire(key, seconds)
    }
    return true
  }

  async ping() {
    return this.manager.ping()
  }

  async disconnect() {
    return this.manager.disconnect()
  }
}

let activeCacheDriver = null

function getCacheDriver(driverName = null) {
  const chosen = (driverName || config.cacheDriver || 'redis').toLowerCase().trim()
  if (activeCacheDriver && activeCacheDriver.driver === chosen) {
    return activeCacheDriver
  }

  if (chosen === 'memory') {
    activeCacheDriver = new MemoryCacheDriver()
    logger.info({ driver: 'memory' }, 'Cache driver initialized: in-memory BoundedLruCache (<= 5,000 entries)')
  } else {
    activeCacheDriver = new RedisCacheDriver()
    logger.info({ driver: 'redis' }, 'Cache driver initialized: Redis dual-tier L1+L2')
  }

  return activeCacheDriver
}

module.exports = {
  getCacheDriver,
  MemoryCacheDriver,
  RedisCacheDriver
}
