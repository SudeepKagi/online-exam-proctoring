/**
 * tokenService.js
 * Single Token Authority for ProctorNet (Phase S2 Stabilization).
 * Manages dual-token session architecture:
 * - 15-minute Access JWT (pn_at)
 * - Rotating 12-hour Refresh Token (pn_rt) with family reuse detection
 * - Server-side session tracking in auth_sessions
 * - Fast-path bounded in-memory session cache (TTL 30s)
 * - Global epoch invalidation via platform_settings
 */

const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { UnauthorizedError } = require('../../shared/errors')
const { logger } = require('../../observability/logger')

const ACCESS_TOKEN_TTL_SEC = 15 * 60 // 15 minutes
const DEFAULT_REFRESH_TTL_SEC = 12 * 60 * 60 // 12 hours
const SESSION_CACHE_TTL_MS = 30 * 1000 // 30 seconds bounded cache

// Bounded in-memory session cache to avoid DB lookups on every request (t3.micro friendly)
const sessionCache = new Map()
let cachedEpoch = null
let cachedEpochExpiresAt = 0

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!'
    }
    throw new Error('JWT_SECRET is missing from environment')
  }
  return secret
}

class TokenService {
  /**
   * Fetch global auth_epoch from platform_settings (cached for 30s)
   */
  async getAuthEpoch() {
    const now = Date.now()
    if (cachedEpoch !== null && now < cachedEpochExpiresAt) {
      return cachedEpoch
    }

    try {
      let setting = await prisma.platformSetting.findUnique({
        where: { key: 'auth_epoch' }
      })

      if (!setting) {
        setting = await prisma.platformSetting.create({
          data: {
            id: crypto.randomUUID(),
            key: 'auth_epoch',
            value: '1'
          }
        })
      }

      cachedEpoch = parseInt(setting.value, 10) || 1
      cachedEpochExpiresAt = now + 30000
      return cachedEpoch
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to read auth_epoch from DB, using fallback')
      return cachedEpoch || 1
    }
  }

  /**
   * Bump global auth_epoch (invalidates every extant token immediately)
   */
  async bumpAuthEpoch(updatedBy = null) {
    const current = await this.getAuthEpoch()
    const nextEpoch = current + 1

    await prisma.platformSetting.upsert({
      where: { key: 'auth_epoch' },
      update: {
        value: String(nextEpoch),
        updatedBy: updatedBy || null
      },
      create: {
        id: crypto.randomUUID(),
        key: 'auth_epoch',
        value: String(nextEpoch),
        updatedBy: updatedBy || null
      }
    })

    cachedEpoch = nextEpoch
    cachedEpochExpiresAt = Date.now() + 30000
    // Purge local cache
    sessionCache.clear()

    logger.info({ nextEpoch, updatedBy }, 'Global auth_epoch bumped: all extant sessions invalidated')
    return nextEpoch
  }

  /**
   * Sign a 15-minute access JWT
   */
  signAccessToken(payload, customTtlSec = ACCESS_TOKEN_TTL_SEC) {
    const secret = getSecret()
    return jwt.sign(payload, secret, {
      expiresIn: customTtlSec
    })
  }

  /**
   * Verify an access JWT signature and structure
   */
  verifyAccessToken(token) {
    const secret = getSecret()
    return jwt.verify(token, secret)
  }

  /**
   * Hash a refresh token using SHA-256 for secure database lookup
   */
  hashRefreshToken(refreshToken) {
    return crypto.createHash('sha256').update(refreshToken).digest('hex')
  }

  /**
   * Create a new dual-token session in database and cache
   */
  async createSession({
    userId,
    role,
    examId = null,
    mustChangePassword = false,
    ip = null,
    userAgent = null,
    refreshTtlSec = DEFAULT_REFRESH_TTL_SEC,
    accessTtlSec = ACCESS_TOKEN_TTL_SEC
  }) {
    const sid = crypto.randomUUID()
    const familyId = crypto.randomUUID()
    const rawRefreshToken = crypto.randomBytes(32).toString('hex')
    const refreshHash = this.hashRefreshToken(rawRefreshToken)

    const epoch = await this.getAuthEpoch()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + refreshTtlSec * 1000)

    // Persist to database
    await prisma.authSession.create({
      data: {
        id: sid,
        userId,
        role: role.toUpperCase(),
        examId: examId || null,
        familyId,
        refreshHash,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
        revokeReason: null,
        ip: ip || null,
        userAgent: userAgent || null
      }
    })

    // Sign access token
    const accessTokenPayload = {
      id: userId,
      role: role.toLowerCase(),
      sid,
      familyId,
      epoch,
      examId: examId || null,
      mustChangePassword: Boolean(mustChangePassword)
    }

