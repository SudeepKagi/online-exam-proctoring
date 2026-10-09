const express = require('express')
const multer = require('multer')
const facultyService = require('./service')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { validateBody } = require('../../middleware/validation')
const {
  createExamSchema,
  updateExamSchema,
  aiGenerateSchema
} = require('./validation')
const { ROLES } = require('../../shared/roles')

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const router = express.Router()

// All faculty routes require FACULTY role
router.use(requireAuth, requireRole(ROLES.FACULTY))

// ── Dashboard ──
router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await facultyService.getDashboard(req.user.id)
    res.status(200).json({ success: true, stats })
  } catch (err) {
    next(err)
  }
})

// ── Exam Management ──
router.get('/exams', async (req, res, next) => {
  try {
    const exams = await facultyService.listExams(req.user.id)
    res.status(200).json({ success: true, exams })
  } catch (err) {
    next(err)
  }
})

router.post('/exams', validateBody(createExamSchema), async (req, res, next) => {
  try {
    const exam = await facultyService.createExam(req.body, req.user.id)
    res.status(201).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await facultyService.getExam(req.params.id, req.user.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.patch('/exams/:id', validateBody(updateExamSchema), async (req, res, next) => {
  try {
    const exam = await facultyService.updateExam(req.params.id, req.body, req.user.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.delete('/exams/:id', async (req, res, next) => {
  try {
    const result = await facultyService.deleteExam(req.params.id, req.user.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post(['/exams/:id/publish', '/exams/:id/publish-alt'], async (req, res, next) => {
  try {
    const exam = await facultyService.publishExam(req.params.id, req.user.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.patch('/exams/:id/publish', async (req, res, next) => {
  try {
    const exam = await facultyService.publishExam(req.params.id, req.user.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/credentials', async (req, res, next) => {
  try {
    const credentials = await facultyService.getExamCredentials(req.params.id, req.user.id)
    res.status(200).json({ success: true, credentials })
  } catch (err) {
    next(err)
  }
})

router.post(['/exams/:id/invigilator-credentials/regenerate', '/exams/:id/regenerate-invigilator'], async (req, res, next) => {
  try {
    const credentials = await facultyService.regenerateInvigilatorCredentials(req.params.id, req.user.id)
    res.status(200).json({
      success: true,
      credentials,
      invCredentials: {
        invId: credentials.invId,
        password: credentials.oneTimePassword,
        validUntil: credentials.validUntil
      }
    })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:id/duplicate', async (req, res, next) => {
  try {
    const exam = await facultyService.duplicateExam(req.params.id, req.user.id)
    res.status(201).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

// ── Results ──
router.get('/results', async (req, res, next) => {
  try {
    const results = await facultyService.listAllResults(req.user.id)
    res.status(200).json({ success: true, results })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/results', async (req, res, next) => {
  try {
    const results = await facultyService.listExamResults(req.params.id, req.user.id)
    res.status(200).json({ success: true, results })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/export-csv', async (req, res, next) => {
  try {
    const { filename, csvContent } = await facultyService.exportExamResultsCSV(req.params.id, req.user.id)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(csvContent)
  } catch (err) {
    next(err)
  }
})

router.patch('/exams/:id/results/release', async (req, res, next) => {
  try {
    const outcome = await facultyService.releaseResults(req.params.id, req.user.id)
    res.status(200).json(outcome)
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/collusion', async (req, res, next) => {
  try {
    const report = await facultyService.runCollusionCheck(req.params.id, req.user.id)
    res.status(200).json({ success: true, report })
  } catch (err) {
    next(err)
  }
})

router.get('/results/:id', async (req, res, next) => {
  try {
    const result = await facultyService.getStudentResult(req.params.id, req.user.id)
    res.status(200).json({ success: true, result })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:examId/results/:studentId', async (req, res, next) => {
  try {
    const result = await facultyService.getStudentResultByExam(req.params.examId, req.params.studentId, req.user.id)
    res.status(200).json({ success: true, result })
  } catch (err) {
    next(err)
  }
})

// ── Questions ──
router.post('/exams/:examId/questions', async (req, res, next) => {
  try {
    const question = await facultyService.addQuestion(req.params.examId, req.body, req.user.id)
    res.status(201).json({ success: true, question })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:examId/questions', async (req, res, next) => {
  try {
    const questions = await facultyService.listExamQuestions(req.params.examId, req.user.id)
    res.status(200).json({ success: true, questions })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:examId/questions/import-excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Missing file upload' })
    }
    const result = await facultyService.importQuestionsExcel(req.params.examId, req.file.buffer, req.user.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:examId/ai-generate', validateBody(aiGenerateSchema), async (req, res, next) => {
  try {
    const questions = await facultyService.generateQuestionsFromAI(req.params.examId, req.body, req.user.id)
    res.status(201).json({ success: true, count: questions.length, questions })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/ai-generate-preview', validateBody(aiGenerateSchema), async (req, res, next) => {
  try {
    const preview = await facultyService.generateQuestionsPreview(req.body)
    const questions = preview?.questions || (Array.isArray(preview) ? preview : [])
    res.status(200).json({ success: true, count: questions.length, questions, preview })
  } catch (err) {
    next(err)
  }
})

router.put('/questions/:id', async (req, res, next) => {
  try {
    const question = await facultyService.updateQuestion(req.params.id, req.body, req.user.id)
    res.status(200).json({ success: true, question })
  } catch (err) {
    next(err)
  }
})

router.delete('/questions/:id', async (req, res, next) => {
  try {
    const result = await facultyService.deleteQuestion(req.params.id, req.user.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/questions/bulk', async (req, res, next) => {
  try {
    const { examId, questions } = req.body
    const created = await facultyService.bulkAddQuestions(examId, questions || [], req.user.id)
    res.status(201).json({ success: true, created })
  } catch (err) {
    next(err)
  }
})

router.post('/questions/import-excel', upload.single('file'), async (req, res, next) => {
  try {
    const examId = req.body.examId
    if (!examId) return res.status(400).json({ error: 'examId is required' })
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Missing file upload' })

    const result = await facultyService.importQuestionsExcel(examId, req.file.buffer, req.user.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// Legacy question endpoints
router.post('/questions', async (req, res, next) => {
  try {
    const examId = req.body.examId
    if (!examId) return res.status(400).json({ error: 'examId is required' })
    const question = await facultyService.addQuestion(examId, req.body, req.user.id)
    res.status(201).json({ success: true, question })
  } catch (err) {
    next(err)
  }
})

router.get('/questions', async (req, res, next) => {
  try {
    const examId = req.query.examId
    if (!examId) return res.status(400).json({ error: 'examId query parameter is required' })
    const questions = await facultyService.listExamQuestions(examId, req.user.id)
    res.status(200).json({ success: true, questions })
  } catch (err) {
    next(err)
  }
})

// ── Students ──
router.get('/students', async (req, res, next) => {
  try {
    const students = await facultyService.listStudents(req.user.departmentCode)
    res.status(200).json({ success: true, students })
  } catch (err) {
    next(err)
  }
})

router.patch('/students/:id/approve', async (req, res, next) => {
  try {
    const student = await facultyService.approveStudent(req.params.id, req.user.id)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:id/students', async (req, res, next) => {
  try {
    const studentIds = req.body.studentIds || []
    const result = await facultyService.addStudentsToExam(req.params.id, studentIds, req.user.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/students', async (req, res, next) => {
  try {
    const students = await facultyService.listExamStudents(req.params.id, req.user.id)
    res.status(200).json({ success: true, students })
  } catch (err) {
    next(err)
  }
})

module.exports = router
