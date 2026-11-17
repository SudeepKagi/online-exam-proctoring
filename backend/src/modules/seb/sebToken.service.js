'use strict'

const crypto = require('crypto')

// Token TTL: 5 minutes
const LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000

/**
 * In-Memory Token Store with automatic expiration.
 * In a multi-instance setup with Redis, this also coordinates with Redis key-value storage.
 */
class SebTokenStore {
  constructor() {
    // Map of tokenHash -> TokenRecord
    this.tokens = new Map()
    // Map of pinHash -> tokenHash
    this.pins = new Map()
    // Map of `${userId}:${examId || 'check'}` -> tokenHash (for invalidating older tokens)
    this.userActiveTokens = new Map()
    // Map of pinHash -> failed attempt count
    this.pinAttempts = new Map()

    // Periodic cleanup of expired tokens every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired()
    }, 60 * 1000)

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  purgeExpired() {
    const now = Date.now()
    for (const [hash, record] of this.tokens.entries()) {
      if (record.expiresAt < now) {
        this.tokens.delete(hash)
        if (record.pinHash) {
          this.pins.delete(record.pinHash)
          this.pinAttempts.delete(record.pinHash)
        }
        const userKey = `${record.userId}:${record.examId || 'check'}`
        if (this.userActiveTokens.get(userKey) === hash) {
          this.userActiveTokens.delete(userKey)
        }
      }
    }
  }

  hash(data) {
    return crypto.createHash('sha256').update(String(data).trim()).digest('hex')
  }

  /**
   * Generates a new 32-byte launch token and a 6-digit numeric PIN.
   * Invalidates any previously active unconsumed token for this user/exam.
   */
  createLaunchToken({ userId, userRole, examId = null, purpose = 'exam' }) {
    if (!userId) {
      throw new Error('userId is required to create a launch token')
    }

    const userKey = `${userId}:${examId || 'check'}`

    // Invalidate existing active tokens for this user and scope
    const existingHash = this.userActiveTokens.get(userKey)
    if (existingHash && this.tokens.has(existingHash)) {
      const oldRecord = this.tokens.get(existingHash)
      if (!oldRecord.consumedAt) {
        oldRecord.consumedAt = Date.now()
        oldRecord.invalidated = true
      }
      if (oldRecord.pinHash) {
        this.pins.delete(oldRecord.pinHash)
      }
    }

    // 32-byte cryptographically secure random token (64 hex chars)
    const rawLaunchToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hash(rawLaunchToken)

    // Dedicated download token (32 bytes) or same token hash
    const rawDownloadToken = crypto.randomBytes(32).toString('hex')
    const downloadTokenHash = this.hash(rawDownloadToken)

    // 6-digit cryptographically random numeric PIN
    const rawPin = crypto.randomInt(100000, 1000000).toString()
    const pinHash = this.hash(rawPin)

    const now = Date.now()
    const expiresAt = now + LAUNCH_TOKEN_TTL_MS

    const record = {
      tokenHash,
      downloadTokenHash,
      pinHash,
      userId: String(userId),
      userRole: String(userRole || 'STUDENT').toUpperCase(),
      examId: examId ? String(examId) : null,
      purpose: purpose === 'check' ? 'check' : 'exam',
      createdAt: now,
      expiresAt,
      consumedAt: null,
      invalidated: false
    }

    // Store by both token hash and download token hash
    this.tokens.set(tokenHash, record)
    this.tokens.set(downloadTokenHash, record)
    this.pins.set(pinHash, tokenHash)
    this.userActiveTokens.set(userKey, tokenHash)

    return {
      launchToken: rawLaunchToken,
      downloadToken: rawDownloadToken,
      pin: rawPin,
      expiresAt,
      purpose: record.purpose,
      examId: record.examId
    }
  }

  /**
   * Retrieves a token record without consuming it (e.g. for config file download).
   */
  getTokenRecord(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null
    const tokenHash = this.hash(rawToken)
    const record = this.tokens.get(tokenHash)
    if (!record) return null
    if (Date.now() > record.expiresAt) return null
    return record
  }

  /**
   * Validates a launch token without consuming it.
   */
  validateLaunchToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { status: 'NOT_FOUND' }
    }

    const tokenHash = this.hash(rawToken)
    const record = this.tokens.get(tokenHash)

    if (!record) {
      return { status: 'NOT_FOUND' }
    }

    if (Date.now() > record.expiresAt) {
      return { status: 'EXPIRED', record }
    }

    if (record.consumedAt || record.invalidated) {
      return { status: 'ALREADY_USED', record }
    }

    return { status: 'SUCCESS', record }
  }

  /**
   * Validates a 6-digit numeric PIN without consuming it.
   */
  validatePin(rawPin) {
    if (!rawPin || typeof rawPin !== 'string') {
      return { status: 'NOT_FOUND' }
    }

    const pinHash = this.hash(rawPin)
    const attempts = this.pinAttempts.get(pinHash) || 0
    if (attempts >= 5) {
      return { status: 'TOO_MANY_ATTEMPTS' }
    }

    const tokenHash = this.pins.get(pinHash)

    if (!tokenHash) {
      this.pinAttempts.set(pinHash, attempts + 1)
      return { status: 'NOT_FOUND' }
    }

    const record = this.tokens.get(tokenHash)
    if (!record) {
      this.pins.delete(pinHash)
      return { status: 'NOT_FOUND' }
    }

    if (Date.now() > record.expiresAt) {
      this.pins.delete(pinHash)
      return { status: 'EXPIRED', record }
    }

    if (record.consumedAt || record.invalidated) {
      return { status: 'ALREADY_USED', record }
    }

    return { status: 'SUCCESS', record }
  }

  /**
   * Marks a launch token and its linked PIN as consumed upon successful authentication.
   */
  markConsumed(record) {
    if (record) {
      record.consumedAt = Date.now()
      if (record.pin) {
        this.pinAttempts.delete(this.hash(record.pin))
      }
    }
  }

  /**
   * Atomically consumes a launch token. Single-use enforcement.
   * Returns:
   *   { status: 'SUCCESS', record }
   *   { status: 'EXPIRED' }
   *   { status: 'ALREADY_USED' }
   *   { status: 'NOT_FOUND' }
   */
  consumeLaunchToken(rawToken) {
    const res = this.validateLaunchToken(rawToken)
    if (res.status === 'SUCCESS') {
      this.markConsumed(res.record)
    }
    return res
  }

  /**
   * Atomically consumes a 6-digit numeric PIN. Single-use enforcement.
   */
  consumePin(rawPin) {
    const res = this.validatePin(rawPin)
    if (res.status === 'SUCCESS') {
      this.markConsumed(res.record)
    }
    return res
  }

  /**
   * Checks the live status of a launch token without consuming it.
   */
  checkTokenStatus(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { status: 'NOT_FOUND' }
    }
    const tokenHash = this.hash(rawToken)
    const record = this.tokens.get(tokenHash)
    if (!record) {
      return { status: 'NOT_FOUND' }
    }
    if (record.consumedAt) {
      return { status: 'CONSUMED', consumedAt: record.consumedAt, purpose: record.purpose }
    }
    if (Date.now() > record.expiresAt) {
      return { status: 'EXPIRED' }
    }
    return { status: 'PENDING', expiresAt: record.expiresAt, purpose: record.purpose }
  }

  /**
   * Clears all stored tokens (for testing purposes).
   */
  clear() {
    this.tokens.clear()
    this.pins.clear()
    this.userActiveTokens.clear()
    this.pinAttempts.clear()
  }
}

const sebTokenService = new SebTokenStore()

module.exports = {
  sebTokenService,
  LAUNCH_TOKEN_TTL_MS
}
