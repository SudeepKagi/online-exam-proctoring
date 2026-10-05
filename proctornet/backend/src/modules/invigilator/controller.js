const express = require('express')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { ROLES } = require('../../shared/roles')
const authService = require('../auth/service')
const { proctoringService } = require('../proctoring/service')
const { prisma } = require('../../infra/postgres/client')
const { NotFoundError } = require('../../shared/errors')
const { getClientIp } = require('../../utils/helpers')

const router = express.Router()

// ── Public: Invigilator login ──
router.post('/login', async (req, res, next) => {
  try {
    const { invId, invPassword, examId } = req.body
    const ipAddress = getClientIp(req)
    const result = await authService.invigilatorLogin({ invId, invPassword, examId, ipAddress })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// ── Protected: invigilator, faculty, admin ──
router.use(requireAuth, requireRole([ROLES.INVIGILATOR, ROLES.FACULTY, ROLES.ADMIN]))

router.get(['/exam/:examId', '/live-grid/:examId'], async (req, res, next) => {
  try {
    const summary = await proctoringService.getExamSummary(req.params.examId, req.user)
    const roster = await proctoringService.getExamRoster(req.params.examId, req.user)
    res.status(200).json({ success: true, summary, roster: roster.items })
  } catch (err) {
    next(err)
  }
})

router.get('/exams/:examId/students', async (req, res, next) => {
  try {
    const roster = await proctoringService.getExamRoster(req.params.examId, req.user)
    res.status(200).json({ success: true, students: roster.items })
  } catch (err) {
    next(err)
  }
})

router.get('/violations', async (req, res, next) => {
  try {
    const examId = req.query.examId || req.user.examId
    if (!examId) return res.status(400).json({ error: 'examId is required' })
    const violations = await proctoringService.getExamViolations(examId, req.user, req.query)
    res.status(200).json({ success: true, ...violations })
  } catch (err) {
    next(err)
  }
})

router.post('/violations/:id/action', async (req, res, next) => {
  try {
    const result = await proctoringService.acknowledgeViolation(req.params.id, req.user)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/send-warning', async (req, res, next) => {
  try {
    const { studentId, message, examId = req.user.examId } = req.body
    const attempt = await prisma.examAttempt.findFirst({
      where: { studentId, ...(examId ? { examId } : {}) },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.warnCandidate(attempt.id, req.user, message, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/exam/:examId/warn/:studentId', async (req, res, next) => {
  try {
    const { examId, studentId } = req.params
    const { message } = req.body
    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.warnCandidate(attempt.id, req.user, message, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/pause-student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    const examId = req.body.examId || req.user.examId
    const attempt = await prisma.examAttempt.findFirst({
      where: { studentId, ...(examId ? { examId } : {}) },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.pauseAttempt(attempt.id, req.user, req.body.reason, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/resume-student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    const examId = req.body.examId || req.user.examId
    const attempt = await prisma.examAttempt.findFirst({
      where: { studentId, ...(examId ? { examId } : {}) },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.resumeAttempt(attempt.id, req.user, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/terminate-student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params
    const examId = req.body.examId || req.user.examId
    const attempt = await prisma.examAttempt.findFirst({
      where: { studentId, ...(examId ? { examId } : {}) },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.terminateAttempt(attempt.id, req.user, req.body.reason, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/exam/:examId/terminate/:studentId', async (req, res, next) => {
  try {
    const { examId, studentId } = req.params
    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId },
      orderBy: { createdAt: 'desc' }
    })
    if (!attempt) throw new NotFoundError('Candidate attempt not found')

    const io = req.app.get('io')
    const result = await proctoringService.terminateAttempt(attempt.id, req.user, req.body.reason, io)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
