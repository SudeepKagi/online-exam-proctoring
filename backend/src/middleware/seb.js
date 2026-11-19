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
      redisClient.client.set(`seb:verified:${attemptId}`, '1', 'EX', 14400).catch(() => { })
    }
  } catch (_) { }
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
  } catch (_) { }

  return false
}

// Deprecated session bypass functions: HTTP route gating strictly requires valid header on that very request
function markUserSebVerified() {}
async function isUserSebVerified() { return false }

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
    return {
      sebRequired: cached.sebRequired,
      sebConfigKey: cached.sebConfigKey,
      effectiveMode: cached.effectiveMode,
      configured: cached.configured
    }
  }

  // Cache miss or expired: fetch from DB via examService
  const { examService } = require('../modules/exams/exams.service')
  const settings = await examService.getSebSettings(examId)
  examSettingsCache.set(key, {
    sebRequired: Boolean(settings.sebRequired),
    sebConfigKey: settings.sebConfigKey || null,
    effectiveMode: settings.effectiveMode || 'off',
    configured: Boolean(settings.configured),
    expiresAt: now + EXAM_SETTINGS_TTL_MS
  })

  return settings
}

// Resolve examId from request
async function resolveExamId(req) {
  if (req.params?.examId) return req.params.examId
  if (req.params?.id && (req.baseUrl || '').includes('exams')) return req.params.id
  if (req.body?.examId) return req.body.examId
  if (req.query?.examId) return req.query.examId

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

async function inspectSebRequest(req) {
  let examId = null
  try {
    examId = await resolveExamId(req)
  } catch (_) { }

  let sebSettings = null
  if (examId) {
    try {
      sebSettings = await getCachedSebSettings(examId)
    } catch (_) { }
  }

  const sebMode = (sebSettings?.effectiveMode || config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()

  if (!examId) {
    return {
      examId: null,
      required: false,
      mode: sebMode,
      verified: false,
      matched: false
    }
  }

  const required = Boolean(sebSettings?.sebRequired)
  if (!required) {
    return {
      examId,
      required: false,
      mode: sebMode,
      verified: false,
      matched: false
    }
  }

  const sebConfigKey = sebSettings?.sebConfigKey
  if (!sebConfigKey || !/^[0-9a-fA-F]{64}$/.test(sebConfigKey)) {
    return {
      examId,
      required: true,
      mode: sebMode,
      verified: false,
      matched: false,
      missingConfigKey: true
    }
  }

  const cleanPublicOrigin = config.publicOrigin || 'http://localhost:5000'
  const rawPath = (req.originalUrl || req.url || '').split('#')[0]
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const canonicalUrl = `${cleanPublicOrigin}${normalizedPath}`

  const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
  const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim() : ''
  const is64Hex = /^[0-9a-fA-F]{64}$/.test(receivedHeader)

  const activeKey = sebConfigKey.toLowerCase()
  const expectedHash = crypto.createHash('sha256').update(canonicalUrl + activeKey).digest('hex').toLowerCase()

  let headerMatched = false
  if (is64Hex) {
    const receivedBuf = Buffer.from(receivedHeader.toLowerCase(), 'utf8')
    const expectedBuf = Buffer.from(expectedHash, 'utf8')
    if (receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
      headerMatched = true
    }
  }

  // Passing the gate on HTTP routes strictly requires a valid header on that very request
  const isVerified = headerMatched

  // Only if header verification passed, track attempt for Socket.IO join
  const attemptId = req.params?.attemptId || req.params?.id
  if (headerMatched && attemptId) {
    markAttemptSebVerified(attemptId)
  }

  return {
    examId,
    required: true,
    sebRequired: true,
    mode: sebMode,
    verified: isVerified,
    matched: isVerified,
    headerMatched,
    expectedUrl: canonicalUrl,
    expectedHash,
    receivedHeader
  }
}

async function verifySebNonBlocking(req, res, next) {
  try {
    const inspection = await inspectSebRequest(req)
    req.seb = {
      required: inspection.required,
      sebRequired: Boolean(inspection.required),
      mode: inspection.mode,
      verified: inspection.verified,
      examId: inspection.examId
    }

    if (inspection.matched && inspection.examId) {
      const attemptId = req.params?.attemptId || req.params?.id
      if (attemptId) {
        markAttemptSebVerified(attemptId)
      }
    }
  } catch (err) {
    const sebMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()
    req.seb = {
      required: false,
      sebRequired: false,
      mode: sebMode,
      verified: false,
      error: err.message
    }
  }
  return next()
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
    req.seb = { mode: sebMode, verified: false, sebRequired: true, error: err.message }
    return next()
  })
}

