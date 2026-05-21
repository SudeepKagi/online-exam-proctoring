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
router.post  ('/exams',            ctrl.createExam)
router.get   ('/exams',            ctrl.listExams)
router.get   ('/exams/:id',        ctrl.getExam)
router.patch ('/exams/:id',        ctrl.updateExam)
router.delete('/exams/:id',        ctrl.deleteExam)
router.patch ('/exams/:id/publish',      ctrl.publishExam)
router.get   ('/exams/:id/credentials',  ctrl.getExamCredentials)
router.post  ('/exams/:id/duplicate',    ctrl.duplicateExam)

// ── Results ───────────────────────────────────────────
router.get   ('/results',                    ctrl.listAllResults)
router.get   ('/exams/:id/results',          ctrl.listExamResults)
router.patch ('/exams/:id/results/release',  ctrl.releaseResults)
router.get   ('/exams/:id/collusion',        ctrl.runCollusionCheck)
router.get   ('/results/:id',                ctrl.getStudentResult)

// ── Question Management ───────────────────────────────
router.post  ('/exams/:examId/questions',     ctrl.addQuestion)
router.get   ('/exams/:examId/questions',     ctrl.listExamQuestions)
router.post  ('/exams/:examId/ai-generate',   ctrl.generateQuestionsFromAI)
router.post  ('/exams/ai-generate-preview',   ctrl.generateQuestionsPreview)
router.put   ('/questions/:id',               ctrl.updateQuestion)
router.delete('/questions/:id',               ctrl.deleteQuestion)
router.post  ('/questions/bulk',              ctrl.bulkAddQuestions)

// ── Legacy question routes ────────────────────────────
router.post  ('/questions',  ctrl.addQuestion)
router.get   ('/questions',  ctrl.listQuestions)

// ── Student Management ────────────────────────────────
router.get   ('/students',             ctrl.listStudents)
router.patch ('/students/:id/approve', ctrl.approveStudent)
router.post  ('/exams/:id/students',   ctrl.addStudentsToExam)
router.get   ('/exams/:id/students',   ctrl.listExamStudents)

module.exports = router
