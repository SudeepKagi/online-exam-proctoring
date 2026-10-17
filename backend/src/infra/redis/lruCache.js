'use strict'

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

module.exports = { BoundedLruCache }
