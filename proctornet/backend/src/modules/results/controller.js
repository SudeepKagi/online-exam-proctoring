const express = require('express')
const { resultService } = require('./service')
const {
  attemptIdParamSchema,
  examIdParamSchema
} = require('./validation')
const { validateParams } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')

const router = express.Router()

/**
 * GET /api/v1/attempts/:attemptId/result
 * Get student result (enforces release policy)
 */
router.get(
  '/attempts/:attemptId/result',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const studentId = req.user.id

      if (req.user.role === 'STUDENT') {
        const result = await resultService.getResultForStudent(attemptId, studentId)
        return res.status(200).json(result)
      }

      // Faculty / Admin
      const result = await resultService.getResultForStudent(attemptId, req.user.id)
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/exams/:examId/results
 * Get all results for an exam (Faculty / Admin)
 */
router.get(
  '/exams/:examId/results',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const results = await resultService.getResultsForExam(examId, req.user.id, req.user.role)
      return res.status(200).json(results)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/exams/:examId/results/release
 * Release exam results to students (Faculty / Admin)
 */
router.post(
  '/exams/:examId/results/release',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const outcome = await resultService.releaseResults(examId, req.user.id, req.user.role)
      return res.status(200).json(outcome)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
