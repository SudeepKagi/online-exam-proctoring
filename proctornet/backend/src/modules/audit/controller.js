const express = require('express')
const { auditService } = require('./service')
const { requireAuth } = require('../../middleware/authentication')
const { requireRole } = require('../../middleware/authorization')

const router = express.Router()

/**
 * GET /api/v1/audit/logs
 * Read audit logs (Admin only)
 */
router.get(
  '/audit/logs',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit || '100', 10)
      const beforeId = req.query.beforeId || null
      const logs = await auditService.getLogs(limit, beforeId)
      return res.status(200).json(logs)
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
