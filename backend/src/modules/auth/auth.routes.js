const express = require('express')
const rateLimit = require('express-rate-limit')
const authController = require('./auth.controller')
const { authService } = require('./auth.service')
const { extractTokenFromReq } = require('../../utils/cookies')

const isTest = process.env.NODE_ENV === 'test'
const isLoadTest = (process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1')

function getLoginLimiterKey(req) {
  const identifier = String(req.body?.email || req.body?.username || '').trim().toLowerCase()
  return identifier ? `auth_login_${identifier}` : `auth_ip_${req.ip}`
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => {
    const isTest = process.env.NODE_ENV === 'test'
    const isLoad = process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1'
    return (isTest || isLoad) ? 10000 : 15
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1',
  keyGenerator: getLoginLimiterKey,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts for this account. Please wait 15 minutes before trying again.'
  }
})

const suspendedUsersCache = new Map() // userId -> { isSuspended: boolean, ts: number }

function markUserSuspension(userId, isSuspended) {
  if (!userId) return
  suspendedUsersCache.set(userId, { isSuspended, ts: Date.now() })
}

async function isUserSuspended(userId) {
  if (!userId) return false
  const cached = suspendedUsersCache.get(userId)
  if (cached && Date.now() - cached.ts < 10000) {
    return cached.isSuspended
  }
  try {
    const { prisma } = require('../../infra/postgres/client')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true }
    })
    const isSuspended = user?.status === 'SUSPENDED'
    suspendedUsersCache.set(userId, { isSuspended, ts: Date.now() })
    return isSuspended
  } catch (_) {
    return false
  }
}

async function authenticateToken(req, res, next) {
  const token = extractTokenFromReq(req)
  if (!token) {
    return res.status(401).json({ code: 'TOKEN_REQUIRED', message: 'Authentication required', error: { message: 'Authentication required' } })
  }

  const decoded = authService.verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ code: 'TOKEN_INVALID', message: 'Invalid or expired token', error: { message: 'Invalid or expired token' } })
  }

  const userId = decoded.id || decoded.sub
  if (userId) {
    const suspended = await isUserSuspended(userId)
    if (suspended) {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account is suspended. Please contact institutional administrator.',
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended. Please contact institutional administrator.' }
      })
    }
  }

  req.user = decoded
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 'TOKEN_REQUIRED', message: 'Authentication required', error: { message: 'Authentication required' } })
    }
    const userRole = String(req.user.role || '').toUpperCase()
    const allowed = roles.map(r => String(r).toUpperCase())
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions', error: { message: 'Insufficient permissions' } })
    }
    next()
  }
}

const router = express.Router()

router.post('/login', loginLimiter, authController.login)
router.post('/refresh', authController.refresh)
router.post('/admin/login', loginLimiter, authController.adminLogin)
router.post('/faculty/login', loginLimiter, authController.facultyLogin)
router.post('/student/login', loginLimiter, authController.studentLogin)
router.post('/invigilator/login', loginLimiter, authController.invigilatorLogin)
router.post('/student/register', authController.register)
router.post('/faculty/register', authController.register)
router.post('/register', authController.register)
router.get('/me', authenticateToken, authController.me)
router.post('/onboarding', authenticateToken, authController.onboarding)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)
router.put('/settings', authenticateToken, authController.updateSettings)
router.post('/logout', authController.logout)

module.exports = router
module.exports.authenticateToken = authenticateToken
module.exports.requireRole = requireRole
module.exports.markUserSuspension = markUserSuspension
module.exports.isUserSuspended = isUserSuspended
module.exports.loginLimiter = loginLimiter
module.exports.getLoginLimiterKey = getLoginLimiterKey
