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
const { ROLES } = require('../../shared/roles')
const { toInvigilatorAttemptDTO } = require('./dto')
const { prisma } = require('../../infra/postgres/client')
const { NotFoundError, ForbiddenError } = require('../../shared/errors')
const { vpnGuard } = require('../../middleware/vpnGuard')
const express = require('express')

const router = express.Router()

/**
 * POST /api/v1/exams/:examId/readiness
 * Initialize READY attempt without starting clock (Pre-exam security check)
 */
router.post(
  '/exams/:examId/readiness',
  requireAuth,
  requireRole(ROLES.STUDENT),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params
      const studentId = req.user.id

      const result = await attemptService.getOrCreateReadinessAttempt(examId, studentId)
      return res.status(200).json(result.attempt)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/exams/:examId/attempt
 * Start or resume exam attempt (Student activation)
 */
router.post(
  '/exams/:examId/attempt',
  requireAuth,
  requireRole(ROLES.STUDENT),
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
 * GET /api/v1/attempts/:attemptId/vpn-status
 * Server-verified VPN tunnel status
 */
router.get(
  '/attempts/:attemptId/vpn-status',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { exam: true }
      })
      if (!attempt) throw new NotFoundError('Attempt not found')

      const isVpnEnabled = process.env.VPN_ENABLED === 'true'
      const isEnforcing = (process.env.VPN_ENFORCEMENT || '').toLowerCase() === 'enforce'
      const vpnRequired = Boolean(attempt.exam?.vpnRequired)

      if (!vpnRequired || !isVpnEnabled || !isEnforcing) {
        return res.status(200).json({
          required: false,
          verified: true,
          message: 'VPN tunnel is not required for this exam.'
        })
      }

      const lease = await prisma.vpnIpPool.findFirst({
        where: { attemptId }
      })
      const verified = Boolean(lease && lease.ip)

      return res.status(200).json({
        required: true,
        verified,
        leasedIp: lease?.ip || null,
        message: verified ? 'VPN tunnel active and verified.' : 'No active VPN tunnel lease found.'
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId/identity-status
 * Polling fallback for identity verification decisions (REVIEW -> PASS/FAIL)
 */
router.get(
  '/attempts/:attemptId/identity-status',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId }
      })
      if (!attempt) throw new NotFoundError('Attempt not found')

      const latestVerification = await prisma.identityVerification.findFirst({
        where: { attemptId },
        orderBy: { createdAt: 'desc' }
      })

      if (!latestVerification) {
        return res.status(200).json({
          decision: 'PENDING',
          verified: false,
          pendingReview: false
        })
      }

      const decision = latestVerification.decision
      return res.status(200).json({
        decision,
        verified: decision === 'PASS',
        pendingReview: decision === 'REVIEW',
        status: latestVerification.status,
        provider: latestVerification.provider,
        reason: latestVerification.thresholdsUsed?.reason || null
      })
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
  vpnGuard,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params

      if (req.user.role === ROLES.STUDENT) {
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

      // Staff authorization check
      if (req.user.role === ROLES.FACULTY && attempt.exam.facultyId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }
      if (req.user.role === ROLES.INVIGILATOR && req.user.examId !== attempt.examId) {
        throw new ForbiddenError('Access denied: You are not assigned to this exam')
      }

      return res.status(200).json(toInvigilatorAttemptDTO(attempt))
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId/state
 * Authoritative state resync endpoint (Notion 13.10 §10 / Task 5)
 * Returns current attempt status, expiry, revision, flagCount, and synchronized server clock.
 */
router.get(
  '/attempts/:attemptId/state',
  requireAuth,
  vpnGuard,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params

      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        select: {
          id: true,
          examId: true,
          studentId: true,
          status: true,
          revision: true,
          flagCount: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
          suspendedAt: true,
          totalSuspendedMs: true,
          exam: {
            select: {
              isPaused: true,
              pauseReason: true,
              facultyId: true
            }
          }
        }
      })

      if (!attempt) {
        throw new NotFoundError(`Attempt '${attemptId}' not found`)
      }

      // Authorization guard: Student must own attempt; Staff must have permission
      if (req.user.role === ROLES.STUDENT && attempt.studentId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not own this attempt')
      }
      if (req.user.role === ROLES.FACULTY && attempt.exam.facultyId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not own this exam')
      }
      if (req.user.role === ROLES.INVIGILATOR && req.user.examId !== attempt.examId) {
        throw new ForbiddenError('Access denied: You are not assigned to this exam')
      }

      const now = new Date()
      return res.status(200).json({
        id: attempt.id,
        examId: attempt.examId,
        studentId: attempt.studentId,
        status: attempt.status,
        revision: attempt.revision,
        flagCount: attempt.flagCount,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: attempt.submittedAt,
        isPaused: attempt.exam.isPaused,
        pauseReason: attempt.exam.pauseReason,
        serverTime: now.toISOString(),
        serverEpochMs: now.getTime()
      })
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
  requireRole([ROLES.ADMIN, ROLES.FACULTY]),
  validateParams(attemptIdParamSchema),
  validateBody(transitionStateSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { status, reason } = req.body

      if (req.user.role === ROLES.FACULTY) {
        const attempt = await prisma.examAttempt.findUnique({
          where: { id: attemptId },
          include: { exam: true }
        })
        if (!attempt || attempt.exam.facultyId !== req.user.id) {
          throw new ForbiddenError('Access denied: You do not own this exam')
        }
      }

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
  requireRole([ROLES.ADMIN, ROLES.FACULTY]),
  validateParams(examIdParamSchema),
  async (req, res, next) => {
    try {
      const { examId } = req.params

      if (req.user.role === ROLES.FACULTY) {
        const exam = await prisma.exam.findFirst({
          where: { id: examId, facultyId: req.user.id },
          select: { id: true }
        })
        if (!exam) throw new ForbiddenError('Access denied: You do not own this exam')
      }

      const result = await attemptPrewarmJob.prewarmExam(examId)
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
