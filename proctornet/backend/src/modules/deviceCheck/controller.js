const express = require('express')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { ROLES } = require('../../shared/roles')
const { mediaService } = require('../media/media.service')

const router = express.Router()

/**
 * DECOMMISSIONED: Legacy client-trusted device check endpoints (Prompt 4 / A1 / G-05)
 * Decommissioned in favor of cryptographically attested, server-verified Exam Device Companion.
 * Never writes client-supplied processes or status to DeviceCheckLog.
 */
router.all(['/exam/device-check', '/device-check', '/device-check/run'], requireAuth, requireRole(ROLES.STUDENT), (req, res) => {
  res.status(410).json({
    error: {
      code: 'LEGACY_DEVICE_CHECK_DECOMMISSIONED',
      message: 'Client-trusted device check has been decommissioned. Please pair and use the Exam Device Companion.'
    }
  })
})

/**
 * POST /api/v1/exam/livekit-token
 */
router.post(['/exam/livekit-token', '/livekit-token'], requireAuth, requireRole([ROLES.STUDENT, ROLES.INVIGILATOR, ROLES.FACULTY, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const result = await mediaService.issueToken(req.user, req.body)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/exam/snapshot
 */
router.post(['/exam/snapshot', '/snapshot'], requireAuth, requireRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const { presignService } = require('../media/presignService')
    const ticket = await presignService.generateUploadPresignedUrl(
      req.user,
      { purpose: 'SNAPSHOT', contentType: 'image/webp', bytes: 200 * 1024 }
    )
    res.status(200).json({ success: true, uploadTicket: ticket })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/exam/evidence-clip
 */
router.post(['/exam/evidence-clip', '/evidence-clip'], requireAuth, requireRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const { presignService } = require('../media/presignService')
    const ticket = await presignService.generateUploadPresignedUrl(
      req.user,
      { purpose: 'EVIDENCE', contentType: 'video/webm', bytes: 5 * 1024 * 1024 }
    )
    res.status(200).json({ success: true, uploadTicket: ticket })
  } catch (err) {
    next(err)
  }
})

module.exports = router
