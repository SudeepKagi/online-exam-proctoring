const { prisma } = require('../../infra/postgres/client')
const { redisClient } = require('../../infra/redis/client')
const { CANONICAL_SEVERITY, FLAG_COOLDOWNS } = require('./constants')
const { violationMicroBatcher } = require('./violationMicroBatcher')
const { chatMicroBatcher } = require('./chatMicroBatcher')
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError
} = require('../../shared/errors')
const { logger } = require('../../shared/logging')

// In-memory fallback cooldown tracker if Redis is down
const inMemoryCooldowns = new Map()

class ProctoringService {
  /**
   * Record a violation event with Redis cooldown, server-side severity, and micro-batching
   */
  async recordViolation(attemptId, studentId, eventType, metadata = {}, clientTimestamp = null) {
    // 1. Authoritative check: ownership & ACTIVE status in SQL
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, exam_id, status, expires_at
      FROM exam_attempts
      WHERE id = $1::uuid AND student_id = $2::uuid;
    `, attemptId, studentId)

    if (!rows || rows.length === 0) {
      throw new NotFoundError(`Attempt '${attemptId}' not found or access denied`)
    }

    const attempt = rows[0]
    if (attempt.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot record violation on attempt in state '${attempt.status}'`)
    }

    // 2. Cooldown check: Redis SET NX PX
    const cooldownMs = FLAG_COOLDOWNS[eventType] || FLAG_COOLDOWNS.DEFAULT
    const cooldownKey = `pn:v1:cooldown:${attemptId}:${eventType}`
    let isCooledDown = false

    if (redisClient.client && redisClient.isReady) {
      try {
        const res = await redisClient.client.set(cooldownKey, '1', 'PX', cooldownMs, 'NX')
        isCooledDown = (res === 'OK')
      } catch (err) {
        logger.warn({ error: err.message }, 'Redis cooldown check failed, falling back to memory')
      }
    }

    if (!isCooledDown && (!redisClient.client || !redisClient.isReady)) {
      // Memory fallback
      const now = Date.now()
      const lastTime = inMemoryCooldowns.get(cooldownKey) || 0
      if (now - lastTime >= cooldownMs) {
        inMemoryCooldowns.set(cooldownKey, now)
        isCooledDown = true
      }
    }

    if (!isCooledDown) {
      return {
        recorded: false,
        cooldownActive: true,
        message: 'Violation suppressed due to active cooldown window'
      }
    }

    // 3. Server severity assignment (Never trust client severity)
    const severity = CANONICAL_SEVERITY[eventType] || 'MEDIUM'

    // 4. Push to micro-batcher
    await violationMicroBatcher.queue({
      attemptId,
      eventType,
      severity,
      metadata,
      clientTimestamp
    })

    return {
      recorded: true,
      eventType,
      severity
    }
  }

  /**
   * Post a chat message through micro-batcher with rate limiting (1 msg / 2 s)
   */
  async postChatMessage(examId, senderId, senderRole, message, studentIdParam = null) {
    const studentId = senderRole === 'STUDENT' ? senderId : (studentIdParam || senderId)

    // Rate limit check: 1 per 2 seconds
    const rateLimitKey = `pn:v1:chat_limit:${senderId}`
    if (redisClient.client && redisClient.isReady) {
      const allowed = await redisClient.client.set(rateLimitKey, '1', 'PX', 2000, 'NX')
      if (!allowed) {
        throw new TooManyRequestsError('Chat rate limit exceeded. Please wait 2 seconds.', 2)
      }
    }

    return chatMicroBatcher.queue({
      examId,
      studentId,
      senderRole,
      message
    })
  }

  /**
   * Fetch chat history paginated by ID
   */
  async getChatHistory(examId, studentId, limit = 50, beforeId = null) {
    const where = { examId, studentId }
    if (beforeId) {
      where.id = { lt: BigInt(beforeId) }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' }
    })

    return messages.map(m => ({
      id: m.id.toString(),
      examId: m.examId,
      studentId: m.studentId,
      senderRole: m.senderRole,
      message: m.message,
      timestamp: m.timestamp
    }))
  }
}

module.exports = {
  ProctoringService,
  proctoringService: new ProctoringService()
}
