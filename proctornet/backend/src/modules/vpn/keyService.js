/**
 * modules/vpn/keyService.js
 * WireGuard Keypair & Client Configuration Service (P8 Task 4 / ADR-010)
 *
 * Security Invariants:
 * - Kills V-03: Client private key is NEVER saved to database or logged.
 * - WireGuard client configuration is returned to the client EXACTLY ONCE upon provisioning.
 * - Supports client-generated X25519 keys via WebCrypto API (server never sees client private key).
 * - Re-issuance triggers automatic key rotation and peer revocation.
 */

const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class VpnKeyService {
  /**
   * Generate an RFC 7748 X25519 Curve25519 keypair
   * @returns {{privateKey: string, publicKey: string}} Base64-encoded WireGuard keys
   */
  generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519')

    const privateKeyBase64 = privateKey
      .export({ type: 'pkcs8', format: 'der' })
      .subarray(-32)
      .toString('base64')

    const publicKeyBase64 = publicKey
      .export({ type: 'spki', format: 'der' })
      .subarray(-32)
      .toString('base64')

    return { privateKey: privateKeyBase64, publicKey: publicKeyBase64 }
  }

  /**
   * Format a standard WireGuard client .conf file string
   * Default split-tunnel AllowedIPs ensures only exam subnet traffic is routed through the tunnel.
   */
  formatClientConf({
    clientPrivateKey,
    clientIp,
    serverPublicKey = process.env.VPN_SERVER_PUBLIC_KEY || '',
    serverEndpoint = process.env.VPN_SERVER_ENDPOINT || `${process.env.VPN_SERVER_IP || '127.0.0.1'}:51820`,
    allowedIps = process.env.VPN_ALLOWED_IPS || '10.8.0.0/16',
    persistentKeepalive = 25
  }) {
    return `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}/32
DNS = 10.8.0.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}
AllowedIPs = ${allowedIps}
PersistentKeepalive = ${persistentKeepalive}
`
  }

  /**
   * Provision WireGuard keys and record public key in vpn_peers table
   * @param {Object} params
   * @param {string} params.attemptId
   * @param {string} params.studentId
   * @param {string} params.ipAddress
   * @param {string} [params.clientPublicKey] - Optional browser-generated public key
   * @returns {Promise<{publicKey: string, config: string|null, isClientGenerated: boolean}>}
   */
  async provisionKeys({ attemptId, studentId, ipAddress, clientPublicKey = null }) {
    let publicKey = clientPublicKey
    let config = null
    const isClientGenerated = !!clientPublicKey

    if (clientPublicKey) {
      // Browser generated its own X25519 keypair — server NEVER touches the private key
      logger.info({ attemptId, studentId }, '[KeyService] Client provided browser-generated X25519 public key')
    } else {
      // Ephemeral server-side generation
      const keypair = this.generateKeyPair()
      publicKey = keypair.publicKey
      config = this.formatClientConf({
        clientPrivateKey: keypair.privateKey,
        clientIp: ipAddress
      })
    }

    // Persist ONLY the public key in vpn_peers (kills V-03)
    // Deactivate any previous peer for this attempt (rotation)
    await prisma.vpnPeer.updateMany({
      where: { attemptId, isActive: true },
      data: { isActive: false }
    })

    const peer = await prisma.vpnPeer.create({
      data: {
        attemptId,
        studentId,
        ipAddress,
        publicKey,
        isActive: true
      }
    })

    return {
      peerId: peer.id,
      publicKey,
      ipAddress,
      config, // Returned once to caller; never stored in DB
      isClientGenerated
    }
  }

  /**
   * Get active peer for an attempt (public key only)
   */
  async getActivePeer(attemptId) {
    if (!attemptId) return null
    return prisma.vpnPeer.findFirst({
      where: { attemptId, isActive: true }
    })
  }

  /**
   * Deactivate peer upon session termination
   */
  async deactivatePeer(attemptId) {
    if (!attemptId) return null
    return prisma.vpnPeer.updateMany({
      where: { attemptId, isActive: true },
      data: { isActive: false }
    })
  }
}

const vpnKeyService = new VpnKeyService()

module.exports = {
  VpnKeyService,
  vpnKeyService
}
