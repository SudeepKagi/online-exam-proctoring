const express = require('express')
const authService = require('./service')
const { tokenService } = require('./tokenService')
const { requireAuth } = require('../../middleware/authentication')
const { routeRateLimiters } = require('../../middleware/rateLimit')
const { z } = require('zod')
const { validateBody } = require('../../middleware/validation')
const { ForbiddenError, UnauthorizedError, NotFoundError } = require('../../shared/errors')
const { getClientIp } = require('../../utils/helpers')

const router = express.Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict()

const studentLoginSchema = z.object({
  usn: z.string().min(1),
  password: z.string().min(1)
}).strict()

const invigilatorLoginSchema = z.object({
  invId: z.string().min(1),
  invPassword: z.string().min(1),
  examId: z.string().uuid(),
  idCardPhoto: z.string().optional().nullable()
}).passthrough()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
}).strict()

const refreshSchema = z.object({
  refreshToken: z.string().optional()
}).passthrough()

function shouldExposeToken(req) {
  // In production, no token in JSON bodies (Appendix C / SES-03)
  // Bearer supported for non-browser automation or test suites only
  return (
    process.env.NODE_ENV !== 'production' ||
    req.headers['x-client-type'] === 'test' ||
    req.headers['x-client-type'] === 'cli' ||
    req.headers['x-expose-token'] === '1' ||
    process.env.EXPOSE_TOKEN_BODY === 'true'
  )
}

/**
 * POST /api/v1/auth/login (Unified login)
 */
router.post('/login', routeRateLimiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const result = await authService.login(email, password, { ip, userAgent })

    tokenService.setSessionCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken
    })

    const response = {
      success: true,
      user: result.user
    }
    if (shouldExposeToken(req)) {
      response.token = result.session.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/admin/login
 */
router.post('/admin/login', routeRateLimiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const result = await authService.adminLogin(email, password, { ip, userAgent })

    tokenService.setSessionCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken
    })

    const response = {
      success: true,
      authenticated: true,
      user: result.user
    }
    if (shouldExposeToken(req)) {
      response.token = result.session.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/faculty/login
 */
router.post('/faculty/login', routeRateLimiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const result = await authService.facultyLogin(email, password, { ip, userAgent })

    tokenService.setSessionCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken
    })

    const response = {
      success: true,
      authenticated: true,
      user: result.user
    }
    if (shouldExposeToken(req)) {
      response.token = result.session.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/faculty/register (Disabled in production)
 */
router.post('/faculty/register', (req, res, next) => {
  if (process.env.ALLOW_SELF_REGISTRATION !== 'true') {
    return next(new NotFoundError('Endpoint not found'))
  }
  next(new ForbiddenError('Public self-registration is disabled. Accounts are managed by System Administration.'))
})

/**
 * POST /api/v1/auth/student/login
 */
router.post('/student/login', routeRateLimiters.login, validateBody(studentLoginSchema), async (req, res, next) => {
  try {
    const { usn, password } = req.body
    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const io = req.app?.get('io') || null
    const result = await authService.studentLogin(usn, password, { ip, userAgent, io })

    tokenService.setSessionCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken
    })

    const response = {
      success: true,
      authenticated: true,
      user: result.user
    }
    if (shouldExposeToken(req)) {
      response.token = result.session.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/student/register (Disabled in production)
 */
router.post('/student/register', (req, res, next) => {
  if (process.env.ALLOW_SELF_REGISTRATION !== 'true') {
    return next(new NotFoundError('Endpoint not found'))
  }
  next(new ForbiddenError('Public self-registration is disabled. Accounts are managed by System Administration.'))
})

/**
 * POST /api/v1/auth/invigilator/login
 */
router.post('/invigilator/login', routeRateLimiters.login, validateBody(invigilatorLoginSchema), async (req, res, next) => {
  try {
    const { invId, invPassword, examId } = req.body
    const ipAddress = getClientIp(req)
    const result = await authService.invigilatorLogin({ invId, invPassword, examId, ipAddress })

    tokenService.setSessionCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken
    })

    const response = {
      success: true,
      authenticated: true,
      session: {
        id: result.session.id,
        examId: result.session.examId,
        invId: result.session.invId,
        sessionExpiry: result.session.sessionExpiry,
        exam: result.session.exam
      },
      user: result.user
    }
    if (shouldExposeToken(req)) {
      response.token = result.session.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/refresh (Phase S2 Token Rotation)
 */
router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.pn_rt || req.body?.refreshToken
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Missing refresh token')
    }

    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const result = await authService.refreshSession(rawRefreshToken, { ip, userAgent })

    tokenService.setSessionCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })

    const response = {
      success: true,
      message: 'Session refreshed successfully'
    }
    if (shouldExposeToken(req)) {
      response.accessToken = result.accessToken
    }

    res.status(200).json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/change-password
 */
router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const result = await authService.changePassword(req.user.id, req.user.role, currentPassword, newPassword)
    tokenService.clearSessionCookies(res)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/auth/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await authService.getMe(req.user)
    res.status(200).json({
      success: true,
      authenticated: true,
      user: profile
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/logout (Revoke current session)
 */
router.post('/logout', async (req, res, next) => {
  try {
    let sid = req.user?.sid || null
    let userId = req.user?.id || null

    if (!sid) {
      const token = tokenService.extractAccessToken(req)
      if (token) {
        try {
          const decoded = tokenService.verifyAccessToken(token)
          sid = decoded?.sid || null
          userId = decoded?.id || null
        } catch {
          // Token expired or invalid signature, still proceed with cleanup
        }
      }
    }

    if (sid || userId) {
      await authService.logout(userId, sid)
    }

    tokenService.clearSessionCookies(res)
    res.status(200).json({ success: true, message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/logout-all (Revoke all active user sessions)
 */
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id)
    tokenService.clearSessionCookies(res)
    res.status(200).json({ success: true, message: 'All active sessions revoked successfully' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
