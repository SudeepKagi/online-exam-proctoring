const express  = require('express')
const router   = express.Router()
const ctrl     = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth.middleware')

// ── Admin ──────────────────────────────────────────
router.post('/admin/login',   ctrl.adminLogin)

// ── Faculty ────────────────────────────────────────
router.post('/faculty/register', ctrl.facultyRegister)
router.post('/faculty/login',    ctrl.facultyLogin)

// ── Student ────────────────────────────────────────
router.post('/student/register', ctrl.studentRegister)
router.post('/student/login',    ctrl.studentLogin)

// ── Invigilator ────────────────────────────────────
router.post('/invigilator/login', ctrl.invigilatorLogin)

// ── Forced Password Change ─────────────────────────
router.post('/change-password', authenticate, ctrl.changePassword)

// ── Verify token (used by frontend on reload) ──────
router.get('/me', authenticate, ctrl.getMe)

module.exports = router
