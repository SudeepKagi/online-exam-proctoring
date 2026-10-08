const express = require('express')
const { presignService } = require('./presignService')
const { presignUploadSchema, completeUploadSchema } = require('./validation')
const { validateBody } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { routeRateLimiters } = require('../../middleware/rateLimit')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')

const router = express.Router()

/**
 * POST /api/v1/uploads/presign
 * POST /api/v1/media/presign-upload
 * Direct client-to-S3 presigned upload policy (kills S-01 / S-03)
 */
const handlePresign = async (req, res, next) => {
  try {
    const result = await presignService.generateUploadPresignedUrl(req.user, req.body)
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

router.post(
  '/uploads/presign',
  requireAuth,
  routeRateLimiters.presign,
  validateBody(presignUploadSchema),
  handlePresign
)

router.post(
  '/media/presign-upload',
  requireAuth,
  routeRateLimiters.presign,
  validateBody(presignUploadSchema),
  handlePresign
)

/**
 * POST /api/v1/uploads/complete
 * POST /api/v1/media/complete-upload
 * Finalize direct upload, record key in DB, enqueue outbox event
 */
const handleComplete = async (req, res, next) => {
  try {
    const result = await presignService.completeUpload(req.user, req.body)
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

router.post(
  '/uploads/complete',
  requireAuth,
  validateBody(completeUploadSchema),
  handleComplete
)

router.post(
  '/media/complete-upload',
  requireAuth,
  validateBody(completeUploadSchema),
  handleComplete
)

/**
 * POST /api/v1/violations/:violationId/evidence/complete
 * POST /api/v1/attempts/:attemptId/violations/:violationId/evidence/complete
 * Verify uploaded evidence in S3 store and mark as UPLOADED (R2)
 */
const handleEvidenceComplete = async (req, res, next) => {
  try {
    const violationId = req.params.violationId || req.params.id || req.body.violationId
    const result = await presignService.completeEvidenceUpload(req.user, {
      violationId,
      ...req.body
    })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

router.post(
  '/violations/:violationId/evidence/complete',
  requireAuth,
  handleEvidenceComplete
)

router.post(
  '/attempts/:attemptId/violations/:violationId/evidence/complete',
  requireAuth,
  handleEvidenceComplete
)

const { prisma } = require('../../infra/postgres/client')
const { ForbiddenError, NotFoundError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

/**
 * Authorize read access to media assets based on user role and resource ownership (FLW-04)
 */
async function authorizeMediaView(user, key) {
  if (!user || !key) throw new ForbiddenError('Access denied: Missing user or asset key')
  const role = user.role?.toUpperCase()

  // 1. Identity / Enrollment keys:
  // e.g. identity/{studentId}/... or students/{studentId}/...
  const identityMatch = key.match(/^(?:identity|students)\/([^/]+)/)
  if (identityMatch) {
    const studentId = identityMatch[1]

    if (role === ROLES.STUDENT) {
      if (user.id !== studentId) {
        throw new ForbiddenError('Access denied: You can only view your own identity media')
      }
      return true
    }

    if (role === ROLES.FACULTY) {
      const studentAttempt = await prisma.examAttempt.findFirst({
        where: {
          studentId,
          exam: { facultyId: user.id }
        },
        select: { id: true, examId: true }
      })
      if (!studentAttempt) {
        throw new ForbiddenError('Access denied: Student is not in your exam scope')
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          role: 'FACULTY',
          action: 'MEDIA_IDENTITY_VIEW',
          targetId: studentId,
          details: { key, examId: studentAttempt.examId }
        }
      }).catch(err => logger.warn({ error: err.message }, 'Failed to record identity view audit log'))

      return true
    }

    if (role === ROLES.INVIGILATOR) {
      const studentAttempt = await prisma.examAttempt.findFirst({
        where: {
          studentId,
          examId: user.examId
        },
        select: { id: true }
      })
      if (!studentAttempt) {
        throw new ForbiddenError('Access denied: Student is not in your assigned examination')
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          role: 'INVIGILATOR',
          action: 'MEDIA_IDENTITY_VIEW',
          targetId: studentId,
          details: { key, examId: user.examId }
        }
      }).catch(err => logger.warn({ error: err.message }, 'Failed to record identity view audit log'))

      return true
    }

    if (role === ROLES.ADMIN) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          role: 'ADMIN',
          action: 'MEDIA_IDENTITY_VIEW',
          targetId: studentId,
          details: { key }
        }
      }).catch(err => logger.warn({ error: err.message }, 'Failed to record identity view audit log'))

      return true
    }

    throw new ForbiddenError('Access denied')
  }

  // 2. Evidence / Thumbs / Live / Attempt frames:
  // e.g. evidence/{examId}/{attemptId}/... or thumbs/{examId}/{attemptId}/... or live/{examId}/{attemptId}/... or attempts/{attemptId}/...
  const attemptMatch = key.match(/^(?:evidence|thumbs|live)\/([^/]+)\/([^/]+)/) || key.match(/^attempts\/([^/]+)/)
  if (attemptMatch) {
    const isAttemptDirect = key.startsWith('attempts/')
    const attemptId = isAttemptDirect ? attemptMatch[1] : attemptMatch[2]

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, studentId: true, examId: true, exam: { select: { facultyId: true } } }
    })

    if (!attempt) {
      throw new NotFoundError('Associated attempt not found')
    }

    if (role === ROLES.STUDENT) {
      if (attempt.studentId !== user.id) {
        throw new ForbiddenError('Access denied: You do not own this attempt media')
      }
      return true
    }

    if (role === ROLES.FACULTY) {
      if (attempt.exam?.facultyId !== user.id) {
        throw new ForbiddenError('Access denied: You do not own the exam for this attempt media')
      }
      return true
    }

    if (role === ROLES.INVIGILATOR) {
      if (attempt.examId !== user.examId) {
        throw new ForbiddenError('Access denied: Attempt does not belong to your assigned examination')
      }
      return true
    }

    if (role === ROLES.ADMIN) {
      return true
    }

    throw new ForbiddenError('Access denied')
  }

  // 3. Question images:
  // questions/{examId}/...
  const questionMatch = key.match(/^questions\/([^/]+)/)
  if (questionMatch) {
    const examId = questionMatch[1]
    if (role === ROLES.ADMIN) return true

    if (role === ROLES.FACULTY) {
      const exam = await prisma.exam.findFirst({
        where: { id: examId, facultyId: user.id },
        select: { id: true }
      })
      if (!exam) throw new ForbiddenError('Access denied: You do not own this exam')
      return true
    }

    if (role === ROLES.INVIGILATOR) {
      if (user.examId !== examId) throw new ForbiddenError('Access denied: Exam scope mismatch')
      return true
    }

    if (role === ROLES.STUDENT) {
      const attempt = await prisma.examAttempt.findFirst({
        where: { examId, studentId: user.id },
        select: { id: true }
      })
      if (!attempt) throw new ForbiddenError('Access denied: You do not have an attempt for this exam')
      return true
    }
  }

  // Deny by default for any unknown prefix / pattern (FLW-04)
  throw new ForbiddenError(`Access denied: Media asset '${key}' is not authorized`)
}

