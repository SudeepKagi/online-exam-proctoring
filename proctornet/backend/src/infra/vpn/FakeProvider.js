/**
 * FakeProvider.js
 * In-Memory Mock VPN Provider for deterministic test execution (P8 Task 1)
 */

const { VpnProvider } = require('./VpnProvider')

class FakeProvider extends VpnProvider {
  constructor() {
    super()
    this.name = 'FakeProvider'
    this.peers = new Map() // publicKey -> peerObject
    this.callLog = []
  }

  async addPeer({ publicKey, ip, expiresAt }) {
    if (!publicKey || !ip) {
      throw new Error('publicKey and ip are required')
    }

    const peer = {
      publicKey,
      ip,
      allowedIps: [`${ip}/32`],
      endpoint: '192.168.1.100:51820',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      latestHandshakeAt: new Date(),
      transferRx: 1024,
      transferTx: 2048
    }

    this.peers.set(publicKey, peer)
    this.callLog.push({ action: 'addPeer', publicKey, ip, timestamp: new Date() })
    return Promise.resolve()
  }

  async removePeer(publicKey) {
    if (!publicKey) return Promise.resolve()
    this.peers.delete(publicKey)
    this.callLog.push({ action: 'removePeer', publicKey, timestamp: new Date() })
    return Promise.resolve()
  }

  async listPeers() {
    this.callLog.push({ action: 'listPeers', timestamp: new Date() })
    return Promise.resolve(Array.from(this.peers.values()))
  }

  async syncPeers(peers) {
    this.callLog.push({ action: 'syncPeers', count: peers?.length || 0, timestamp: new Date() })
    const newKeys = new Set(peers.map(p => p.publicKey))

    // Remove peers not in sync list
    for (const key of this.peers.keys()) {
      if (!newKeys.has(key)) {
        this.peers.delete(key)
      }
    }

    // Add/update peers
    for (const p of peers) {
      await this.addPeer(p)
    }
  }

  /**
   * Test helper to simulate handshake age for disconnect/reconciler tests
   */
  simulateHandshake(publicKey, handshakeDate) {
    const peer = this.peers.get(publicKey)
    if (peer) {
      peer.latestHandshakeAt = handshakeDate ? new Date(handshakeDate) : null
    }
  }

  /**
   * Test helper to reset internal state
   */
  reset() {
    this.peers.clear()
    this.callLog = []
  }
}

module.exports = {
  FakeProvider
}
