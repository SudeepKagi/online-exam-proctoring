/**
 * NoopProvider.js
 * Default no-op implementation when VPN_ENABLED=false (P8 Task 1 / ADR-010)
 *
 * Guarantees zero system calls, zero network round trips, and zero database mutations.
 */

const { VpnProvider } = require('./VpnProvider')
const { logger } = require('../../shared/logging')

class NoopProvider extends VpnProvider {
  constructor() {
    super()
    this.name = 'NoopProvider'
  }

  async addPeer({ publicKey, ip }) {
    logger.debug({ publicKey: publicKey?.substring(0, 8), ip }, '[NoopProvider] addPeer called (VPN disabled, no-op)')
    return Promise.resolve()
  }

  async removePeer(publicKey) {
    logger.debug({ publicKey: publicKey?.substring(0, 8) }, '[NoopProvider] removePeer called (VPN disabled, no-op)')
    return Promise.resolve()
  }

  async listPeers() {
    logger.debug('[NoopProvider] listPeers called (returns empty array)')
    return Promise.resolve([])
  }

  async syncPeers(peers) {
    logger.debug({ count: peers?.length || 0 }, '[NoopProvider] syncPeers called (no-op)')
    return Promise.resolve()
  }
}

module.exports = {
  NoopProvider
}
