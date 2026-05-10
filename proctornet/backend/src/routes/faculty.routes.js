const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/faculty.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isFaculty }    = require('../middleware/role.middleware')
const { auditRequest } = require('../middleware/audit.middleware')

// All faculty routes require JWT + faculty role + audit logging
router.use(authenticate, isFaculty, auditRequest)

// ── Exam Management ───────────────────────────────────
router.post  ('/exams',      ctrl.createExam)
router.get   ('/exams',      ctrl.listExams)
router.get   ('/exams/:id',  ctrl.getExam)
router.patch ('/exams/:id',  ctrl.updateExam)

// ── Question Management ───────────────────────────────
router.post  ('/questions',       ctrl.addQuestion)
router.get   ('/questions',       ctrl.listQuestions)
router.post  ('/questions/bulk',  ctrl.bulkAddQuestions)

// ── Student & Result Management ───────────────────────
router.post  ('/exams/:id/students', ctrl.addStudentsToExam)
router.get   ('/exams/:id/students', ctrl.listExamStudents)
router.get   ('/exams/:id/results',  ctrl.listExamResults)

module.exports = router
