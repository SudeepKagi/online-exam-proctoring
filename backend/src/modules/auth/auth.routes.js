const express = require('express')
const authController = require('./auth.controller')
const { authService } = require('./auth.service')
const { extractTokenFromReq } = require('../../utils/cookies')

function authenticateToken(req, res, next) {
  const token = extractTokenFromReq(req)
  if (!token) {
    return res.status(401).json({ error: { message: 'Authentication required' } })
  }

  const decoded = authService.verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } })
  }

  req.user = decoded
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } })
    }
    const userRole = String(req.user.role || '').toUpperCase()
    const allowed = roles.map(r => String(r).toUpperCase())
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } })
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
router.post('/logout', authController.logout)

module.exports = router
module.exports.authenticateToken = authenticateToken
module.exports.requireRole = requireRole
