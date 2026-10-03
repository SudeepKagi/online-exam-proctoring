const express = require('express')
const { examService } = require('./service')
const {
  examIdParamSchema,
  createExamSchema,
  updateExamSchema
} = require('./validation')
const { validateBody, validateParams } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')

const router = express.Router()

/**
 * POST /api/v1/exams
 * Create draft exam (Faculty / Admin)
 */
router.post(
  '/exams',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateBody(createExamSchema),
  async (req, res, next) => {
    try {
      const result = await examService.createExam(req.body, req.user.id)
      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/exams/:examId
 * Get exam details
 */
router.get(
  '/exams/:examId',
  requireAuth,
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const result = await examService.getExam(req.params.examId, req.user)
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * PUT /api/v1/exams/:examId
 * Update exam details (Draft status only)
 */
router.put(
  '/exams/:examId',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  validateBody(updateExamSchema),
  async (req, res, next) => {
    try {
      const result = await examService.updateExam(
        req.params.examId,
        req.body,
        req.user.id,
        req.user.role
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/exams/:examId/publish
 * Validate MCQ invariants and publish exam (Faculty / Admin)
 */
router.post(
  '/exams/:examId/publish',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const result = await examService.publishExam(
        req.params.examId,
        req.user.id,
        req.user.role
      )
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
