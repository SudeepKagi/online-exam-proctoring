const express = require('express')
const { answerService } = require('./service')
const {
  attemptIdParamSchema,
  saveAnswerParamsSchema,
  saveAnswerBodySchema,
  batchSaveAnswersBodySchema
} = require('./validation')
const { validateBody, validateParams } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { routeRateLimiters } = require('../../middleware/rateLimit')
const { vpnGuard } = require('../../middleware/vpnGuard')

const router = express.Router()

/**
 * PUT /api/v1/attempts/:attemptId/answers/:attemptQuestionId
 * Autosave single answer with revision compare-and-set
 */
router.put(
  '/attempts/:attemptId/answers/:attemptQuestionId',
  requireAuth,
  requireRole('STUDENT'),
  vpnGuard,
  routeRateLimiters.autosave,
  validateParams(saveAnswerParamsSchema),
  validateBody(saveAnswerBodySchema),
  async (req, res, next) => {
    try {
      const { attemptId, attemptQuestionId } = req.params
      const { optionId, revision } = req.body
      const studentId = req.user.id

      const result = await answerService.saveAnswer(
        attemptId,
        studentId,
        attemptQuestionId,
        optionId,
        revision
      )

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * PUT /api/v1/attempts/:attemptId/answers
 * Batch sync dirty answers (<= 100 items)
 */
router.put(
  '/attempts/:attemptId/answers',
  requireAuth,
  requireRole('STUDENT'),
  vpnGuard,
  routeRateLimiters.autosave,
  validateParams(attemptIdParamSchema),
  validateBody(batchSaveAnswersBodySchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { answers } = req.body
      const studentId = req.user.id

      const result = await answerService.batchSaveAnswers(
        attemptId,
        studentId,
        answers
      )

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
