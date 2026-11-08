'use strict'

const crypto = require('crypto')
const config = require('../shared/config')
const { ROLES, normalizeRole } = require('../shared/roles')
const { logger } = require('../shared/logging')
const { prisma } = require('../infra/postgres/client')

// ── In-Process Memory Caches (Key Never Goes to Redis) ──────────────────────
const EXAM_SETTINGS_TTL_MS = 60 * 1000 // 60s TTL
const MAX_ATTEMPT_LRU_SIZE = 5000

// Map: examId -> { sebRequired: boolean, sebConfigKey: string | null, expiresAt: number }
const examSettingsCache = new Map()

// Bounded LRU Map: attemptId -> examId
class BoundedLru {
  constructor(maxSize = MAX_ATTEMPT_LRU_SIZE) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return undefined
    const val = this.cache.get(key)
    // Refresh access order
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) this.cache.delete(oldestKey)
    }
    this.cache.set(key, value)
  }

  has(key) {
    return this.cache.has(key)
  }

  clear() {
    this.cache.clear()
  }
}

const attemptExamLru = new BoundedLru(MAX_ATTEMPT_LRU_SIZE)

// ── In-Process & Redis Verified Attempt Flag ────────────────────────────────
// Tracks attempts that have passed SEB verification
const verifiedAttemptsInMemory = new Map() // attemptId -> expiresAt

function markAttemptSebVerified(attemptId) {
  if (!attemptId) return
  // Keep verified for 4 hours
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000
  verifiedAttemptsInMemory.set(String(attemptId), expiresAt)

  // Also set in Redis if available (flag only, no secrets)
  try {
    const { redisClient } = require('../infra/redis/client')
    if (redisClient?.client && redisClient.client.status === 'ready') {
      redisClient.client.set(`seb:verified:${attemptId}`, '1', 'EX', 14400).catch(() => {})
    }
  } catch (_) {}
}

async function isAttemptSebVerified(attemptId) {
  if (!attemptId) return false
  const idStr = String(attemptId)
  const exp = verifiedAttemptsInMemory.get(idStr)
  if (exp && exp > Date.now()) return true

  // Fallback check Redis
  try {
    const { redisClient } = require('../infra/redis/client')
    if (redisClient?.client && redisClient.client.status === 'ready') {
      const val = await redisClient.client.get(`seb:verified:${idStr}`)
      if (val === '1') {
        verifiedAttemptsInMemory.set(idStr, Date.now() + 4 * 60 * 60 * 1000)
        return true
      }
    }
  } catch (_) {}

  return false
}

// Invalidation Helper
function invalidateExamSebCache(examId) {
  if (!examId) return
  examSettingsCache.delete(String(examId))
}

function clearAllSebCaches() {
  examSettingsCache.clear()
  attemptExamLru.clear()
  verifiedAttemptsInMemory.clear()
}

// Fetch exam SEB settings with 60s in-process TTL and DB fallback
async function getCachedSebSettings(examId) {
  const now = Date.now()
  const key = String(examId)
  const cached = examSettingsCache.get(key)
  if (cached && cached.expiresAt > now) {
    return { sebRequired: cached.sebRequired, sebConfigKey: cached.sebConfigKey }
  }

  // Cache miss or expired: fetch from DB via examService
  const { examService } = require('../modules/exams/exams.service')
  const settings = await examService.getSebSettings(examId)
  examSettingsCache.set(key, {
    sebRequired: Boolean(settings.sebRequired),
    sebConfigKey: settings.sebConfigKey || null,
    expiresAt: now + EXAM_SETTINGS_TTL_MS
  })

  return settings
}

// Resolve examId from request
async function resolveExamId(req) {
  if (req.params?.examId) return req.params.examId
  if (req.body?.examId) return req.body.examId

  const attemptId = req.params?.attemptId || req.params?.id
  if (attemptId) {
    const cachedExamId = attemptExamLru.get(attemptId)
    if (cachedExamId) return cachedExamId

    // DB fallback
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { examId: true }
    })
    if (attempt?.examId) {
      attemptExamLru.set(attemptId, attempt.examId)
      return attempt.examId
    }
  }

  return null
}

function verifySeb(req, res, next) {
  runVerifySeb(req, res, next).catch((err) => {
    const sebMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()
    logger.error({ error: err.message }, 'Unexpected error in SEB verification middleware')
    if (sebMode === 'enforce') {
      // In enforce mode, never fail open on errors
      return res.status(403).json({
        code: 'SEB_REQUIRED',
        message: 'Safe Exam Browser verification failed due to internal error.'
      })
    }
    req.seb = { mode: sebMode, verified: false, error: err.message }
    return next()
  })
}

