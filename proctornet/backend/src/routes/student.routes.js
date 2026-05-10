const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/student.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isStudent }    = require('../middleware/role.middleware')

// All student routes require authentication and student role
router.use(authenticate, isStudent)

router.get('/exams', ctrl.listMyExams)
router.get('/exams/:id', ctrl.getExamDetails)
router.get('/exams/:id/start', ctrl.startExam)
router.post('/exams/:id/autosave', ctrl.autoSaveAnswer)
router.post('/exams/:id/violation', ctrl.logViolation)
router.post('/exams/:id/submit', ctrl.submitExam)

module.exports = router
