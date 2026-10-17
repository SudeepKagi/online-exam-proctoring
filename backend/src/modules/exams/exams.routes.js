const express = require('express')
const examsController = require('./exams.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')

const router = express.Router()

// Student alias endpoints for seamless frontend routing
router.get('/student/exams', authenticateToken, examsController.getStudentExams)
router.get('/student/exams/:id/lobby', authenticateToken, examsController.getExam)
router.get('/student/exams/:id', authenticateToken, examsController.getExam)

// Faculty alias endpoints
router.get('/faculty/exams', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.getFacultyExams)

// Standard /exams CRUD & Question Management
router.get('/', authenticateToken, examsController.listExams)
router.post('/', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.createExam)
router.get('/:id', authenticateToken, examsController.getExam)
router.post('/:id/publish', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.publishExam)
router.post('/:id/questions', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.addQuestion)
router.delete('/:id/questions/:questionId', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.deleteQuestion)
router.post('/:id/assign', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.assignUser)

module.exports = router
