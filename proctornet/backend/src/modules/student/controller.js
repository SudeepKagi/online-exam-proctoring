const express = require('express')
const studentService = require('./service')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { validateBody } = require('../../middleware/validation')
const {
  updateProfileSchema,
  consentSchema,
  createTicketSchema,
  identityVerifySchema
} = require('./validation')
const { ValidationError } = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')

const router = express.Router()

// All student routes require STUDENT role
router.use(requireAuth, requireRole(ROLES.STUDENT))

// ── Exam listing & details ──
router.get('/exams', async (req, res, next) => {
  try {
    const exams = await studentService.listMyExams(req.user.id)
    res.status(200).json({ success: true, exams })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await studentService.getExamDetails(req.params.id, req.user.id)
    res.status(200).json({ success: true, exam })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/lobby', async (req, res, next) => {
  try {
    const lobby = await studentService.getExamLobby(req.params.id, req.user.id)
    res.status(200).json({ success: true, ...lobby })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:id/start', async (req, res, next) => {
  try {
    const attempt = await studentService.startExam(req.params.id, req.user.id)
    res.status(200).json({ success: true, attempt })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:id/start', async (req, res, next) => {
  try {
    const attempt = await studentService.startExam(req.params.id, req.user.id)
    res.status(200).json({ success: true, attempt })
  } catch (err) {
    next(err)
  }
})



// ── Chat ──
router.get('/exams/:id/chat', async (req, res, next) => {
  try {
    const messages = await studentService.getChatHistory(req.params.id, req.user.id)
    res.status(200).json({ success: true, messages })
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:id/chat', async (req, res, next) => {
  try {
    const { proctoringService } = require('../proctoring/service')
    const message = await proctoringService.postChatMessage(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body.message
    )
    res.status(200).json({ success: true, message })
  } catch (err) {
    next(err)
  }
})



// ── Results ──
router.get('/results', async (req, res, next) => {
  try {
    const results = await studentService.getMyResults(req.user.id)
    res.status(200).json({ success: true, results })
  } catch (err) {
    next(err)
  }
})

// ── Profile ──
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await studentService.getProfile(req.user.id)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

router.put('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const profile = await studentService.updateProfile(req.user.id, req.body)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

router.patch('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const profile = await studentService.updateProfile(req.user.id, req.body)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

// ── Verification ──
router.post(['/verify-face', '/exams/:id/verify-face'], async (req, res, next) => {
  try {
    const result = await studentService.verifyFace(req.user.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post(['/verify-id', '/exams/:id/verify-id'], async (req, res, next) => {
  try {
    const result = await studentService.verifyIdCard(req.user.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/exams/:id/identity-verify', validateBody(identityVerifySchema), async (req, res, next) => {
  try {
    const result = await studentService.saveIdentityVerification(req.params.id, req.user.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// ── Support Tickets ──
router.post('/support/ticket', validateBody(createTicketSchema), async (req, res, next) => {
  try {
    const ticket = await studentService.createSupportTicket(req.user.id, req.body)
    res.status(201).json(ticket)
  } catch (err) {
    next(err)
  }
})

router.get('/support/tickets', async (req, res, next) => {
  try {
    const tickets = await studentService.listSupportTickets(req.user.id)
    res.status(200).json({ success: true, tickets })
  } catch (err) {
    next(err)
  }
})

// ── Enrollment ──
router.post('/enrollment/consent', validateBody(consentSchema), async (req, res, next) => {
  try {
    const profile = await studentService.submitConsent(req.user.id)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

router.post('/enrollment/face', async (req, res, next) => {
  try {
    const photoKey = req.body.facePhotoKey || req.body.key
    if (!photoKey) {
      throw new ValidationError('facePhotoKey is required')
    }
    const profile = await studentService.enrollFace(req.user.id, photoKey)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

router.post('/enrollment/id', async (req, res, next) => {
  try {
    const idKey = req.body.idCardPhotoKey || req.body.key
    if (!idKey) {
      throw new ValidationError('idCardPhotoKey is required')
    }
    const profile = await studentService.enrollIdDocument(req.user.id, idKey)
    res.status(200).json({ success: true, student: profile })
  } catch (err) {
    next(err)
  }
})

router.get('/enrollment/status', async (req, res, next) => {
  try {
    const status = await studentService.getEnrollmentStatus(req.user.id)
    res.status(200).json({ success: true, ...status })
  } catch (err) {
    next(err)
  }
})

module.exports = router
