const express = require('express')
const { presignService } = require('./presignService')
const { presignUploadSchema } = require('./validation')
const { validateBody } = require('../../middleware/validation')
const { requireAuth } = require('../../middleware/authentication')
const { routeRateLimiters } = require('../../middleware/rateLimit')

const router = express.Router()

/**
 * POST /api/v1/media/presign-upload
 * Generate direct PUT presigned S3 URL for client upload (ADR-011)
 */
router.post(
  '/media/presign-upload',
  requireAuth,
  routeRateLimiters.presign,
  validateBody(presignUploadSchema),
  async (req, res, next) => {
    try {
      const { attemptId, contentType, purpose } = req.body
      const studentId = req.user.id

      const result = await presignService.generateUploadPresignedUrl(
        attemptId,
        studentId,
        contentType,
        purpose
      )

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