async function runVerifySeb(req, res, next) {
  const sebMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()

  // 1. If SEB_MODE=off: pass through
  if (sebMode === 'off') {
    req.seb = { mode: 'off', verified: false }
    return next()
  }

  // 2. Non-STUDENT roles: pass through
  const userRole = normalizeRole(req.user?.role)
  if (!userRole || userRole !== ROLES.STUDENT) {
    req.seb = { mode: sebMode, verified: true, roleBypass: true }
    return next()
  }

  // 3. Resolve the exam
  let examId
  try {
    examId = await resolveExamId(req)
  } catch (err) {
    if (sebMode === 'enforce') {
      return res.status(403).json({
        code: 'SEB_REQUIRED',
        message: 'Unable to resolve exam for Safe Exam Browser verification.'
      })
    }
    req.seb = { mode: 'log', verified: false }
    return next()
  }

  if (!examId) {
    // If no exam can be resolved on this route
    if (sebMode === 'enforce') {
      return res.status(403).json({
        code: 'SEB_REQUIRED',
        message: 'Exam context missing for Safe Exam Browser verification.'
      })
    }
    req.seb = { mode: 'log', verified: false }
    return next()
  }

  // 4. Get settings via getSebSettings (cached)
  let sebSettings
  try {
    sebSettings = await getCachedSebSettings(examId)
  } catch (err) {
    if (sebMode === 'enforce') {
      return res.status(403).json({
        code: 'SEB_REQUIRED',
        message: 'Failed to retrieve exam Safe Exam Browser settings.'
      })
    }
    req.seb = { mode: 'log', verified: false }
    return next()
  }

  // If sebRequired is false, pass through
  if (!sebSettings.sebRequired) {
    req.seb = { mode: sebMode, verified: true, sebRequired: false }
    return next()
  }

  // 5. Config Key is required for SEB verification
  const sebConfigKey = sebSettings.sebConfigKey
  if (!sebConfigKey || !/^[0-9a-fA-F]{64}$/.test(sebConfigKey)) {
    if (sebMode === 'enforce') {
      return res.status(403).json({
        code: 'SEB_REQUIRED',
        message: 'Exam requires Safe Exam Browser but no valid Config Key is configured.'
      })
    }
    req.seb = { mode: 'log', verified: false, missingConfigKey: true }
    return next()
  }

  // 6. Expected URL = PUBLIC_ORIGIN + req.originalUrl (strip fragment)
  const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
  const rawPath = (req.originalUrl || req.url || '').split('#')[0]
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const expectedUrl = `${cleanPublicOrigin}${normalizedPath}`

  // 7. Read X-SafeExamBrowser-ConfigKeyHash
  const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
  const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim() : ''

  // Reject anything that is not 64 hex
  const is64Hex = /^[0-9a-fA-F]{64}$/.test(receivedHeader)

  // Compute expected hash: sha256_hex(expectedUrl + sebConfigKey)
  const expectedHash = crypto
    .createHash('sha256')
    .update(expectedUrl + sebConfigKey.toLowerCase())
    .digest('hex')
    .toLowerCase()

  let matched = false
  if (is64Hex) {
    const expectedBuf = Buffer.from(expectedHash, 'utf8')
    const receivedBuf = Buffer.from(receivedHeader.toLowerCase(), 'utf8')
    matched = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)
  }

  // 8. Logging
  const isTestDb = (process.env.DATABASE_URL || '').includes('_test')
  const allowFullDebugHashes =
    process.env.SEB_DEBUG_LOG_HASHES === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    !config.isProd &&
    isTestDb

  const logPayload = {
    examId,
    matched,
    receivedPrefix8: receivedHeader ? receivedHeader.slice(0, 8) : null,
    expectedPrefix8: expectedHash.slice(0, 8),
    urlHashed: expectedUrl
  }

  if (allowFullDebugHashes) {
    logPayload.expectedHash = expectedHash
    logPayload.receivedHash = receivedHeader || null
  }

  if (sebMode === 'log') {
    logger.info(logPayload, 'SEB request verification check (log mode)')
    req.seb = { mode: 'log', verified: Boolean(matched) }
    const attemptId = req.params?.attemptId || req.params?.id
    if (matched && attemptId) {
      markAttemptSebVerified(attemptId)
    }
    return next()
  }

  // 9. Enforce mode
  if (matched) {
    req.seb = { mode: 'enforce', verified: true }
    const attemptId = req.params?.attemptId || req.params?.id
    if (attemptId) {
      markAttemptSebVerified(attemptId)
    }
    return next()
  } else {
    logger.warn(logPayload, 'SEB request verification failed (enforce mode 403)')
    req.seb = { mode: 'enforce', verified: false }
    return res.status(403).json({
      code: 'SEB_REQUIRED',
      message: 'Access denied: Safe Exam Browser verification required.'
    })
  }
}

module.exports = {
  verifySeb,
  markAttemptSebVerified,
  isAttemptSebVerified,
  invalidateExamSebCache,
  clearAllSebCaches,
  getCachedSebSettings,
  resolveExamId,
  attemptExamLru,
  BoundedLru
}
