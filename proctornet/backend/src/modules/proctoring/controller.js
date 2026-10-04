const express = require('express')
const { proctoringService } = require('./service')
const {
  attemptIdParamSchema,
  examIdParamSchema,
  recordViolationSchema,
  postChatMessageSchema,
  rosterQuerySchema,
  violationsQuerySchema,
  warnCandidateSchema,
  actionReasonSchema
} = require('./validation')
const { validateBody, validateParams, validateQuery } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { routeRateLimiters } = require('../../middleware/rateLimit')

const router = express.Router()

/**
 * POST /api/v1/attempts/:attemptId/violations
 * Record client-detected violation (Student)
 */
router.post(
  '/attempts/:attemptId/violations',
  requireAuth,
  requireRole('STUDENT'),
  routeRateLimiters.violations,
  validateParams(attemptIdParamSchema),
  validateBody(recordViolationSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { eventType, metadata, clientTimestamp } = req.body
      const studentId = req.user.id

      const result = await proctoringService.recordViolation(
        attemptId,
        studentId,
        eventType,
        metadata,
        clientTimestamp
      )

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/exams/:examId/chat
 * Post chat message
 */
router.post(
  '/exams/:examId/chat',
  requireAuth,
  validateParams(examIdParamSchema),
  validateBody(postChatMessageSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const { message, studentId } = req.body

      const result = await proctoringService.postChatMessage(
        examId,
        req.user.id,
        req.user.role,
        message,
        studentId
      )

      return res.status(200).json({ success: true, message: result })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/exams/:examId/chat
 * Fetch chat message history
 */
router.get(
  '/exams/:examId/chat',
  requireAuth,
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const studentId = req.user.role === 'STUDENT' ? req.user.id : req.query.studentId
      const beforeId = req.query.beforeId || null
      const limit = parseInt(req.query.limit || '50', 10)

      const history = await proctoringService.getChatHistory(examId, studentId, limit, beforeId)
      return res.status(200).json(history)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId/timeline
 * Fetch violation event timeline with presigned read URLs
 */
router.get(
  '/attempts/:attemptId/timeline',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const timeline = await proctoringService.getViolationTimeline(attemptId)
      return res.status(200).json(timeline)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/proctoring/exams/:examId/summary
 * Aggregate metrics and live presence count (Task 6)
 */
router.get(
  '/proctoring/exams/:examId/summary',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const summary = await proctoringService.getExamSummary(req.params.examId, req.user)
      return res.status(200).json(summary)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/proctoring/exams/:examId/roster
 * Keyset paginated candidate roster with presigned thumbnails (Task 6)
 */
router.get(
  '/proctoring/exams/:examId/roster',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(examIdParamSchema),
  validateQuery(rosterQuerySchema),
  async (req, res, next) => {
    try {
      const { limit, cursor, status, q } = req.query
      const roster = await proctoringService.getExamRoster(req.params.examId, req.user, {
        limit,
        cursor,
        status,
        q
      })
      return res.status(200).json(roster)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/proctoring/attempts/:attemptId/violations
 * Keyset paginated violations for an attempt (Task 6)
 */
router.get(
  '/proctoring/attempts/:attemptId/violations',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(attemptIdParamSchema),
  validateQuery(violationsQuerySchema),
  async (req, res, next) => {
    try {
      const { limit, cursor } = req.query
      const violations = await proctoringService.getAttemptViolations(req.params.attemptId, req.user, {
        limit,
        cursor
      })
      return res.status(200).json(violations)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/proctoring/exams/:examId/violations
 * Keyset paginated violations across exam (Task 6)
 */
router.get(
  '/proctoring/exams/:examId/violations',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(examIdParamSchema),
  validateQuery(violationsQuerySchema),
  async (req, res, next) => {
    try {
      const { limit, cursor, severity, type } = req.query
      const violations = await proctoringService.getExamViolations(req.params.examId, req.user, {
        limit,
        cursor,
        severity,
        type
      })
      return res.status(200).json(violations)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/proctoring/attempts/:attemptId/warn
 * Dispatch proctor warning to student (Task 7)
 */
router.post(
  '/proctoring/attempts/:attemptId/warn',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(attemptIdParamSchema),
  validateBody(warnCandidateSchema),
  async (req, res, next) => {
    try {
      const io = req.app.get('io')
      const result = await proctoringService.warnCandidate(
        req.params.attemptId,
        req.user,
        req.body.message,
        io
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/proctoring/attempts/:attemptId/pause
 * Pause student attempt (Task 7)
 */
router.post(
  '/proctoring/attempts/:attemptId/pause',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(attemptIdParamSchema),
  validateBody(actionReasonSchema),
  async (req, res, next) => {
    try {
      const io = req.app.get('io')
      const result = await proctoringService.pauseAttempt(
        req.params.attemptId,
        req.user,
        req.body.reason,
        io
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/proctoring/attempts/:attemptId/resume
 * Resume student attempt (Task 7)
 */
router.post(
  '/proctoring/attempts/:attemptId/resume',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const io = req.app.get('io')
      const result = await proctoringService.resumeAttempt(
        req.params.attemptId,
        req.user,
        io
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/proctoring/attempts/:attemptId/terminate
 * Terminate student attempt (Task 7)
 */
router.post(
  '/proctoring/attempts/:attemptId/terminate',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  validateParams(attemptIdParamSchema),
  validateBody(actionReasonSchema),
  async (req, res, next) => {
    try {
      const io = req.app.get('io')
      const result = await proctoringService.terminateAttempt(
        req.params.attemptId,
        req.user,
        req.body.reason,
        io
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/proctoring/violations/:violationId/acknowledge
 * Acknowledge violation event (Task 7)
 */
router.post(
  '/proctoring/violations/:violationId/acknowledge',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY', 'INVIGILATOR']),
  async (req, res, next) => {
    try {
      const result = await proctoringService.acknowledgeViolation(
        req.params.violationId,
        req.user
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router

