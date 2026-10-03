const express = require('express')
const { submissionService } = require('./service')
const {
  attemptIdParamSchema,
  submitHeadersSchema,
  submitBodySchema
} = require('./validation')
const { validateBody, validateParams, validateHeaders } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { ValidationError } = require('../../shared/errors')

const router = express.Router()

/**
 * POST /api/v1/attempts/:attemptId/submission
 * Idempotent transactional exam submit (Student)
 */
router.post(
  '/attempts/:attemptId/submission',
  requireAuth,
  requireRole('STUDENT'),
  validateParams(attemptIdParamSchema),
  validateHeaders(submitHeadersSchema),
  validateBody(submitBodySchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const studentId = req.user.id
      const idempotencyKey = req.headers['idempotency-key']

      if (!idempotencyKey) {
        throw new ValidationError('Idempotency-Key header is required')
      }

      const answers = req.body?.answers || []

      const result = await submissionService.submitAttempt(
        attemptId,
        studentId,
        idempotencyKey,
        answers
      )

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
