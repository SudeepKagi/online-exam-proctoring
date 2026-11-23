'use strict'

const crypto = require('crypto')

// Token TTL: 5 minutes
const LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000
// Replay tolerance: allows reloads or duplicate requests in the first 60 seconds without stranding the student
const REPLAY_GRACE_WINDOW_MS = 60 * 1000

/**
 * Stateful Launch Token Store with automatic expiration and replay tolerance.
 */
class SebTokenStore {
  constructor() {
    // Map of tokenHash -> TokenRecord
    this.tokens = new Map()
    // Map of `${userId}:${examId || 'check'}` -> tokenHash (for invalidating older tokens)
    this.userActiveTokens = new Map()

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
   * Generates a new 32-byte launch token and download token.
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
    }

    // 32-byte cryptographically secure random token (64 hex chars)
    const rawLaunchToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hash(rawLaunchToken)

    // Dedicated download token (32 bytes) or same token hash
    const rawDownloadToken = crypto.randomBytes(32).toString('hex')
    const downloadTokenHash = this.hash(rawDownloadToken)

    const now = Date.now()
    const expiresAt = now + LAUNCH_TOKEN_TTL_MS
    const correlationId = tokenHash.slice(0, 12)

    const record = {
      correlationId,
      tokenHash,
      downloadTokenHash,
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
    this.userActiveTokens.set(userKey, tokenHash)

    return {
      correlationId,
      launchToken: rawLaunchToken,
      downloadToken: rawDownloadToken,
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
   * Validates a launch token.
   * Tolerates duplicate requests or browser reloads within REPLAY_GRACE_WINDOW_MS
   * of the initial consumption so candidates are not stranded.
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

    if (record.invalidated) {
      return { status: 'ALREADY_USED', record }
    }

    if (record.consumedAt) {
      const elapsed = Date.now() - record.consumedAt
      if (elapsed <= REPLAY_GRACE_WINDOW_MS) {
        return { status: 'SUCCESS', record, isReplay: true }
      }
      return { status: 'ALREADY_USED', record }
    }

    return { status: 'SUCCESS', record, isReplay: false }
  }

  /**
   * Marks a launch token as consumed upon successful authentication.
   */
  markConsumed(record) {
    if (record && !record.consumedAt) {
      record.consumedAt = Date.now()
    }
  }

  /**
   * Atomically consumes a launch token.
   */
  consumeLaunchToken(rawToken) {
    const res = this.validateLaunchToken(rawToken)
    if (res.status === 'SUCCESS' && !res.isReplay) {
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
    this.userActiveTokens.clear()
  }
}

const sebTokenService = new SebTokenStore()

module.exports = {
  sebTokenService,
  LAUNCH_TOKEN_TTL_MS,
  REPLAY_GRACE_WINDOW_MS
}
