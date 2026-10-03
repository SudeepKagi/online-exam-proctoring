const express = require('express')
const authService = require('./service')
const { setAuthCookie, clearAuthCookie } = require('../../utils/cookies')
const { requireAuth } = require('../../middleware/authentication')
const { routeRateLimiters } = require('../../middleware/rateLimit')
const { z } = require('zod')
const { validateBody } = require('../../middleware/validation')

const router = express.Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict()

/**
 * POST /api/v1/auth/login
 */
router.post('/login', routeRateLimiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)

    // Set HttpOnly SameSite cookie
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
 * POST /api/v1/auth/logout
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.status(200).json({ success: true, message: 'Logged out successfully' })
})

/**
 * GET /api/v1/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  })
})

module.exports = router
