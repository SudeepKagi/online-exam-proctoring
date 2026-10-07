const express = require('express')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')
const { ROLES } = require('../../shared/roles')
const { getClientIp } = require('../../utils/helpers')
const { validateBody } = require('../../middleware/validation')
const { BadRequestError } = require('../../shared/errors')
const {
  pairAgentSchema,
  reportSchema,
  grantWaiverSchema,
  releaseSchema,
  updateRuleSchema,
  assertPrivacyCompliance
} = require('./validation')
const { pairingService } = require('./pairingService')
const { agentSessionService } = require('./agentSessionService')
const { reportService } = require('./reportService')
const { waiverService } = require('./waiverService')
const { releaseService } = require('./releaseService')
const { agentStatusService } = require('./agentStatusService')
const { policyService } = require('./policyService')
const { prisma } = require('../../infra/postgres/client')
const { routeRateLimiters } = require('../../middleware/rateLimit')

const { agentDownloadsTotal } = require('../../observability/metrics')

const router = express.Router()

// ── Public Companion Agent Endpoints ──

// Manifest
router.get('/agent/manifest', async (req, res, next) => {
  try {
    const manifest = await releaseService.getManifest()
    res.status(200).json(manifest)
  } catch (err) {
    next(err)
  }
})

// Binary download redirect (302 to presigned S3 URL)
router.get('/agent/download', async (req, res, next) => {
  try {
    const os = String(req.query.os || 'win').toLowerCase().trim()
    agentDownloadsTotal.inc({ os })
    const { url } = await releaseService.getDownloadRedirect(os)
    if (req.headers.accept?.includes('application/json')) {
      return res.status(200).json({ downloadUrl: url })
    }
    return res.redirect(302, url)
  } catch (err) {
    next(err)
  }
})

// Public pairing endpoint
router.post('/agent/pair', routeRateLimiters.pair, validateBody(pairAgentSchema), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req)
    const result = await agentSessionService.pair(req.body, clientIp)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// HMAC-authenticated agent report endpoint
router.post('/agent/report', (req, res, next) => {
  if (req.rawBody && req.rawBody.length > 64 * 1024) {
    return next(new BadRequestError('Payload too large: Companion report must not exceed 64KB'))
  }
  try {
    assertPrivacyCompliance(req.body)
  } catch (err) {
    return next(new BadRequestError(err.message))
  }
  return validateBody(reportSchema)(req, res, next)
}, async (req, res, next) => {
  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body)
    const path = req.originalUrl ? req.originalUrl.split('?')[0] : '/api/v1/agent/report'
    const result = await reportService.processReport(
      req.headers,
      rawBody,
      req.body,
      path,
      req.method
    )
    res.status(200).json(result)
  } catch (err) {
    if (err.code === 'CLOCK_SKEW') {
      return res.status(400).json({
        error: 'CLOCK_SKEW',
        message: err.message,
        serverTime: err.serverTime
      })
    }
    next(err)
  }
})

// ── Student Pairing Endpoints (Authenticated) ──

// Generate pairing code for an attempt
router.post(
  '/attempts/:attemptId/agent/pairing-code',
  requireAuth,
  requireRole(ROLES.STUDENT),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const studentId = req.user.id
      const clientIp = getClientIp(req)
      const result = await pairingService.createAttemptPairingCode(attemptId, studentId, clientIp)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// Generate practice precheck pairing code
router.post(
  '/student/agent/pairing-code',
  requireAuth,
  requireRole(ROLES.STUDENT),
  async (req, res, next) => {
    try {
      const studentId = req.user.id
      const clientIp = getClientIp(req)
      const result = await pairingService.createPrecheckPairingCode(studentId, clientIp)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// Precheck companion status (Student owner)
router.get(
  '/student/agent/status',
  requireAuth,
  requireRole(ROLES.STUDENT),
  async (req, res, next) => {
    try {
      const status = await agentStatusService.getStudentPrecheckStatus(req.user.id)
      res.status(200).json(status)
    } catch (err) {
      next(err)
    }
  }
)

// Attempt companion status (Student owner or Exam Staff)
router.get(
  '/attempts/:attemptId/agent/status',
  requireAuth,
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const status = await agentStatusService.getAttemptAgentStatus(attemptId, req.user)
      res.status(200).json(status)
    } catch (err) {
      next(err)
    }
  }
)

// ── Staff Endpoints (Waiver & Recheck) ──

router.post(
  '/staff/attempts/:attemptId/agent/waiver',
  requireAuth,
  requireRole([ROLES.FACULTY, ROLES.INVIGILATOR, ROLES.ADMIN]),
  validateBody(grantWaiverSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { reason } = req.body
      const waiver = await waiverService.grantWaiver(attemptId, req.user, reason)
      res.status(200).json({ success: true, waiver })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/staff/attempts/:attemptId/agent/recheck',
  requireAuth,
  requireRole([ROLES.FACULTY, ROLES.INVIGILATOR, ROLES.ADMIN]),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const result = await waiverService.requestRecheck(attemptId, req.user)
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// ── Admin Endpoints (Releases & Rules) ──

router.post(
  '/admin/agent/releases',
  requireAuth,
  requireRole(ROLES.ADMIN),
  validateBody(releaseSchema),
  async (req, res, next) => {
    try {
      const release = await releaseService.registerRelease(req.body)
      res.status(201).json(release)
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  ['/admin/agent/releases/revoke', '/admin/agent/releases/:id/revoke'],
  requireAuth,
  requireRole(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const releaseId = req.params.id || req.body.id
      const release = await releaseService.revokeRelease(releaseId)
      res.status(200).json({ success: true, release })
    } catch (err) {
      next(err)
    }
  }
)

router.get(
  '/admin/agent/rules',
  requireAuth,
  requireRole(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await policyService.seedRulesIfEmpty()
      const rules = await prisma.agentRule.findMany({
        orderBy: { id: 'asc' }
      })
      res.status(200).json({ rules })
    } catch (err) {
      next(err)
    }
  }
)

router.put(
  '/admin/agent/rules/:id',
  requireAuth,
  requireRole(ROLES.ADMIN),
  validateBody(updateRuleSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params
      const updated = await prisma.agentRule.update({
        where: { id },
        data: req.body
      })
      // Re-sign policy bundle
      const latestPolicy = await policyService.getLatestSignedPolicy(true)
      res.status(200).json({ rule: updated, policyVersion: latestPolicy.version })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
