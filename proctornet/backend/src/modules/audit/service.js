const { auditRepository } = require('./repository')

class AuditService {
  async logAction(actorId, actorRole, action, options = {}) {
    const {
      resourceType = null,
      resourceId = null,
      attemptId = null,
      requestId = null,
      metadata = {},
      ipAddress = null
    } = options

    return auditRepository.insert({
      actorId,
      actorRole,
      action,
      resourceType,
      resourceId,
      attemptId,
      requestId,
      metadata,
      ipAddress
    })
  }

  async getLogs(limit = 100, beforeId = null) {
    const logs = await auditRepository.findMany(limit, beforeId)

    return logs.map(l => ({
      id: l.id.toString(),
      actorId: l.actorId,
      actorRole: l.actorRole,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      attemptId: l.attemptId,
      requestId: l.requestId,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      timestamp: l.timestamp
    }))
  }
}

module.exports = {
  AuditService,
  auditService: new AuditService()
}
