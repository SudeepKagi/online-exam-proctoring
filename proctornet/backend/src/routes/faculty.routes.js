const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/faculty.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isFaculty }    = require('../middleware/role.middleware')
const { auditRequest } = require('../middleware/audit.middleware')

// All faculty routes require JWT + faculty role + audit logging
router.use(authenticate, isFaculty, auditRequest)

// ── Dashboard ─────────────────────────────────────────
router.get   ('/dashboard',  ctrl.getDashboardStats)

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
router.get   ('/students',           ctrl.listStudents)
router.patch ('/students/:id/approve', ctrl.approveStudent)
router.post  ('/exams/:id/students', ctrl.addStudentsToExam)
router.get   ('/exams/:id/students', ctrl.listExamStudents)
router.get   ('/exams/:id/results',  ctrl.listExamResults)
router.get   ('/results/:id',        ctrl.getStudentResult)
router.post  ('/exams/:id/collusion-check', ctrl.runCollusionCheck)

module.exports = router

