/**
 * presence.js
 * Non-authoritative candidate presence tracking backed by Redis hash with in-memory fallback.
 * Heartbeat every 15s -> offline if > 45s; disconnect handler marks offline immediately.
 */

const { redisClient } = require('../redis/client')
const { logger } = require('../../shared/logging')

const HEARTBEAT_TIMEOUT_MS = 45 * 1000 // 45 seconds

// In-memory fallback if Redis is unavailable
const memoryPresence = new Map() // examId -> Map(studentId -> epochMs)

class PresenceManager {
  _getRedisKey(examId) {
    return `pn:presence:${examId}`
  }

  /**
   * Record a candidate heartbeat
   */
  async recordHeartbeat(examId, studentId) {
    const now = Date.now()

    if (redisClient.client && redisClient.isReady) {
      try {
        await redisClient.client.hset(this._getRedisKey(examId), studentId, String(now))
      } catch (err) {
        logger.warn({ error: err.message, examId, studentId }, 'Redis heartbeat update failed, falling back to memory')
      }
    }

    // Keep memory cache updated as secondary
    if (!memoryPresence.has(examId)) {
      memoryPresence.set(examId, new Map())
    }
    memoryPresence.get(examId).set(studentId, now)

    return {
      studentId,
      lastHeartbeatAt: new Date(now).toISOString(),
      online: true
    }
  }

  /**
   * Check if a candidate is currently online (heartbeat within 45s)
   */
  async isOnline(examId, studentId, thresholdMs = HEARTBEAT_TIMEOUT_MS) {
    const now = Date.now()

    if (redisClient.client && redisClient.isReady) {
      try {
        const tsStr = await redisClient.client.hget(this._getRedisKey(examId), studentId)
        if (tsStr) {
          const ts = parseInt(tsStr, 10)
          return (now - ts) <= thresholdMs
        }
      } catch (err) {
        logger.warn({ error: err.message, examId, studentId }, 'Redis presence check failed')
      }
    }

    // Fallback to memory
    const examMap = memoryPresence.get(examId)
    if (examMap && examMap.has(studentId)) {
      const ts = examMap.get(studentId)
      return (now - ts) <= thresholdMs
    }

    return false
  }

  /**
   * Get all online student IDs for an exam
   */
  async getOnlineStudentIds(examId, thresholdMs = HEARTBEAT_TIMEOUT_MS) {
    const now = Date.now()
    const onlineIds = []

    if (redisClient.client && redisClient.isReady) {
      try {
        const all = await redisClient.client.hgetall(this._getRedisKey(examId))
        if (all) {
          for (const [studentId, tsStr] of Object.entries(all)) {
            const ts = parseInt(tsStr, 10)
            if (now - ts <= thresholdMs) {
              onlineIds.push(studentId)
            }
          }
          return onlineIds
        }
      } catch (err) {
        logger.warn({ error: err.message, examId }, 'Redis getOnlineStudentIds failed')
      }
    }

    const examMap = memoryPresence.get(examId)
    if (examMap) {
      for (const [studentId, ts] of examMap.entries()) {
        if (now - ts <= thresholdMs) {
          onlineIds.push(studentId)
        }
      }
    }

    return onlineIds
  }

  /**
   * Get count of online students for an exam summary
   */
  async getOnlineCount(examId, thresholdMs = HEARTBEAT_TIMEOUT_MS) {
    const onlineIds = await this.getOnlineStudentIds(examId, thresholdMs)
    return onlineIds.length
  }

  /**
   * Mark candidate offline immediately on socket disconnect
   */
  async markOffline(examId, studentId) {
    if (redisClient.client && redisClient.isReady) {
      try {
        await redisClient.client.hset(this._getRedisKey(examId), studentId, '0')
      } catch (err) {
        logger.warn({ error: err.message, examId, studentId }, 'Redis markOffline failed')
      }
    }

    const examMap = memoryPresence.get(examId)
    if (examMap) {
      examMap.set(studentId, 0)
    }

    return {
      studentId,
      lastHeartbeatAt: new Date().toISOString(),
      online: false
    }
  }

  /**
   * Clear presence hash for an exam
   */
  async clearExamPresence(examId) {
    if (redisClient.client && redisClient.isReady) {
      try {
        await redisClient.client.del(this._getRedisKey(examId))
      } catch (err) {
        // ignore
      }
    }
    memoryPresence.delete(examId)
  }
}

const presenceManager = new PresenceManager()

module.exports = {
  presenceManager,
  HEARTBEAT_TIMEOUT_MS
}
