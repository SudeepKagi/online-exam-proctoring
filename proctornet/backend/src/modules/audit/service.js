const { prisma } = require('../../infra/postgres/client')

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

    const sql = `
      INSERT INTO audit_logs (
        actor_id, actor_role, action, resource_type, resource_id, attempt_id,
        request_id, metadata, ip_address, timestamp
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5, $6::uuid,
        $7, $8::jsonb, $9, now()
      )
      RETURNING id;
    `

    return prisma.$queryRawUnsafe(
      sql,
      actorId,
      actorRole,
      action,
      resourceType,
      resourceId,
      attemptId,
      requestId,
      JSON.stringify(metadata),
      ipAddress
    )
  }

  async getLogs(limit = 100, beforeId = null) {
    const where = {}
    if (beforeId) {
      where.id = { lt: BigInt(beforeId) }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' }
    })

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
