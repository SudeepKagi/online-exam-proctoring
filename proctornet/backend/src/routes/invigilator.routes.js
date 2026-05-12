const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/invigilator.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isInvigilator } = require('../middleware/role.middleware')

// ── Public: Invigilator login ────────────────────────────────────
router.post('/login', ctrl.login)

// ── Protected: require invigilator JWT ──────────────────────────
router.use(authenticate, isInvigilator)

// Dashboard data
router.get('/exam/:examId', ctrl.getExamInfo)
router.get('/exams/:examId/students', ctrl.getExamStudents) // legacy alias

// Actions
router.post('/exam/:examId/warn/:studentId',      ctrl.warnStudent)
router.post('/exam/:examId/terminate/:studentId', ctrl.terminateStudent)

module.exports = router
