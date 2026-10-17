const express = require('express')
const proctoringController = require('./proctoring.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')

const router = express.Router()

// Browser Lockdown & Integrity Violation Event Intake
router.post('/events', authenticateToken, proctoringController.logViolation)
router.post('/proctoring/events', authenticateToken, proctoringController.logViolation)
router.post('/violation', authenticateToken, proctoringController.logViolation)
router.post('/violations', authenticateToken, proctoringController.logViolation)
router.post('/proctoring/violation', authenticateToken, proctoringController.logViolation)
router.post('/proctoring/violations', authenticateToken, proctoringController.logViolation)
router.post('/attempts/:attemptId/violations', authenticateToken, proctoringController.logViolation)

// Invigilator Live Console Logs
router.get('/attempts/:attemptId/violations', authenticateToken, proctoringController.getAttemptLogs)
router.get('/exams/:examId/violations', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), proctoringController.getExamLogs)
router.get('/proctoring/attempts/:attemptId/logs', authenticateToken, proctoringController.getAttemptLogs)
router.get('/proctoring/exams/:examId/logs', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), proctoringController.getExamLogs)

module.exports = router
