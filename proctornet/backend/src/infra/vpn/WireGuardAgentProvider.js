/**
 * WireGuardAgentProvider.js
 * Production WireGuard provider communicating with privileged sidecar vpn-agent (P8 Tasks 1 & 2)
 *
 * Communicates with vpn-agent over a Unix Domain Socket with HMAC-SHA256 request signing.
 * The API container never gets NET_ADMIN privileges.
 * When > 20 peers change at once, batches changes with syncPeers.
 */

const http = require('http')
const crypto = require('crypto')
const { execFile } = require('child_process')
const { VpnProvider } = require('./VpnProvider')
const { logger } = require('../../shared/logging')

class WireGuardAgentProvider extends VpnProvider {
  constructor(options = {}) {
    super()
    this.name = 'WireGuardAgentProvider'
    this.socketPath = options.socketPath || process.env.VPN_AGENT_SOCK || '/var/run/wireguard/vpn-agent.sock'
    this.secret = options.secret || process.env.VPN_AGENT_SECRET || 'proctornet_vpn_agent_secret_32_chars_min'
    this.interfaceName = options.interfaceName || process.env.VPN_INTERFACE || 'wg0'
    this.useDirectExec = options.useDirectExec || process.env.VPN_AGENT_DIRECT_EXEC === 'true'
  }

  /**
   * Helper to sign request payload with HMAC-SHA256
   */
  _signPayload(bodyStr) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = crypto.createHmac('sha256', this.secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex')
    return { timestamp, signature }
  }

  /**
   * Send HTTP request over Unix Domain Socket
   */
  async _request(method, path, body = null) {
    if (this.useDirectExec) {
      return this._directExec(method, path, body)
    }

    const bodyStr = body ? JSON.stringify(body) : ''
    const { timestamp, signature } = this._signPayload(bodyStr)

    return new Promise((resolve, reject) => {
      const req = http.request({
        socketPath: this.socketPath,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'X-Vpn-Timestamp': timestamp,
          'X-Vpn-Signature': signature
        },
        timeout: 5000
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : {})
            } catch {
              resolve(data)
            }
          } else {
            const err = new Error(`vpn-agent returned HTTP ${res.statusCode}: ${data}`)
            err.statusCode = res.statusCode
            reject(err)
          }
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error('vpn-agent UDS request timed out after 5000ms'))
      })

      req.on('error', (err) => {
        logger.warn({ error: err.message, socketPath: this.socketPath }, '[WireGuardAgentProvider] Socket request failed')
        reject(err)
      })

      if (bodyStr) {
        req.write(bodyStr)
      }
      req.end()
    })
  }

  /**
   * Fallback for direct exec on container with host networking & wg tool (args array, never shell)
   */
  async _directExec(method, path, body) {
    return new Promise((resolve, reject) => {
      let args
      if (path === '/peers/add' && body) {
        args = ['set', this.interfaceName, 'peer', body.publicKey, 'allowed-ips', `${body.ip}/32`]
      } else if (path === '/peers/remove' && body) {
        args = ['set', this.interfaceName, 'peer', body.publicKey, 'remove']
      } else if (path === '/peers') {
        args = ['show', this.interfaceName, 'dump']
      } else {
        return resolve({})
      }

      execFile('wg', args, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          logger.warn({ error: error.message, stderr }, '[WireGuardAgentProvider] Direct wg execution failed')
          return reject(error)
        }
        if (path === '/peers') {
          return resolve(this._parseDump(stdout))
        }
        resolve({ success: true })
      })
    })
  }

  _parseDump(dumpText) {
    if (!dumpText) return []
    const lines = dumpText.trim().split('\n')
    // First line is interface info; remaining lines are peers
    const peerLines = lines.slice(1)
    return peerLines.map(line => {
      const parts = line.split('\t')
      if (parts.length < 7) return null
      const [publicKey, , endpoint, allowedIps, latestHandshake, transferRx, transferTx] = parts
      return {
        publicKey,
        endpoint: endpoint !== '(none)' ? endpoint : null,
        allowedIps: allowedIps.split(','),
        latestHandshakeAt: latestHandshake !== '0' ? new Date(parseInt(latestHandshake, 10) * 1000) : null,
        transferRx: parseInt(transferRx, 10) || 0,
        transferTx: parseInt(transferTx, 10) || 0
      }
    }).filter(Boolean)
  }

  async addPeer({ publicKey, ip, expiresAt }) {
    return this._request('POST', '/peers/add', { publicKey, ip, expiresAt })
  }

  async removePeer(publicKey) {
    return this._request('POST', '/peers/remove', { publicKey })
  }

  async listPeers() {
    const res = await this._request('GET', '/peers')
    return Array.isArray(res) ? res : (res.peers || [])
  }

  async syncPeers(peers) {
    return this._request('POST', '/peers/sync', { peers })
  }
}

module.exports = {
  WireGuardAgentProvider
}
