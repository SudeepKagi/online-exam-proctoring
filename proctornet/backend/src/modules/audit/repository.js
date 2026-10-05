const { prisma } = require('../../infra/postgres/client')

class AuditRepository {
  /**
   * Insert an audit log row using a parameterised raw SQL statement.
   * Raw SQL is intentional: keeps the insert off the Prisma query planner
   * so audit writes never block under high ORM connection contention.
   */
  async insert({ actorId, actorRole, action, resourceType, resourceId, attemptId, requestId, metadata, ipAddress }) {
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

  /**
   * Fetch paginated audit logs ordered newest-first (keyset on id).
   */
  async findMany(limit = 100, beforeId = null) {
    const where = {}
    if (beforeId) {
      where.id = { lt: BigInt(beforeId) }
    }

    return prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' }
    })
  }
}

module.exports = {
  AuditRepository,
  auditRepository: new AuditRepository()
}