    const accessToken = this.signAccessToken(accessTokenPayload, accessTtlSec)

    // Populate in-memory cache
    sessionCache.set(sid, {
      valid: true,
      userId,
      role: role.toLowerCase(),
      epoch,
      familyId,
      examId,
      mustChangePassword: Boolean(mustChangePassword),
      expiresAt: now.getTime() + SESSION_CACHE_TTL_MS
    })

    return {
      sid,
      sessionId: sid,
      familyId,
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt
    }
  }

  /**
   * Validate a session by SID (fast in-memory path, backed by DB on miss)
   */
  async validateSession(sid, tokenEpoch = null) {
    const now = Date.now()
    const cached = sessionCache.get(sid)

    if (cached && cached.expiresAt > now) {
      if (!cached.valid) {
        return { valid: false, reason: cached.reason }
      }
      if (tokenEpoch !== null && cached.epoch > tokenEpoch) {
        return { valid: false, reason: 'EPOCH_EXPIRED' }
      }
      return { valid: true, session: cached }
    }

    // Cache miss or expired: query database
    const dbSession = await prisma.authSession.findUnique({
      where: { id: sid }
    })

    if (!dbSession) {
      sessionCache.set(sid, { valid: false, reason: 'SESSION_NOT_FOUND', expiresAt: now + 5000 })
      return { valid: false, reason: 'SESSION_NOT_FOUND' }
    }

    if (dbSession.revokedAt) {
      sessionCache.set(sid, { valid: false, reason: 'SESSION_REVOKED', expiresAt: now + 5000 })
      return { valid: false, reason: 'SESSION_REVOKED', revokeReason: dbSession.revokeReason }
    }

    if (dbSession.expiresAt < new Date()) {
      sessionCache.set(sid, { valid: false, reason: 'SESSION_EXPIRED', expiresAt: now + 5000 })
      return { valid: false, reason: 'SESSION_EXPIRED' }
    }

    // Check epoch
    const currentEpoch = await this.getAuthEpoch()
    if (tokenEpoch !== null && currentEpoch > tokenEpoch) {
      sessionCache.set(sid, { valid: false, reason: 'EPOCH_EXPIRED', expiresAt: now + 5000 })
      return { valid: false, reason: 'EPOCH_EXPIRED' }
    }

    // Cache valid state for 30 seconds
    const sessionData = {
      valid: true,
      userId: dbSession.userId,
      role: dbSession.role.toLowerCase(),
      epoch: currentEpoch,
      familyId: dbSession.familyId,
      examId: dbSession.examId,
      expiresAt: now + SESSION_CACHE_TTL_MS
    }
    sessionCache.set(sid, sessionData)

    return { valid: true, session: sessionData }
  }

  /**
   * Rotate a refresh token with family reuse detection
   */
  async rotateSession(rawRefreshToken, { ip = null, userAgent = null } = {}) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedError('Missing refresh token')
    }

    const refreshHash = this.hashRefreshToken(rawRefreshToken.trim())

    const session = await prisma.authSession.findUnique({
      where: { refreshHash }
    })

    if (!session) {
      throw new UnauthorizedError('Invalid session credentials')
    }

    // REUSE DETECTION: If token was already revoked, compromise detected!
    if (session.revokedAt) {
      logger.warn(
        { sid: session.id, familyId: session.familyId, userId: session.userId },
        'SECURITY ALERT: Refresh token reuse detected! Revoking all sessions in token family.'
      )

      // Revoke all sessions in this family
      await prisma.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'REUSE_DETECTED'
        }
      })

      // Invalidate in-memory cache
      sessionCache.clear()
      throw new UnauthorizedError('Session compromise detected. All family sessions have been terminated.')
    }

    // Expiry check
    if (session.expiresAt < new Date()) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokeReason: 'EXPIRED' }
      })
      sessionCache.delete(session.id)
      throw new UnauthorizedError('Session has expired. Please sign in again.')
    }

    // Revoke old session as ROTATED
    const now = new Date()
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        revokeReason: 'ROTATED'
      }
    })
    sessionCache.delete(session.id)

    // Generate new rotated session in the same family
    const newSid = crypto.randomUUID()
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex')
    const newRefreshHash = this.hashRefreshToken(newRawRefreshToken)
    const epoch = await this.getAuthEpoch()

    await prisma.authSession.create({
      data: {
        id: newSid,
        userId: session.userId,
        role: session.role,
        examId: session.examId,
        familyId: session.familyId,
        refreshHash: newRefreshHash,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: session.expiresAt, // preserve original session envelope
        revokedAt: null,
        revokeReason: null,
        ip: ip || session.ip,
        userAgent: userAgent || session.userAgent
      }
    })

    const cachedOld = sessionCache.get(session.id)
    const mustChangePassword = Boolean(cachedOld?.mustChangePassword)

    const accessTokenPayload = {
      id: session.userId,
      role: session.role.toLowerCase(),
      sid: newSid,
      familyId: session.familyId,
      epoch,
      examId: session.examId || null,
      mustChangePassword
    }

    const newAccessToken = this.signAccessToken(accessTokenPayload, ACCESS_TOKEN_TTL_SEC)

    sessionCache.set(newSid, {
      valid: true,
      userId: session.userId,
      role: session.role.toLowerCase(),
      epoch,
      familyId: session.familyId,
      examId: session.examId,
      mustChangePassword,
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS
    })

    return {
      sid: newSid,
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      expiresAt: session.expiresAt
    }
  }

  /**
   * Revoke a single session
   */
  async revokeSession(sid, reason = 'LOGOUT') {
    if (!sid) return
    sessionCache.delete(sid)
    try {
      await prisma.authSession.updateMany({
        where: { id: sid, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: reason
        }
      })
    } catch (err) {
      logger.warn({ sid, err: err.message }, 'Failed to mark session revoked in DB')
    }
  }

  /**
   * Revoke all active sessions for a user (password change, suspension, logout-all)
   */
  async revokeAllUserSessions(userId, reason = 'LOGOUT_ALL') {
    if (!userId) return
    sessionCache.clear()
    try {
      await prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: reason
        }
      })
      logger.info({ userId, reason }, 'Revoked all active sessions for user')
    } catch (err) {
      logger.warn({ userId, err: err.message }, 'Failed to revoke user sessions')
    }
  }

  /**
   * Set secure dual-cookies on the response (Appendix C)
   * Set-Cookie: pn_at=<access JWT>;  Path=/;           HttpOnly; Secure; SameSite=Lax; Max-Age=900
   * Set-Cookie: pn_rt=<refresh>;     Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=43200
   */
  setSessionCookies(res, { accessToken, refreshToken, refreshMaxAgeSec = DEFAULT_REFRESH_TTL_SEC }) {
    if (!res || typeof res.cookie !== 'function') return

    const isProd = process.env.NODE_ENV === 'production'
    const isSecure = isProd || process.env.COOKIE_SECURE === 'true' || Boolean(res.req?.secure)

    // Access token cookie
    res.cookie('pn_at', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SEC * 1000
    })

    // Refresh token cookie (scoped strictly to auth endpoints)
    if (refreshToken) {
      res.cookie('pn_rt', refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: refreshMaxAgeSec * 1000
      })
      res.cookie('pn_rt_compat', refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: refreshMaxAgeSec * 1000
      })
    }

    // Set legacy cookie name for backwards compatibility during migration
    res.cookie('proctornet_auth', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SEC * 1000
    })
  }

  /**
   * Clear both session cookies on logout
   */
  clearSessionCookies(res) {
    if (!res || typeof res.clearCookie !== 'function') return

    const isProd = process.env.NODE_ENV === 'production'
    const isSecure = isProd || process.env.COOKIE_SECURE === 'true' || Boolean(res.req?.secure)

    res.clearCookie('pn_at', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/'
    })

    res.clearCookie('pn_rt', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/api/v1/auth'
    })

    res.clearCookie('pn_rt_compat', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/api/auth'
    })

    res.clearCookie('proctornet_auth', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/'
    })
  }

  /**
   * Extract access token from request (prioritizing pn_at, then proctornet_auth, then Bearer for tests)
   */
  extractAccessToken(req) {
    if (!req) return null
    if (req.cookies?.pn_at) return req.cookies.pn_at
    if (req.cookies?.proctornet_auth) return req.cookies.proctornet_auth

    // Cookie header raw fallback
    if (req.headers?.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)pn_at=([^;]+)/) ||
                    req.headers.cookie.match(/(?:^|;\s*)proctornet_auth=([^;]+)/)
      if (match) return match[1]
    }

    // Non-browser / test Bearer header fallback
    const authHeader = req.headers?.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim()
    }

    return null
  }

  /**
   * Extract refresh token from request (prioritizing pn_rt cookie, then body)
   */
  extractRefreshToken(req) {
    if (!req) return null
    if (req.cookies?.pn_rt) return req.cookies.pn_rt
    if (req.cookies?.pn_rt_compat) return req.cookies.pn_rt_compat

    if (req.headers?.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)(?:pn_rt|pn_rt_compat)=([^;]+)/)
      if (match) return match[1]
    }

    if (req.body?.refreshToken) {
      return req.body.refreshToken
    }

    return null
  }
}

const tokenService = new TokenService()

module.exports = {
  tokenService,
  ACCESS_TOKEN_TTL_SEC,
  DEFAULT_REFRESH_TTL_SEC
}
