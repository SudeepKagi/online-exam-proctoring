const express = require('express')
const { questionService } = require('./service')
const {
  questionIdParamSchema,
  examIdParamSchema,
  createQuestionSchema
} = require('./validation')
const { validateBody, validateParams } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')

const router = express.Router()

/**
 * POST /api/v1/exams/:examId/questions
 * Add question to exam (Draft status only)
 */
router.post(
  '/exams/:examId/questions',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  validateBody(createQuestionSchema),
  async (req, res, next) => {
    try {
      const result = await questionService.createQuestion(
        req.params.examId,
        req.body,
        req.user.id,
        req.user.role
      )
      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * DELETE /api/v1/questions/:questionId
 * Remove question from exam (Draft status only)
 */
router.delete(
  '/questions/:questionId',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(questionIdParamSchema),
  async (req, res, next) => {
    try {
      const result = await questionService.deleteQuestion(
        req.params.questionId,
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
