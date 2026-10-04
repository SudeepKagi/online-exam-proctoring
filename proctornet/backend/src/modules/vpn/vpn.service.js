/**
 * modules/vpn/vpn.service.js
 * WireGuard VPN Service (P8 Tasks 4, 5, 6 / ADR-010)
 *
 * Implements:
 * - Kills V-03: Client private key is ephemeral; only public key is persisted.
 * - Kills V-04: Strict ownership & state verification (READY|ACTIVE|SUSPENDED); zero upsert side effects.
 * - Kills V-05: Transactional outbox event publishing; zero shell/ssh in request paths.
 */

const { prisma } = require('../../infra/postgres/client')
const { vpnIpam } = require('./ipam')
const { vpnKeyService } = require('./keyService')
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

class VpnService {
  /**
   * Provision WireGuard VPN configuration for an attempt
   * @param {Object} params
   * @param {string} params.attemptId - Exam attempt UUID
   * @param {string} params.studentId - Authenticated student UUID
   * @param {string} params.userRole - Authenticated user role
   * @param {string} [params.clientPublicKey] - Optional browser-generated WebCrypto X25519 public key
   */
  async provisionAttemptVpn({ attemptId, studentId, userRole, clientPublicKey = null }) {
    if (!attemptId) {
      throw new BadRequestError('attemptId is required')
    }

    // 1. Fetch attempt and exam
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            duration: true,
            status: true,
            facultyId: true,
            vpnRequired: true
          }
        }
      }
    })

    if (!attempt) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    // 2. Ownership verification
    if (userRole === 'STUDENT' && attempt.studentId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this attempt')
    }
    if (userRole === 'FACULTY' && attempt.exam.facultyId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    // 3. State verification (Kills V-04: must be READY, ACTIVE, or SUSPENDED)
    const allowedStates = ['READY', 'ACTIVE', 'SUSPENDED']
    if (!allowedStates.includes(attempt.status)) {
      throw new BadRequestError(
        `Cannot provision VPN for attempt in '${attempt.status}' state. State must be READY, ACTIVE, or SUSPENDED.`
      )
    }

    // 4. VPN enabled gate: check global flag or exam-level requirement
    const isVpnGloballyEnabled = process.env.VPN_ENABLED === 'true'
    const isExamVpnRequired = Boolean(attempt.exam.vpnRequired)
    if (!isVpnGloballyEnabled && !isExamVpnRequired) {
      throw new ForbiddenError('VPN is not enabled for this exam session.')
    }

    // 5. O(1) Atomic IPAM allocation (Kills V-02)
    const leasedIp = await vpnIpam.allocateIp(attemptId)

    // 6. Key generation and client config (Kills V-03: config returned ONCE in memory)
    const { peerId, publicKey, config, isClientGenerated } = await vpnKeyService.provisionKeys({
      attemptId,
      studentId: attempt.studentId,
      ipAddress: leasedIp,
      clientPublicKey
    })

    // 7. Enqueue transactional outbox event (Kills V-05: zero shell execution in request path)
    await prisma.$executeRawUnsafe(`
      INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
      VALUES ($1, $2::jsonb, 'PENDING', now());
    `, 'vpn.peer.add', JSON.stringify({
      attemptId,
      studentId: attempt.studentId,
      publicKey,
      ipAddress: leasedIp
    }))

    logger.info({
      attemptId,
      studentId: attempt.studentId,
      leasedIp,
      publicKeyPreview: publicKey.substring(0, 8),
      isClientGenerated
    }, '[VpnService] Successfully provisioned VPN configuration and enqueued outbox add')

    return {
      success: true,
      attemptId,
      ip: leasedIp,
      publicKey,
      config, // Transmitted once to client; never saved to database
      isClientGenerated,
      expiresAt: attempt.expiresAt
    }
  }

  /**
   * Get current active VPN status for an attempt
   */
  async getAttemptVpnStatus({ attemptId, studentId, userRole }) {
    if (!attemptId) {
      throw new BadRequestError('attemptId is required')
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: { facultyId: true, vpnRequired: true }
        }
      }
    })

    if (!attempt) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    if (userRole === 'STUDENT' && attempt.studentId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this attempt')
    }
    if (userRole === 'FACULTY' && attempt.exam.facultyId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    const activePeer = await vpnKeyService.getActivePeer(attemptId)
    const lease = await vpnIpam.getLease(attemptId)

    if (!activePeer || !lease) {
      return {
        active: false,
        attemptId,
        message: 'No active VPN configuration for this attempt.'
      }
    }

    const isExpired = attempt.expiresAt ? new Date(attempt.expiresAt) <= new Date() : false

    return {
      active: !isExpired,
      attemptId,
      ip: activePeer.ipAddress,
      publicKey: activePeer.publicKey,
      leasedAt: lease.leasedAt,
      expiresAt: attempt.expiresAt,
      isExpired
    }
  }

  /**
   * Revoke active VPN peer for an attempt
   */
  async revokeAttemptVpn({ attemptId, studentId, userRole }) {
    if (!attemptId) {
      throw new BadRequestError('attemptId is required')
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: { facultyId: true }
        }
      }
    })

    if (!attempt) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    if (userRole === 'STUDENT' && attempt.studentId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this attempt')
    }
    if (userRole === 'FACULTY' && attempt.exam.facultyId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    const activePeer = await vpnKeyService.getActivePeer(attemptId)
    if (!activePeer) {
      return {
        success: true,
        attemptId,
        message: 'No active VPN peer found to revoke.'
      }
    }

    // Deactivate peer and release IP
    await vpnKeyService.deactivatePeer(attemptId)
    await vpnIpam.releaseIp(attemptId)

    // Enqueue outbox peer removal
    await prisma.$executeRawUnsafe(`
      INSERT INTO outbox_events (event_type, payload, status, next_attempt_at)
      VALUES ($1, $2::jsonb, 'PENDING', now());
    `, 'vpn.peer.remove', JSON.stringify({
      attemptId,
      publicKey: activePeer.publicKey
    }))

    logger.info({
      attemptId,
      publicKeyPreview: activePeer.publicKey.substring(0, 8)
    }, '[VpnService] Revoked VPN peer and enqueued outbox removal')

    return {
      success: true,
      attemptId,
      message: 'VPN peer successfully revoked.'
    }
  }
}

const vpnService = new VpnService()

module.exports = {
  VpnService,
  vpnService
}
