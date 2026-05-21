const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/student.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isStudent }    = require('../middleware/role.middleware')

// All student routes require authentication and student role
router.use(authenticate, isStudent)

// ── Exam listing ───────────────────────────────────────────────────
router.get('/exams',               ctrl.listMyExams)
router.get('/exams/:id',           ctrl.getExamDetails)
router.get('/exams/:id/lobby',     ctrl.getExamLobby)
router.get('/exams/:id/start',     ctrl.startExam)

// ── Answer management ──────────────────────────────────────────────
router.post('/exams/:id/answer',   ctrl.saveAnswer)
router.post('/exams/:id/autosave', ctrl.autoSaveAnswer)

// ── Security & evidence ────────────────────────────────────────────
router.post('/exams/:id/evidence',    ctrl.logEvidence)
router.post('/exams/:id/violation',   ctrl.logViolation)
router.post('/exams/:id/acknowledge', ctrl.acknowledgeWatermark)

// ── Chat ───────────────────────────────────────────────────────────
router.get ('/exams/:id/chat',  ctrl.getChatHistory)
router.post('/exams/:id/chat',  ctrl.saveChatMessage)

// ── Submission ─────────────────────────────────────────────────────
router.post('/exams/:id/submit', ctrl.submitExam)

// ── Results ────────────────────────────────────────────────────────
router.get('/results', ctrl.getMyResults)

// ── Face & ID verification ──────────────────────────────────────────────
router.post('/verify-face', ctrl.verifyFace)
router.post('/verify-id',   ctrl.verifyIdCard)
router.post('/exams/:id/identity-verify', ctrl.saveIdentityVerification)

module.exports = router
