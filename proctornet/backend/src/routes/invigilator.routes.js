const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/invigilator.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { requireRole }  = require('../middleware/role.middleware')

// ── Public: Invigilator login ────────────────────────────────────
router.post('/login', ctrl.login)

// ── Protected: require invigilator / faculty / admin JWT ──────────
router.use(authenticate, requireRole('invigilator', 'faculty', 'admin'))

// Dashboard & Live Grid data
router.get('/exam/:examId', ctrl.getExamInfo)
router.get('/live-grid/:examId', ctrl.getExamInfo)
router.get('/exams/:examId/students', ctrl.getExamStudents) // legacy alias

// Actions
router.post('/send-warning', ctrl.sendWarningGeneral)
router.post('/pause-student/:studentId', ctrl.pauseStudentGeneral)
router.post('/resume-student/:studentId', ctrl.resumeStudentGeneral)
router.post('/terminate-student/:studentId', ctrl.terminateStudentGeneral)
router.post('/exam/:examId/warn/:studentId', ctrl.warnStudent)
router.post('/exam/:examId/terminate/:studentId', ctrl.terminateStudent)

module.exports = router
