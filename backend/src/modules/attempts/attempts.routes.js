const express = require('express')
const attemptsController = require('./attempts.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')

const router = express.Router()

// Pre-exam Readiness & Attempt Activation
router.post('/start', authenticateToken, attemptsController.startAttempt)
router.post('/exams/:examId/readiness', authenticateToken, attemptsController.getReadiness)
router.post('/exams/:examId/start', authenticateToken, attemptsController.startAttempt)
router.post('/student/exams/:examId/start', authenticateToken, attemptsController.startAttempt)
router.get('/student/exams/:examId/start', authenticateToken, attemptsController.startAttempt)
router.post('/:examId/readiness', authenticateToken, attemptsController.getReadiness)
router.post('/:examId/start', authenticateToken, attemptsController.startAttempt)

// Hot-Path Answer Upsert & State Sync
router.get('/:attemptId', authenticateToken, attemptsController.getAttempt)
router.post('/:attemptId/answers', authenticateToken, attemptsController.saveAnswer)
router.put('/:attemptId/answers', authenticateToken, attemptsController.batchSaveAnswers)
router.post('/:attemptId/answers/batch', authenticateToken, attemptsController.batchSaveAnswers)

// Final Submission & Deterministic Grading
router.post('/:attemptId/submit', authenticateToken, attemptsController.submitAttempt)

// Invigilator Actions
router.post('/:attemptId/suspend', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.suspendAttempt)
router.post('/:attemptId/resume', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.resumeAttempt)
router.post('/:attemptId/terminate', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.terminateAttempt)

// VPN Status Hook
router.get('/:attemptId/vpn-status', authenticateToken, attemptsController.getVpnStatus)

module.exports = router
