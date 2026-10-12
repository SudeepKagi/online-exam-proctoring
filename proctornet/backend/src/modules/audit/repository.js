const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')

function computeIntegrityHash({ actorId, actorRole, action, resourceType, resourceId, attemptId, requestId, ipAddress, userMetadata, signedAt }) {
  const secret = process.env.AUDIT_PEPPER || process.env.JWT_SECRET || 'audit_integrity_pepper_default'
  const canonicalString = [
    actorId || '',
    actorRole || '',
    action || '',
    resourceType || '',
    resourceId || '',
    attemptId || '',
    requestId || '',
    ipAddress || '',
    signedAt || '',
    JSON.stringify(userMetadata || {})
  ].join('|')
  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex')
}

class AuditRepository {
  /**
   * Insert an audit log row using a parameterised raw SQL statement.
   * Attaches cryptographic HMAC integrity hash to guarantee tamper-evidence.
   */
  async insert({ actorId, actorRole, action, resourceType, resourceId, attemptId, requestId, metadata = {}, ipAddress }) {
    const signedAt = new Date().toISOString()
    const userMetadata = { ...(metadata || {}) }
    delete userMetadata.integrityHash
    delete userMetadata.signedAt

    const integrityHash = computeIntegrityHash({
      actorId,
      actorRole,
      action,
      resourceType,
      resourceId,
      attemptId,
      requestId,
      ipAddress,
      userMetadata,
      signedAt
    })

    const finalMetadata = {
      ...userMetadata,
      integrityHash,
      signedAt
    }

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
      JSON.stringify(finalMetadata),
      ipAddress
    )
  }

  /**
   * Verify whether an audit row has been altered or tampered with
   */
  verifyRowIntegrity(row) {
    if (!row || !row.metadata || !row.metadata.integrityHash) {
      return { verified: false, reason: 'NO_HASH' }
    }
    const { integrityHash, signedAt, ...userMetadata } = row.metadata
    const expectedHash = computeIntegrityHash({
      actorId: row.actorId,
      actorRole: row.actorRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      attemptId: row.attemptId,
      requestId: row.requestId,
      ipAddress: row.ipAddress,
      userMetadata,
      signedAt
    })
    return {
      verified: integrityHash === expectedHash,
      integrityHash,
      expectedHash
    }
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
