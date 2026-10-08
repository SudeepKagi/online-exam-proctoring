const express = require('express')
const { proctoringService } = require('./service')
const {
  attemptIdParamSchema,
  examIdParamSchema,
  recordViolationSchema,
  liveKitTokenSchema,
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

const { ROLES } = require('../../shared/roles')

const router = express.Router()

/**
 * POST /api/v1/proctoring/token
 * Issue LiveKit WebRTC Access Token (P7 Task 7.2)
 */
router.post(
  '/proctoring/token',
  requireAuth,
  validateBody(liveKitTokenSchema),
  async (req, res, next) => {
    try {
      const { mediaService } = require('../media/media.service')
      const result = await mediaService.issueToken(req.user, req.body)
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/attempts/:attemptId/violations
 * Record client-detected violation (Student)
 */
router.post(
  '/attempts/:attemptId/violations',
  requireAuth,
  requireRole(ROLES.STUDENT),
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
 * Post chat message (Defects D-01 / D-04 Fix)
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
        req.user,
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
 * Fetch chat message history (Defects D-01 / D-04 Fix)
 */
router.get(
  '/exams/:examId/chat',
  requireAuth,
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const studentId = req.user.role === ROLES.STUDENT ? req.user.id : req.query.studentId
      const beforeId = req.query.beforeId || null
      const limit = parseInt(req.query.limit || '50', 10)

      const history = await proctoringService.getChatHistory(examId, req.user, studentId, limit, beforeId)
      return res.status(200).json(history)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId/timeline
 * Fetch violation event timeline with presigned read URLs (Defect D-02 Fix)
 */
router.get(
  '/attempts/:attemptId/timeline',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const timeline = await proctoringService.getViolationTimeline(attemptId, req.user)
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  ['/proctoring/attempts/:attemptId/pause', '/attempts/:attemptId/pause'],
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  ['/proctoring/attempts/:attemptId/resume', '/attempts/:attemptId/resume'],
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  ['/proctoring/attempts/:attemptId/terminate', '/attempts/:attemptId/terminate'],
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
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

/**
 * POST /api/v1/proctoring/exams/:id/snapshots/read
 * Batch endpoint for live frames (FLW-05)
 * Accepts up to 24 attempt IDs, returns URLs + frameAt
 */
router.post(
  '/proctoring/exams/:id/snapshots/read',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR]),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const examId = req.params.id
      await proctoringService.assertStaffExamAccess(req.user, examId)

      const attemptIds = Array.isArray(req.body.attemptIds) ? req.body.attemptIds.slice(0, 24) : []
      if (attemptIds.length === 0) {
        return res.status(200).json({ success: true, snapshots: {}, frameAt: Date.now() })
      }

      const s3Client = require('../../infra/s3/s3.client')
      const snapshots = {}
      await Promise.all(
        attemptIds.map(async (attemptId) => {
          try {
            const cameraKey = s3Client.buildLiveSnapshotKey(examId, attemptId, 'camera')
            const screenKey = s3Client.buildLiveSnapshotKey(examId, attemptId, 'screen')
            const [cameraUrl, screenUrl] = await Promise.all([
              s3Client.getPresignedReadUrl(cameraKey, 120),
              s3Client.getPresignedReadUrl(screenKey, 120)
            ])
            snapshots[attemptId] = {
              cameraUrl,
              screenUrl,
              frameAt: Date.now()
            }
          } catch (err) {
            snapshots[attemptId] = { error: err.message, cameraUrl: null, screenUrl: null, frameAt: Date.now() }
          }
        })
      )

      return res.status(200).json({ success: true, snapshots, frameAt: Date.now() })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router


