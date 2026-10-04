/**
 * modules/vpn/ipam.js
 * Atomic IP Address Management (IPAM) for WireGuard (P8 Task 3 / ADR-010)
 *
 * Implements O(1) concurrent IP lease allocation via PostgreSQL:
 *   UPDATE vpn_ip_pool SET attempt_id = $1, leased_at = now()
 *   WHERE ip = (SELECT ip FROM vpn_ip_pool WHERE attempt_id IS NULL ORDER BY ip LIMIT 1 FOR UPDATE SKIP LOCKED)
 *   RETURNING ip;
 *
 * Safe across N Node.js processes without deadlocks or double-allocation.
 */

const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class VpnIpam {
  constructor(options = {}) {
    this.defaultCidr = options.defaultCidr || process.env.VPN_CIDR || '10.8.0.0/16'
  }

  /**
   * Pre-seed IP address pool for WireGuard subnet (e.g., 10.8.0.2 to 10.8.X.Y)
   * @param {Object} options
   * @param {number} [options.count=1000] - Number of IPs to seed
   * @param {string} [options.prefix='10.8'] - Subnet prefix
   */
  async seedPool({ count = 1000, prefix = '10.8' } = {}) {
    const existingCount = await prisma.vpnIpPool.count()
    if (existingCount >= count) {
      logger.debug({ existingCount, targetCount: count }, '[IPAM] Pool already sufficiently seeded')
      return existingCount
    }

    const needed = count - existingCount
    logger.info({ needed, prefix }, '[IPAM] Seeding IP address pool...')

    const ipsToInsert = []
    let currentOctet3 = 0
    let currentOctet4 = 2 // Start at .2 (.1 reserved for gateway)

    while (ipsToInsert.length < needed && currentOctet3 < 255) {
      const ip = `${prefix}.${currentOctet3}.${currentOctet4}`
      ipsToInsert.push({ ip })

      currentOctet4++
      if (currentOctet4 > 254) {
        currentOctet4 = 1
        currentOctet3++
      }
    }

    // Insert in batches of 500
    const chunkSize = 500
    for (let i = 0; i < ipsToInsert.length; i += chunkSize) {
      const chunk = ipsToInsert.slice(i, i + chunkSize)
      await prisma.vpnIpPool.createMany({
        data: chunk,
        skipDuplicates: true
      })
    }

    const finalCount = await prisma.vpnIpPool.count()
    logger.info({ finalCount }, '[IPAM] Seeded IP pool successfully')
    return finalCount
  }

  /**
   * Atomically allocate an IP address for an exam attempt (O(1) SKIP LOCKED)
   * @param {string} attemptId - UUID of the exam attempt
   * @returns {Promise<string>} Allocated IP address
   */
  async allocateIp(attemptId) {
    if (!attemptId) {
      throw new Error('attemptId is required for IPAM allocation')
    }

    // Atomic allocation with FOR UPDATE SKIP LOCKED
    // Re-uses existing lease if attempt already holds one; otherwise claims next available free IP
    const rawResult = await prisma.$queryRaw`
      UPDATE vpn_ip_pool
      SET attempt_id = ${attemptId}::uuid, leased_at = now(), released_at = null
      WHERE ip = (
        SELECT ip FROM vpn_ip_pool
        WHERE attempt_id = ${attemptId}::uuid
           OR (attempt_id IS NULL AND NOT EXISTS (SELECT 1 FROM vpn_ip_pool WHERE attempt_id = ${attemptId}::uuid))
        ORDER BY (attempt_id = ${attemptId}::uuid) DESC, ip ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING ip;
    `

    if (rawResult && rawResult.length > 0) {
      const allocatedIp = rawResult[0].ip
      logger.info({ attemptId, ip: allocatedIp }, '[IPAM] Allocated VPN IP')
      return allocatedIp
    }

    // If pool is empty, attempt self-healing seed and retry once
    const totalCount = await prisma.vpnIpPool.count()
    if (totalCount === 0) {
      await this.seedPool({ count: 500 })
      return this.allocateIp(attemptId)
    }

    const err = new Error('VPN IP address pool exhausted (no available leases)')
    err.code = 'IP_POOL_EXHAUSTED'
    err.statusCode = 503
    throw err
  }

  /**
   * Release an IP address lease when attempt reaches terminal state
   * @param {string} attemptId - UUID of the exam attempt
   * @returns {Promise<string|null>} Released IP address or null if none was held
   */
  async releaseIp(attemptId) {
    if (!attemptId) return null

    const rawResult = await prisma.$queryRaw`
      UPDATE vpn_ip_pool
      SET attempt_id = null, released_at = now()
      WHERE attempt_id = ${attemptId}::uuid
      RETURNING ip;
    `

    if (rawResult && rawResult.length > 0) {
      const releasedIp = rawResult[0].ip
      logger.info({ attemptId, ip: releasedIp }, '[IPAM] Released VPN IP')
      return releasedIp
    }

    return null
  }

  /**
   * Get current lease info for an attempt
   */
  async getLease(attemptId) {
    if (!attemptId) return null
    return prisma.vpnIpPool.findFirst({
      where: { attemptId }
    })
  }

  /**
   * Get IPAM pool statistics
   */
  async getStats() {
    const total = await prisma.vpnIpPool.count()
    const allocated = await prisma.vpnIpPool.count({
      where: { attemptId: { not: null } }
    })
    return {
      total,
      allocated,
      free: Math.max(0, total - allocated)
    }
  }
}

const vpnIpam = new VpnIpam()

module.exports = {
  VpnIpam,
  vpnIpam
}
