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

// 1. Login: 10 per minute per IP + email
const loginLimiter = createLimiter('login', 10, 60)

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

function rateLimit(limiter, keyGenerator) {
  return async (req, res, next) => {
    // Skip in test mode if LOADTEST_ALLOW or NODE_ENV=test
    if (process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1' || process.env.NODE_ENV === 'test') {
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
      next(new TooManyRequestsError(`Rate limit exceeded for ${key}, please retry in ${secs}s`, secs))
    }
  }
}

// Route-specific middleware helpers
const limitLogin = rateLimit(loginLimiter, (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1'
  const email = (req.body?.email || '').toLowerCase().trim()
  return `${ip}:${email}`
})

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
