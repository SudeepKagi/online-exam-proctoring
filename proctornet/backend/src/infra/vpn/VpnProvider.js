/**
 * VpnProvider.js
 * Abstract WireGuard VPN Provider Interface (P8 Task 1 / ADR-010)
 *
 * Defines contract for WireGuard peer management across implementations:
 * - NoopProvider (default when VPN_ENABLED=false)
 * - FakeProvider (tests / CI)
 * - WireGuardAgentProvider (production sidecar via Unix domain socket)
 * - WireGuardSshProvider (remote VM with pinned host key)
 */

class VpnProvider {
  /**
   * Provision a WireGuard peer
   * @param {Object} params
   * @param {string} params.publicKey - Client Curve25519/x25519 public key (Base64)
   * @param {string} params.ip - Leased VPN IPv4 address (e.g., 10.8.0.2)
   * @param {Date|string} [params.expiresAt] - Lease expiry timestamp
   * @returns {Promise<void>}
   */
  async addPeer({ publicKey, ip, expiresAt }) {
    throw new Error('VpnProvider.addPeer() must be implemented by subclass')
  }

  /**
   * Revoke a WireGuard peer by public key
   * @param {string} publicKey - Client Curve25519/x25519 public key (Base64)
   * @returns {Promise<void>}
   */
  async removePeer(publicKey) {
    throw new Error('VpnProvider.removePeer() must be implemented by subclass')
  }

  /**
   * List all currently active peers on WireGuard interface
   * @returns {Promise<Array<{publicKey: string, endpoint: string|null, allowedIps: string[], latestHandshakeAt: Date|null, transferRx: number, transferTx: number}>>}
   */
  async listPeers() {
    throw new Error('VpnProvider.listPeers() must be implemented by subclass')
  }

  /**
   * Batch synchronize peers (for reconciliation or batch provisioning)
   * @param {Array<{publicKey: string, ip: string}>} peers
   * @returns {Promise<void>}
   */
  async syncPeers(peers) {
    throw new Error('VpnProvider.syncPeers() must be implemented by subclass')
  }
}

module.exports = {
  VpnProvider
}
