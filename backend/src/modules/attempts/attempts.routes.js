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

// Results & Score Breakdown (Standard HTTP, student can view in any browser)
router.get('/exams/:examId/my-result', authenticateToken, attemptsController.getExamResult)
router.get('/:attemptId/results', authenticateToken, attemptsController.getAttemptResults)

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
router.post('/:attemptId/approve-identity', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.approveIdentity)
router.post('/:attemptId/reject-identity', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.rejectIdentity)

// Incident Review & Actions (§Task 8)
router.get('/:attemptId/incidents', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.getAttemptIncidents)
router.patch('/:attemptId/review', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.updateAttemptReview)
router.get('/:attemptId/incidents/export', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), attemptsController.exportAttemptIncidentsCsv)

// VPN Status Hook
router.get('/:attemptId/vpn-status', authenticateToken, attemptsController.getVpnStatus)

module.exports = router
