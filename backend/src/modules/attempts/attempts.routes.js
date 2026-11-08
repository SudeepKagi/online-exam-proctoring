const express = require('express')
const attemptsController = require('./attempts.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')
const { verifySeb, verifySebNonBlocking } = require('../../middleware/seb')

const router = express.Router()

// Pre-exam Readiness, Attempt Activation & SEB Verification Status
router.get('/exams/:examId/seb-status', authenticateToken, verifySebNonBlocking, attemptsController.getSebStatus)
router.get('/:examId/seb-status', authenticateToken, verifySebNonBlocking, attemptsController.getSebStatus)
router.post('/start', authenticateToken, verifySeb, attemptsController.startAttempt)
router.post('/exams/:examId/readiness', authenticateToken, attemptsController.getReadiness)
router.post('/exams/:examId/start', authenticateToken, verifySeb, attemptsController.startAttempt)
router.post('/student/exams/:examId/start', authenticateToken, verifySeb, attemptsController.startAttempt)
router.get('/student/exams/:examId/start', authenticateToken, verifySeb, attemptsController.startAttempt)
router.post('/:examId/readiness', authenticateToken, attemptsController.getReadiness)
router.post('/:examId/start', authenticateToken, verifySeb, attemptsController.startAttempt)

// Hot-Path Answer Upsert & State Sync
router.get('/:attemptId', authenticateToken, verifySeb, attemptsController.getAttempt)
router.post('/:attemptId/answers', authenticateToken, verifySeb, attemptsController.saveAnswer)
router.put('/:attemptId/answers', authenticateToken, verifySeb, attemptsController.batchSaveAnswers)
router.post('/:attemptId/answers/batch', authenticateToken, verifySeb, attemptsController.batchSaveAnswers)

// Final Submission & Deterministic Grading
router.post('/:attemptId/submit', authenticateToken, verifySeb, attemptsController.submitAttempt)

// Invigilator Actions
router.post('/:attemptId/suspend', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.suspendAttempt)
router.post('/:attemptId/resume', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.resumeAttempt)
router.post('/:attemptId/terminate', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.terminateAttempt)

// VPN Status Hook
router.get('/:attemptId/vpn-status', authenticateToken, attemptsController.getVpnStatus)

module.exports = router
