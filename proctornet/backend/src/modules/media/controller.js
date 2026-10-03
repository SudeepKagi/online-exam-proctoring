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
 * GET /api/v1/media/view
 * Read presigned URL (redirect or json)
 */
router.get('/media/view', requireAuth, async (req, res, next) => {
  try {
    const { key, redirect } = req.query
    if (!key) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing key parameter' } })
    }

    const url = await getPresignedReadUrl(key, 600)
    if (!url) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unable to resolve media asset' } })
    }

    if (redirect === 'true' || redirect === '1') {
      return res.redirect(302, url)
    }

    return res.status(200).json({ key, url, expiresIn: 600 })
  } catch (err) {
    next(err)
  }
})

module.exports = router
