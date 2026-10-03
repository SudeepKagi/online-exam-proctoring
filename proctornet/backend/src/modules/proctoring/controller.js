const express = require('express')
const { proctoringService } = require('./service')
const {
  attemptIdParamSchema,
  examIdParamSchema,
  recordViolationSchema,
  postChatMessageSchema
} = require('./validation')
const { validateBody, validateParams } = require('../../middleware/validation')
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

module.exports = router
