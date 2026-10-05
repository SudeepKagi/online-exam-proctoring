const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible')
const { redis } = require('../infra/redis/client')
const { TooManyRequestsError } = require('../shared/errors')
const { logger } = require('../shared/logging')

function createLimiter(prefix, points, duration) {
  const memoryLimiter = new RateLimiterMemory({
    points,
    duration
  })

  // Try Redis-backed limiter with insuranceLimiter falling back to memory
  let limiter = memoryLimiter
  try {
    if (redis.client) {
      limiter = new RateLimiterRedis({
        storeClient: redis.client,
        keyPrefix: `rl:${prefix}`,
        points,
        duration,
        insuranceLimiter: memoryLimiter
      })
    }
  } catch (err) {
    logger.warn({ prefix, error: err.message }, 'Failed to initialize Redis limiter, using memory')
  }

  return limiter
}

// 1. Dual-tier login limiters (Defect D-05 Fix for 500-student lab start spike)
// Tier 1: Per-IP ceiling >= 600/min (allows NAT lab of 500 students to log in)
const loginIpLimiter = createLimiter('login_ip', 600, 60)
// Tier 2: Per IP + user identifier (USN, email, or invId) 10/min
const loginUserLimiter = createLimiter('login_user', 10, 60)

// 2. Autosave: 60 per minute per attempt (+burst capacity of 20)
const autosaveLimiter = createLimiter('autosave', 80, 60)

// 3. Violations: 30 per minute per attempt
const violationLimiter = createLimiter('violation', 30, 60)

// 4. Presign: 20 per minute per user
const presignLimiter = createLimiter('presign', 20, 60)

// 5. Roster: 60 per minute per invigilator
const rosterLimiter = createLimiter('roster', 60, 60)

// 6. Default: 300 per minute
const defaultLimiter = createLimiter('default', 300, 60)

function shouldBypass() {
  if (process.env.FORCE_RATE_LIMIT === '1') return false
  if (process.env.NODE_ENV === 'test') return true

  // In production, bypass flags are strictly FORBIDDEN
  if (process.env.NODE_ENV === 'production') return false

  return process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1'
}

function rateLimit(limiter, keyGenerator) {
  return async (req, res, next) => {
    if (shouldBypass()) {
      return next()
    }

    const key = keyGenerator(req)
    try {
      await limiter.consume(key)
      next()
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        // Redis connection error handled by insuranceLimiter
        return next()
      }
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
      res.setHeader('Retry-After', String(secs))
      next(new TooManyRequestsError(`Rate limit exceeded, please retry in ${secs}s`, secs))
    }
  }
}

// Route-specific middleware helpers
const limitLogin = async (req, res, next) => {
  if (shouldBypass()) return next()

  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1'
  const identifier = (req.body?.usn || req.body?.identifier || req.body?.email || req.body?.invId || '').toLowerCase().trim()
  const compositeKey = `${ip}:${identifier || 'anonymous'}`
  const ipKey = `ip:${ip}`

  try {
    // 1. Consume per-IP ceiling (>= 600/min)
    await loginIpLimiter.consume(ipKey)
    // 2. Consume per IP + user identifier (10/min)
    await loginUserLimiter.consume(compositeKey)
    next()
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      return next()
    }
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.setHeader('Retry-After', String(secs))
    next(new TooManyRequestsError(`Rate limit exceeded, please retry in ${secs}s`, secs))
  }
}

const limitAutosave = rateLimit(autosaveLimiter, (req) => {
  const attemptId = req.params?.attemptId || req.user?.id || 'unknown'
  return `attempt:${attemptId}`
})

const limitViolation = rateLimit(violationLimiter, (req) => {
  const attemptId = req.params?.attemptId || req.user?.id || 'unknown'
  return `violation:${attemptId}`
})

const limitPresign = rateLimit(presignLimiter, (req) => {
  const userId = req.user?.id || req.ip || 'unknown'
  return `presign:${userId}`
})

const limitRoster = rateLimit(rosterLimiter, (req) => {
  const userId = req.user?.id || req.ip || 'unknown'
  return `roster:${userId}`
})

const limitDefault = rateLimit(defaultLimiter, (req) => {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || '127.0.0.1'}`
})

const routeRateLimiters = {
  login: limitLogin,
  autosave: limitAutosave,
  violations: limitViolation,
  violation: limitViolation,
  presign: limitPresign,
  roster: limitRoster,
  default: limitDefault
}

module.exports = {
  limitLogin,
  limitAutosave,
  limitViolation,
  limitPresign,
  limitRoster,
  limitDefault,
  rateLimit,
  routeRateLimiters
}
