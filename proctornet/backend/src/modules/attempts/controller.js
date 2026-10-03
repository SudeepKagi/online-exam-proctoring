const { attemptService } = require('./service')
const { attemptPrewarmJob } = require('./prewarmJob')
const {
  attemptIdParamSchema,
  examIdParamSchema,
  transitionStateSchema
} = require('./validation')
const { validateBody, validateParams } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { toInvigilatorAttemptDTO } = require('./dto')
const { prisma } = require('../../infra/postgres/client')
const { NotFoundError, ForbiddenError } = require('../../shared/errors')
const express = require('express')

const router = express.Router()

/**
 * POST /api/v1/exams/:examId/attempt
 * Start or resume exam attempt (Student)
 */
router.post(
  '/exams/:examId/attempt',
  requireAuth,
  requireRole('STUDENT'),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id

      const result = await attemptService.startOrResumeAttempt(examId, studentId)
      return res.status(200).json(result.attempt)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId
 * Read current attempt status and questions (Student or Invigilator/Faculty/Admin)
 */
router.get(
  '/attempts/:attemptId',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params

      if (req.user.role === 'STUDENT') {
        const studentAttempt = await attemptService.getAttemptForStudent(attemptId, req.user.id)
        return res.status(200).json(studentAttempt)
      }

      // Invigilator / Faculty / Admin view
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { exam: true, student: true }
      })

      if (!attempt) {
        throw new NotFoundError(`Attempt '${attemptId}' not found`)
      }

      // Faculty authorization check
      if (req.user.role === 'FACULTY' && attempt.exam.facultyId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }

      return res.status(200).json(toInvigilatorAttemptDTO(attempt))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/attempts/:attemptId/state
 * State machine transition (Invigilator / Faculty / Admin)
 */
router.post(
  '/attempts/:attemptId/state',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(attemptIdParamSchema),
  validateBody(transitionStateSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { status, reason } = req.body

      const updated = await attemptService.transitionState(attemptId, status, {
        actorId: req.user.id,
        actorRole: req.user.role.toLowerCase(),
        reason
      })

      return res.status(200).json({
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updated_at || updated.updatedAt
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/exams/:examId/prewarm
 * Trigger bulk pre-warm job (Faculty / Admin)
 */
router.post(
  '/exams/:examId/prewarm',
  requireAuth,
  requireRole(['ADMIN', 'FACULTY']),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const result = await attemptPrewarmJob.prewarmExam(examId)
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
