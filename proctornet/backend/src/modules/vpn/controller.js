/**
 * modules/vpn/controller.js
 * WireGuard VPN HTTP Controller (P8 Task 5 / ADR-010)
 *
 * Exposes:
 * - POST   /attempts/:attemptId/vpn  -> Provision keys & allocate IP (once)
 * - GET    /attempts/:attemptId/vpn  -> Read active VPN status
 * - DELETE /attempts/:attemptId/vpn  -> Revoke VPN peer access
 */

const express = require('express')
const { vpnService } = require('./vpn.service')
const { requireAuth } = require('../../middleware/authentication')
const { validateParams } = require('../../middleware/validation')
const { attemptIdParamSchema } = require('../attempts/validation')

const router = express.Router()

/**
 * POST /attempts/:attemptId/vpn
 * Issue or retrieve WireGuard VPN config for an attempt session
 */
router.post(
  '/attempts/:attemptId/vpn',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params
      const { clientPublicKey } = req.body || {}

      const result = await vpnService.provisionAttemptVpn({
        attemptId,
        studentId: req.user.id,
        userRole: req.user.role,
        clientPublicKey
      })

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /attempts/:attemptId/vpn
 * Read current active VPN peer status for an attempt
 */
router.get(
  '/attempts/:attemptId/vpn',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params

      const result = await vpnService.getAttemptVpnStatus({
        attemptId,
        studentId: req.user.id,
        userRole: req.user.role
      })

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * DELETE /attempts/:attemptId/vpn
 * Revoke VPN peer access for an attempt
 */
router.delete(
  '/attempts/:attemptId/vpn',
  requireAuth,
  validateParams(attemptIdParamSchema),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params

      const result = await vpnService.revokeAttemptVpn({
        attemptId,
        studentId: req.user.id,
        userRole: req.user.role
      })

      return res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
