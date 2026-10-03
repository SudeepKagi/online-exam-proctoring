const express = require('express')
const router = express.Router()
const s3Service = require('../services/s3.service')
const { authenticate } = require('../middleware/auth.middleware')

/**
 * GET /api/evidence/view
 * Browser redirect to a freshly signed AWS S3 URL.
 * Never expires in UI because requesting this endpoint always resolves a fresh signature.
 */
router.get('/view', async (req, res) => {
  try {
    const rawTarget = req.query.key || req.query.url
    if (!rawTarget) {
      return res.status(400).json({ error: 'Missing key or url query parameter' })
    }

    // If it's already a non-S3 full URL (e.g. legacy Cloudinary or local upload)
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      if (!rawTarget.includes('.amazonaws.com')) {
        return res.redirect(302, rawTarget)
      }
    } else if (rawTarget.startsWith('/uploads/')) {
      return res.redirect(302, rawTarget)
    }

    // Generate signed S3 URL (valid 2 hours)
    const signedUrl = await s3Service.getPresignedUrl(rawTarget, 7200)
    return res.redirect(302, signedUrl)
  } catch (err) {
    console.error('[Evidence View Error]:', err.message)
    return res.status(500).json({ error: 'Failed to resolve evidence asset' })
  }
})

/**
 * POST /api/evidence/presign
 * Get a temporary pre-signed URL for an S3 asset (for authenticated API callers).
 */
router.post('/presign', authenticate, async (req, res) => {
  try {
    const { key, url, expiresIn = 3600 } = req.body
    const target = key || url
    if (!target) {
      return res.status(400).json({ error: 'Missing key or url parameter' })
    }

    const presignedUrl = await s3Service.getPresignedUrl(target, Number(expiresIn) || 3600)
    return res.json({
      success: true,
      presignedUrl,
      expiresIn,
    })
  } catch (err) {
    console.error('[Evidence Presign Error]:', err.message)
    return res.status(500).json({ error: 'Failed to generate pre-signed URL' })
  }
})

module.exports = router
