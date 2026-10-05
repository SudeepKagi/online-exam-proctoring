const express = require('express')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { ROLES } = require('../../shared/roles')
const { prisma } = require('../../infra/postgres/client')
const { mediaService } = require('../media/media.service')
const { getClientIp } = require('../../utils/helpers')

const router = express.Router()

router.use(requireAuth)

/**
 * POST /api/v1/exam/device-check or /api/v1/device-check
 */
router.post(['/exam/device-check', '/device-check', '/device-check/run'], requireRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { attemptId, blockedProcesses = [], virtualCams = [], isSubnetMatched = true } = req.body

    const log = await prisma.deviceCheckLog.create({
      data: {
        studentId,
        attemptId: attemptId || null,
        agentConnected: true,
        blockedProcesses: Array.isArray(blockedProcesses) ? blockedProcesses : [],
        virtualCams: Array.isArray(virtualCams) ? virtualCams : [],
        isSubnetMatched: Boolean(isSubnetMatched),
        clientIp: getClientIp(req),
        status: (blockedProcesses.length === 0 && virtualCams.length === 0) ? 'PASSED' : 'FLAGGED'
      }
    })

    res.status(200).json({
      success: true,
      status: log.status,
      deviceCheckId: log.id
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/exam/livekit-token
 */
router.post(['/exam/livekit-token', '/livekit-token'], requireRole([ROLES.STUDENT, ROLES.INVIGILATOR, ROLES.FACULTY, ROLES.ADMIN]), async (req, res, next) => {
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
router.post(['/exam/snapshot', '/snapshot'], requireRole(ROLES.STUDENT), async (req, res, next) => {
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
router.post(['/exam/evidence-clip', '/evidence-clip'], requireRole(ROLES.STUDENT), async (req, res, next) => {
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
