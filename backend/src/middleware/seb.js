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

// Safe Exam Browser institution starter configuration key (proctornet-starter.seb)
const STARTER_CONFIG_KEY = '4b04249c796a0391b8e1e148662f9520b2efd08c3cb498c56245d747b11baf7a'

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

// ── In-Process & Redis Verified User Session Flag ───────────────────────────
// Tracks users whose session was verified via Safe Exam Browser launch/PIN exchange
const verifiedUsersInMemory = new Map() // `${userId}:${examId}` -> expiresAt

function markUserSebVerified(userId, examId) {
  if (!userId || !examId) return
  const idStr = `${String(userId)}:${String(examId)}`
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000 // 4 hours
  verifiedUsersInMemory.set(idStr, expiresAt)

  try {
    const { redisClient } = require('../infra/redis/client')
    if (redisClient?.client && redisClient.client.status === 'ready') {
      redisClient.client.set(`seb:user_verified:${idStr}`, '1', 'EX', 14400).catch(() => { })
    }
  } catch (_) { }
}

async function isUserSebVerified(userId, examId) {
  if (!userId || !examId) return false
  const idStr = `${String(userId)}:${String(examId)}`
  const exp = verifiedUsersInMemory.get(idStr)
  if (exp && exp > Date.now()) return true

  try {
    const { redisClient } = require('../infra/redis/client')
    if (redisClient?.client && redisClient.client.status === 'ready') {
      const val = await redisClient.client.get(`seb:user_verified:${idStr}`)
      if (val === '1') {
        verifiedUsersInMemory.set(idStr, Date.now() + 4 * 60 * 60 * 1000)
        return true
      }
    }
  } catch (_) { }

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
  verifiedUsersInMemory.clear()
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
  const expectedUrl = `${cleanPublicOrigin}${normalizedPath}`

  const rawHeader = req.headers['x-safeexambrowser-configkeyhash']
  const receivedHeader = typeof rawHeader === 'string' ? rawHeader.trim() : ''
  const is64Hex = /^[0-9a-fA-F]{64}$/.test(receivedHeader)

  const candidateKeys = new Set()
  if (sebConfigKey && /^[0-9a-fA-F]{64}$/.test(sebConfigKey)) {
    candidateKeys.add(sebConfigKey.toLowerCase())
  }
  if (process.env.SEB_CONFIG_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.SEB_CONFIG_KEY)) {
    candidateKeys.add(process.env.SEB_CONFIG_KEY.trim().toLowerCase())
  }
  // Institution starter key calculated by Safe Exam Browser for proctornet-starter.seb
  candidateKeys.add(STARTER_CONFIG_KEY.toLowerCase())

  const primaryKey = (sebConfigKey && /^[0-9a-fA-F]{64}$/.test(sebConfigKey)) ? sebConfigKey.toLowerCase() : STARTER_CONFIG_KEY.toLowerCase()
  const expectedHash = crypto.createHash('sha256').update(expectedUrl + primaryKey).digest('hex').toLowerCase()

  let directKeyMatched = false

  // 1. Direct JS API Key Match
  const clientKey = (req.body?.configKey || req.headers['x-seb-config-key'] || '').toString().trim().toLowerCase()
  if (/^[0-9a-f]{64}$/.test(clientKey)) {
    const clientBuf = Buffer.from(clientKey, 'utf8')
    for (const candKey of candidateKeys) {
      const activeBuf = Buffer.from(candKey, 'utf8')
      if (activeBuf.length === clientBuf.length && crypto.timingSafeEqual(activeBuf, clientBuf)) {
        directKeyMatched = true
        break
      }
    }
  }

  // 2. Candidate URL Header Hash Match
  let headerMatched = directKeyMatched
  if (!headerMatched && is64Hex) {
    const rawReferer = (req.headers.referer || req.headers.referrer || '').split('#')[0]
    const clientHref = (req.body?.href || req.query?.href || '').split('#')[0]

    const candidateUrls = new Set([
      expectedUrl,
      expectedUrl.replace(/\/$/, ''),
      `${cleanPublicOrigin}:443${normalizedPath}`,
      `${cleanPublicOrigin}/student/login`,
      `${cleanPublicOrigin}/student/login/`,
      `${cleanPublicOrigin}/login`,
      `${cleanPublicOrigin}/login/`,
      `${cleanPublicOrigin}/seb/enter`,
      `${cleanPublicOrigin}/seb/enter/`,
      `${cleanPublicOrigin}/student/exams/${examId}/start`,
      `${cleanPublicOrigin}/student/exams/${examId}/pre-check`,
      `${cleanPublicOrigin}/student/exams/${examId}`,
      `${cleanPublicOrigin}/`,
      cleanPublicOrigin
    ])
    if (rawReferer) {
      candidateUrls.add(rawReferer)
      candidateUrls.add(rawReferer.replace(/\/$/, ''))
    }
    if (clientHref) {
      candidateUrls.add(clientHref)
      candidateUrls.add(clientHref.replace(/\/$/, ''))
    }

    const receivedBuf = Buffer.from(receivedHeader.toLowerCase(), 'utf8')

    for (const candKey of candidateKeys) {
      for (const candUrl of candidateUrls) {
        const hashA = crypto.createHash('sha256').update(candUrl + candKey).digest('hex').toLowerCase()
        const bufA = Buffer.from(hashA, 'utf8')
        if (bufA.length === receivedBuf.length && crypto.timingSafeEqual(bufA, receivedBuf)) {
          headerMatched = true
          break
        }
      }
      if (headerMatched) break
    }
  }

  // 3. Attempt & User verification stickiness
  const attemptId = req.params?.attemptId || req.params?.id
  const userId = req.user?.id
  let sessionMatched = false
  if (!headerMatched) {
    if (attemptId && (await isAttemptSebVerified(attemptId))) {
      sessionMatched = true
    } else if (userId && examId && (await isUserSebVerified(userId, examId))) {
      sessionMatched = true
    }
  }

  const isVerified = Boolean(headerMatched || sessionMatched)

  if (headerMatched) {
    if (attemptId) markAttemptSebVerified(attemptId)
    if (userId && examId) markUserSebVerified(userId, examId)
  }

  return {
    examId,
    required: true,
    sebRequired: true,
    mode: sebMode,
    verified: isVerified,
    matched: isVerified,
    headerMatched,
    expectedUrl,
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
  const sebMode = (config.sebMode || process.env.SEB_MODE || 'off').toLowerCase().trim()

  // 1. If SEB_MODE=off: pass through
  if (sebMode === 'off') {
    req.seb = { mode: 'off', verified: false, sebRequired: false }
    return next()
  }

  // 2. Non-STUDENT roles: pass through
  const userRole = normalizeRole(req.user?.role)
  if (!userRole || userRole !== ROLES.STUDENT) {
    req.seb = { mode: sebMode, verified: true, sebRequired: false, roleBypass: true }
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
  if (inspection.headerMatched) {
    const attemptId = req.params?.attemptId || req.params?.id
    if (attemptId) {
      markAttemptSebVerified(attemptId)
    }
    return next()
  }

  logger.warn({
    examId: inspection.examId,
    receivedPrefix8: inspection.receivedHeader ? inspection.receivedHeader.slice(0, 8) : null,
    urlHashed: inspection.expectedUrl
  }, 'SEB request verification failed (enforce mode 403)')

  return res.status(403).json({
    code: 'SEB_REQUIRED',
    message: 'Access denied: Safe Exam Browser verification required.'
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
  STARTER_CONFIG_KEY,
  invalidateExamSebCache,
  clearAllSebCaches,
  getCachedSebSettings,
  resolveExamId,
  attemptExamLru,
  BoundedLru,
  examSettingsCache
}
