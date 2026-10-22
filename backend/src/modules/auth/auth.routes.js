const express = require('express')
const authController = require('./auth.controller')
const { authService } = require('./auth.service')
const { extractTokenFromReq } = require('../../utils/cookies')

function authenticateToken(req, res, next) {
  const token = extractTokenFromReq(req)
  if (!token) {
    return res.status(401).json({ code: 'TOKEN_REQUIRED', message: 'Authentication required', error: { message: 'Authentication required' } })
  }

  const decoded = authService.verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ code: 'TOKEN_INVALID', message: 'Invalid or expired token', error: { message: 'Invalid or expired token' } })
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

router.post('/login', authController.login)
router.post('/admin/login', authController.adminLogin)
router.post('/faculty/login', authController.facultyLogin)
router.post('/student/login', authController.studentLogin)
router.post('/invigilator/login', authController.invigilatorLogin)
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