/**
 * GET /api/v1/media/view
 * Read presigned URL (redirect or json) with strict BOLA authorization (FLW-04)
 */
router.get('/media/view', requireAuth, async (req, res, next) => {
  try {
    const { key, redirect } = req.query
    if (!key) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing key parameter' } })
    }

    // BOLA Authorization Gate (FLW-04)
    await authorizeMediaView(req.user, key)

    // Short TTL (120s per FLW-04)
    const url = await getPresignedReadUrl(key, 120)
    if (!url) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unable to resolve media asset' } })
    }

    if (redirect === 'true' || redirect === '1') {
      return res.redirect(302, url)
    }

    return res.status(200).json({ key, url, expiresIn: 120 })
  } catch (err) {
    next(err)
  }
})

const { faceVerificationService } = require('./faceVerificationService')
const { verifyIdentitySchema, identityOverrideSchema } = require('./validation')
const { requireRole } = require('../../middleware/authorization')
const { ROLES } = require('../../shared/roles')

/**
 * GET /api/v1/attempts/:attemptId/liveness-challenge
 * Generate random motion challenge for 3-frame burst ("live check")
 */
router.get(
  '/attempts/:attemptId/liveness-challenge',
  requireAuth,
  requireRole(ROLES.STUDENT),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const challenge = await faceVerificationService.generateLivenessChallenge(attemptId)
      return res.status(200).json({ success: true, challenge })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/attempts/:attemptId/verify-identity
 * Pre-exam facial verification against enrolled profile photo
 */
router.post(
  '/attempts/:attemptId/verify-identity',
  requireAuth,
  requireRole(ROLES.STUDENT),
  validateBody(verifyIdentitySchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const studentId = req.user.id
      const { liveFrameKey, challengeId, burstKeys } = req.body

      const result = await faceVerificationService.verifyPreExam({
        attemptId,
        studentId,
        liveFrameKey,
        challengeId,
        burstKeys
      })

      return res.status(200).json({
        success: true,
        verified: result.verified,
        pendingReview: result.pendingReview,
        decision: result.decision,
        message: result.message
      })
    } catch (err) {
      next(err)
    }
  }
)

/**
 * POST /api/v1/attempts/:attemptId/identity-override
 * Invigilator or Admin explicit audited identity override
 */
router.post(
  '/attempts/:attemptId/identity-override',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.INVIGILATOR]),
  validateBody(identityOverrideSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { decision, reason } = req.body

      const override = await faceVerificationService.overrideVerification({
        attemptId,
        operatorId: req.user.id,
        operatorRole: req.user.role,
        decision,
        reason
      })

      return res.status(200).json({ success: true, override })
    } catch (err) {
      next(err)
    }
  }
)

// ──────────────────────────────────────────────────────────────────────────────
// R3 — Snapshot Driver: Presigned ticket + read routes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/attempts/:attemptId/snapshots/ticket
 * Student requests short-lived presigned PUT URLs for camera + screen WebP snapshots.
 * Rate-limited to 1/s/attempt (enforced inside presignService).
 */
router.post(
  '/attempts/:attemptId/snapshots/ticket',
  requireAuth,
  requireRole(ROLES.STUDENT),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const result = await presignService.generateLiveSnapshotTicket(req.user, { attemptId })
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/v1/attempts/:attemptId/snapshots/read
 * Invigilator/admin fetches fresh presigned GET URLs for live frames.
 * Query param ?examId= is optional (auto-resolved from attempt if omitted).
 */
router.get(
  '/attempts/:attemptId/snapshots/read',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.INVIGILATOR, ROLES.FACULTY]),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { examId } = req.query
      const result = await presignService.getLiveSnapshotReadUrls(req.user, { attemptId, examId })
      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
