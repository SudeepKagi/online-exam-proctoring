const express = require('express')
const multer = require('multer')
const adminService = require('./service')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { validateBody } = require('../../middleware/validation')
const {
  createFacultySchema,
  createStudentSchema,
  rejectReasonSchema,
  updateSettingsSchema,
  createAnnouncementSchema,
  confirmBulkSchema,
  overrideEnrollmentSchema,
  createDepartmentSchema
} = require('./validation')
const { ROLES } = require('../../shared/roles')

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })
const router = express.Router()

// All admin routes require ADMIN role
router.use(requireAuth, requireRole(ROLES.ADMIN))

// ── Departments ──
router.get('/departments', async (req, res, next) => {
  try {
    const departments = await adminService.listDepartments()
    res.status(200).json({ success: true, departments })
  } catch (err) {
    next(err)
  }
})

router.post('/departments', validateBody(createDepartmentSchema), async (req, res, next) => {
  try {
    const department = await adminService.createDepartment(req.body)
    res.status(201).json({ success: true, department })
  } catch (err) {
    next(err)
  }
})

// ── Dashboard ──
router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await adminService.getDashboard()
    res.status(200).json({ success: true, stats })
  } catch (err) {
    next(err)
  }
})

// ── Faculty ──
router.get('/faculty', async (req, res, next) => {
  try {
    const result = await adminService.listFaculty(req.query)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.get('/faculty/pending', async (req, res, next) => {
  try {
    const faculty = await adminService.listPendingFaculty()
    res.status(200).json({ success: true, faculty })
  } catch (err) {
    next(err)
  }
})

router.post('/faculty', validateBody(createFacultySchema), async (req, res, next) => {
  try {
    const faculty = await adminService.createFaculty(req.body)
    res.status(201).json({ success: true, faculty })
  } catch (err) {
    next(err)
  }
})

router.patch('/faculty/:id/approve', async (req, res, next) => {
  try {
    const faculty = await adminService.approveFaculty(req.params.id, req.user.id)
    res.status(200).json({ success: true, faculty })
  } catch (err) {
    next(err)
  }
})

router.patch('/faculty/:id/reject', async (req, res, next) => {
  try {
    const result = await adminService.rejectFaculty(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.patch('/faculty/:id/suspend', async (req, res, next) => {
  try {
    const faculty = await adminService.setFacultySuspension(req.params.id, true)
    res.status(200).json({ success: true, faculty })
  } catch (err) {
    next(err)
  }
})

router.patch('/faculty/:id/unsuspend', async (req, res, next) => {
  try {
    const faculty = await adminService.setFacultySuspension(req.params.id, false)
    res.status(200).json({ success: true, faculty })
  } catch (err) {
    next(err)
  }
})

// ── Students ──
router.get('/students', async (req, res, next) => {
  try {
    const result = await adminService.listStudents(req.query)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.get('/students/pending', async (req, res, next) => {
  try {
    const students = await adminService.listPendingStudents()
    res.status(200).json({ success: true, students })
  } catch (err) {
    next(err)
  }
})

router.post('/students', validateBody(createStudentSchema), async (req, res, next) => {
  try {
    const student = await adminService.createStudent(req.body)
    res.status(201).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.patch('/students/:id/approve', async (req, res, next) => {
  try {
    const student = await adminService.approveStudent(req.params.id, req.user.id)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.patch('/students/:id/reject', validateBody(rejectReasonSchema), async (req, res, next) => {
  try {
    const student = await adminService.rejectStudent(req.params.id, req.body.reason)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.patch('/students/:id/suspend', async (req, res, next) => {
  try {
    const student = await adminService.setStudentSuspension(req.params.id, true)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.patch('/students/:id/unsuspend', async (req, res, next) => {
  try {
    const student = await adminService.setStudentSuspension(req.params.id, false)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

// ── Exam Oversight ──
router.get(['/exams', '/exams/all'], async (req, res, next) => {
  try {
    const result = await adminService.listExams(req.query)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await adminService.getExam(req.params.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/invigilator-credentials', async (req, res, next) => {
  try {
    const exam = await adminService.getExam(req.params.id)
    res.status(200).json({
      success: true,
      examId: exam.id,
      invId: exam.invId
    })
  } catch (err) {
    next(err)
  }
})

router.post(['/exams/:id/invigilator-credentials/regenerate', '/exams/:id/invigilator-credentials/reset'], async (req, res, next) => {
  try {
    const credentials = await adminService.resetExamInvigilatorCredentials(req.params.id, req.user)
    res.status(200).json({ success: true, credentials })
  } catch (err) {
    next(err)
  }
})

router.patch('/exams/:id/pause', async (req, res, next) => {
  try {
    const exam = await adminService.setExamPaused(req.params.id, true, req.user, req.body.reason)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.patch('/exams/:id/resume', async (req, res, next) => {
  try {
    const exam = await adminService.setExamPaused(req.params.id, false, req.user)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

// ── Invigilator Sessions ──
router.get('/invigilator-sessions', async (req, res, next) => {
  try {
    const sessions = await adminService.listInvigilatorSessions()
    res.status(200).json({ success: true, sessions })
  } catch (err) {
    next(err)
  }
})

router.patch('/invigilator-sessions/:id/revoke', async (req, res, next) => {
  try {
    const session = await adminService.revokeInvigilatorSession(req.params.id)
    res.status(200).json({ success: true, session })
  } catch (err) {
    next(err)
  }
})

// ── Settings ──
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await adminService.getSettings()
    res.status(200).json({ success: true, settings })
  } catch (err) {
    next(err)
  }
})

router.patch('/settings', validateBody(updateSettingsSchema), async (req, res, next) => {
  try {
    const updated = await adminService.updateSettings(req.body, req.user.id)
    res.status(200).json({ success: true, updated })
  } catch (err) {
    next(err)
  }
})

// ── Audit Logs ──
router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await adminService.getAuditLogs(req.query)
    res.status(200).json({ success: true, ...logs })
  } catch (err) {
    next(err)
  }
})

// ── Violations ──
router.get('/violations', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10)
    const violations = await adminService.getViolations(limit)
    res.status(200).json({ success: true, violations })
  } catch (err) {
    next(err)
  }
})

router.get('/violations/summary', async (req, res, next) => {
  try {
    const summary = await adminService.getViolationsSummary()
    res.status(200).json({ success: true, summary })
  } catch (err) {
    next(err)
  }
})

// ── Announcements ──
router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await adminService.listAnnouncements()
    res.status(200).json({ success: true, announcements })
  } catch (err) {
    next(err)
  }
})

router.post('/announcements', validateBody(createAnnouncementSchema), async (req, res, next) => {
  try {
    const announcement = await adminService.createAnnouncement(req.body, req.user.id)
    res.status(201).json({ success: true, announcement })
  } catch (err) {
    next(err)
  }
})

router.delete('/announcements/:id', async (req, res, next) => {
  try {
    await adminService.deleteAnnouncement(req.params.id)
    res.status(200).json({ success: true, message: 'Announcement deleted' })
  } catch (err) {
    next(err)
  }
})

// ── Bulk Upload ──
router.post('/bulk-upload/parse', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Missing file upload' })
    }
    const rows = await adminService.parseBulkBuffer(req.file.buffer)
    res.status(200).json({ success: true, total: rows.length, rows })
  } catch (err) {
    next(err)
  }
})

router.post('/bulk-upload/confirm', express.json({ limit: '10mb' }), validateBody(confirmBulkSchema), async (req, res, next) => {
  try {
    const type = req.body.type || req.body.role
    const accounts = req.body.accounts || req.body.records
    const result = await adminService.confirmBulkCreate(type, accounts)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// ── Reports ──
router.get('/reports', async (req, res, next) => {
  try {
    const stats = await adminService.getDashboard()
    const violations = await adminService.getViolationsSummary()
    res.status(200).json({ success: true, report: { stats, violations, generatedAt: new Date().toISOString() } })
  } catch (err) {
    next(err)
  }
})

// ── Biometric Overrides / Enrollments ──
router.get('/enrollments', async (req, res, next) => {
  try {
    const students = await adminService.listPendingStudents()
    res.status(200).json({ success: true, enrollments: students })
  } catch (err) {
    next(err)
  }
})

router.post('/enrollments/:id/approve', async (req, res, next) => {
  try {
    const student = await adminService.approveStudent(req.params.id, req.user.id)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.post('/enrollments/:id/reject', validateBody(rejectReasonSchema), async (req, res, next) => {
  try {
    const student = await adminService.rejectStudent(req.params.id, req.body.reason)
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

router.post('/enrollments/override', validateBody(overrideEnrollmentSchema), async (req, res, next) => {
  try {
    const student = await adminService.overrideEnrollment(
      req.body.studentId,
      req.body.status,
      req.body.reason,
      req.user.id
    )
    res.status(200).json({ success: true, student })
  } catch (err) {
    next(err)
  }
})

// ── Support Tickets ──
router.get('/support/tickets', async (req, res, next) => {
  try {
    const { supportService } = require('../support/supportService')
    const tickets = await supportService.listAllTickets(req.query.status)
    res.status(200).json({ success: true, tickets })
  } catch (err) {
    next(err)
  }
})

router.patch('/support/tickets/:id', async (req, res, next) => {
  try {
    const { supportService } = require('../support/supportService')
    const result = await supportService.resolveTicket(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
