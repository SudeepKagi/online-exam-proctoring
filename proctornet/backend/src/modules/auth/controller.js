const express = require('express')
const authService = require('./service')
const { setAuthCookie, clearAuthCookie } = require('../../utils/cookies')
const { requireAuth } = require('../../middleware/authentication')
const { routeRateLimiters } = require('../../middleware/rateLimit')
const { z } = require('zod')
const { validateBody } = require('../../middleware/validation')
const { ForbiddenError } = require('../../shared/errors')
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

/**
 * POST /api/v1/auth/login (Unified login)
 */
router.post('/login', routeRateLimiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)

    setAuthCookie(res, result.accessToken)

    res.status(200).json({
      success: true,
      user: result.user,
      token: result.accessToken
    })
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
    const result = await authService.adminLogin(email, password)

    setAuthCookie(res, result.accessToken)

    res.status(200).json({
      success: true,
      authenticated: true,
      user: result.user,
      token: result.accessToken
    })
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
    const result = await authService.facultyLogin(email, password)

    setAuthCookie(res, result.accessToken)

    res.status(200).json({
      success: true,
      authenticated: true,
      user: result.user,
      token: result.accessToken
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/faculty/register (Disabled)
 */
router.post('/faculty/register', (req, res, next) => {
  next(new ForbiddenError('Public self-registration is disabled. Accounts are managed by System Administration.'))
})

/**
 * POST /api/v1/auth/student/login
 */
router.post('/student/login', routeRateLimiters.login, validateBody(studentLoginSchema), async (req, res, next) => {
  try {
    const { usn, password } = req.body
    const result = await authService.studentLogin(usn, password)

    setAuthCookie(res, result.accessToken)

    res.status(200).json({
      success: true,
      authenticated: true,
      user: result.user,
      token: result.accessToken
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/student/register (Disabled)
 */
router.post('/student/register', (req, res, next) => {
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

    setAuthCookie(res, result.accessToken)

    res.status(200).json({
      success: true,
      authenticated: true,
      session: result.session,
      user: result.user,
      token: result.accessToken
    })
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
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    await authService.logout(req.user?.id)
    clearAuthCookie(res)
    res.status(200).json({ success: true, message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
