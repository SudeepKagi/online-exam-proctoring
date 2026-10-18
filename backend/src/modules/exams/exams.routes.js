const express = require('express')
const examsController = require('./exams.controller')
const { authenticateToken, requireRole } = require('../auth/auth.routes')

const examsOpsController = require('./exams.ops.controller')

const router = express.Router()

// Student alias endpoints for seamless frontend routing
router.get('/student/exams', authenticateToken, examsController.getStudentExams)
router.get('/student/exams/:id/lobby', authenticateToken, examsController.getExam)
router.get('/student/exams/:id', authenticateToken, examsController.getExam)

// Faculty alias endpoints
router.get('/faculty/exams', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.getFacultyExams)

// Alias for when router is mounted under /faculty or /student
router.get('/exams', authenticateToken, (req, res, next) => {
  if (req.baseUrl.endsWith('/faculty')) return examsController.getFacultyExams(req, res, next)
  if (req.baseUrl.endsWith('/student')) return examsController.getStudentExams(req, res, next)
  return examsController.listExams(req, res, next)
})

// Standard /exams CRUD & Question Management
router.get('/', authenticateToken, examsController.listExams)
router.post('/', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.createExam)
router.get('/:id', authenticateToken, examsController.getExam)
router.put('/:id', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.updateExam)
router.patch('/:id', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.updateExam)
router.delete('/:id', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.deleteExam)
router.post('/:id/publish', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.publishExam)

// AI Question Generator
router.post('/:id/generate-questions', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsOpsController.generateQuestions)

// Question Management
router.post('/:id/questions', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.addQuestion)
router.post('/:id/questions/bulk', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.bulkAddQuestions)
router.post('/:id/questions/upload', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.uploadQuestionsMiddleware, examsController.uploadQuestionsExcel)
router.delete('/:id/questions/:questionId', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.deleteQuestion)

// Invigilator Management
router.get('/:id/invigilators', authenticateToken, requireRole('FACULTY', 'ADMIN', 'INVIGILATOR'), examsOpsController.listInvigilators)
router.post('/:id/invigilators', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsOpsController.generateInvigilator)
router.delete('/:id/invigilators/:userId', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsOpsController.removeInvigilator)

// Assignment, Attempts & Results
router.post('/:id/assign', authenticateToken, requireRole('FACULTY', 'ADMIN'), examsController.assignUser)
router.get('/:id/attempts', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), examsController.getExamAttempts)
router.get('/:id/results/export', authenticateToken, requireRole('INVIGILATOR', 'FACULTY', 'ADMIN'), examsController.exportResultsCsv)

module.exports = router