async function runVerifySeb(req, res, next) {
  // 1. Non-STUDENT roles: pass through
  const userRole = normalizeRole(req.user?.role)
  if (!userRole || userRole !== ROLES.STUDENT) {
    const rawMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()
    req.seb = { mode: rawMode, verified: true, sebRequired: false, roleBypass: true }
    return next()
  }

  const inspection = await inspectSebRequest(req)
  req.seb = {
    required: inspection.required,
    sebRequired: Boolean(inspection.required),
    mode: inspection.mode,
    verified: inspection.verified,
    examId: inspection.examId
  }

  // If exam requires SEB and key is missing while enforce mode is requested or active, reject with 503
  const intendedMode = (process.env.SEB_MODE || config.sebMode || inspection.mode || 'off').toLowerCase().trim()
  if (inspection.required && inspection.missingConfigKey && (intendedMode === 'enforce' || inspection.mode === 'enforce')) {
    logger.warn({ examId: inspection.examId }, 'SEB verification failed: missing institution configuration key')
    return res.status(503).json({
      code: 'INSTITUTION_NOT_CONFIGURED',
      message: 'Safe Exam Browser institution configuration is not configured.'
    })
  }

  if (!inspection.required || inspection.mode === 'off') {
    req.seb.verified = true
    return next()
  }

  if (inspection.mode === 'log' || inspection.mode === 'audit') {
    const { isNonProductionDatabase } = require('../infra/postgres/assertNonProduction')
    const dbUrl = process.env.DATABASE_URL || config.databaseUrl || ''
    const isTestHost = isNonProductionDatabase(dbUrl)
    const isProd = process.env.NODE_ENV === 'production' || config.nodeEnv === 'production' || Boolean(config.isProd)
    const isDebugRequested = process.env.SEB_DEBUG_LOG_HASHES === 'true' || Boolean(config.sebDebugLogHashes)
    const allowFullDebugHashes = isDebugRequested && !isProd && isTestHost

    const logPayload = {
      examId: inspection.examId,
      matched: inspection.matched,
      receivedPrefix8: inspection.receivedHeader ? inspection.receivedHeader.slice(0, 8) : null,
      expectedPrefix8: inspection.expectedHash ? inspection.expectedHash.slice(0, 8) : null,
      urlHashed: inspection.expectedUrl
    }

    if (allowFullDebugHashes) {
      logPayload.expectedHash = inspection.expectedHash
      logPayload.receivedHash = inspection.receivedHeader || null
    }

    logger.info(logPayload, 'SEB request verification check (audit/log mode)')
    const attemptId = req.params?.attemptId || req.params?.id
    if (inspection.matched && attemptId) {
      markAttemptSebVerified(attemptId)
    }
    return next()
  }

  // Enforce mode: requires cryptographic header match
  if (inspection.missingConfigKey) {
    logger.warn({ examId: inspection.examId }, 'SEB verification failed: missing institution configuration key')
    return res.status(503).json({
      code: 'INSTITUTION_NOT_CONFIGURED',
      message: 'Safe Exam Browser institution configuration is not configured.'
    })
  }

  if (inspection.headerMatched) {
    const attemptId = req.params?.attemptId || req.params?.id
    if (attemptId) {
      markAttemptSebVerified(attemptId)
    }
    return next()
  }

  const requestId = req.headers['x-request-id'] || req.id || crypto.randomUUID().slice(0, 8)
  const isHeaderPresent = Boolean(inspection.receivedHeader && inspection.receivedHeader.trim().length > 0)
  const code = !isHeaderPresent ? 'SEB_HEADER_MISSING' : 'SEB_HEADER_MISMATCH'

  logger.warn({
    examId: inspection.examId,
    code,
    receivedPrefix8: inspection.receivedHeader ? inspection.receivedHeader.slice(0, 8) : null,
    urlHashed: inspection.expectedUrl
  }, 'SEB request verification failed (enforce mode 403)')

  return res.status(403).json({
    code,
    message: isHeaderPresent
      ? 'Safe Exam Browser configuration check failed. Configuration Key header mismatch.'
      : 'Access restricted to verified Safe Exam Browser sessions. Configuration header is missing.',
    requestId
  })
}

module.exports = {
  verifySeb,
  verifySebNonBlocking,
  inspectSebRequest,
  markAttemptSebVerified,
  isAttemptSebVerified,
  markUserSebVerified,
  isUserSebVerified,
  invalidateExamSebCache,
  clearAllSebCaches,
  getCachedSebSettings,
  resolveExamId,
  attemptExamLru,
  BoundedLru,
  examSettingsCache
}
