/**
 * auditLogger.js — Structured audit logging
 */

const { logger } = require('../shared/logging')

async function logAudit(opts) {
  try {
    logger.info({
      audit: true,
      userId: opts.userId || null,
      userRole: opts.userRole || 'system',
      action: opts.action,
      details: opts.details || null,
      ipAddress: opts.ipAddress || null
    }, `[AuditLog] ${opts.action}`)
  } catch (e) {
    // Non-critical — never crash the request flow
  }
}

module.exports = { logAudit }
