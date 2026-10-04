/**
 * ops/vpn/vpn-agent.js
 * Privileged WireGuard Sidecar Daemon (P8 Task 2 / ADR-010)
 *
 * Runs with NET_ADMIN capability on host network in a dedicated container.
 * Listens on a Unix domain socket shared via volume with the application container.
 * Authenticates requests via HMAC-SHA256 request signatures.
 * The Node.js application container runs unprivileged with zero NET_ADMIN rights.
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFile } = require('child_process')

const SOCKET_PATH = process.env.VPN_AGENT_SOCK || '/var/run/wireguard/vpn-agent.sock'
const SECRET = process.env.VPN_AGENT_SECRET || 'proctornet_vpn_agent_secret_32_chars_min'
const INTERFACE = process.env.VPN_INTERFACE || 'wg0'

function verifySignature(req, bodyStr) {
  const timestamp = req.headers['x-vpn-timestamp']
  const signature = req.headers['x-vpn-signature']

  if (!timestamp || !signature) {
    return false
  }

  // Reject requests older than 60 seconds (anti-replay guard)
  const now = Math.floor(Date.now() / 1000)
  const reqTime = parseInt(timestamp, 10)
  if (Math.abs(now - reqTime) > 60) {
    return false
  }

  const expectedSignature = crypto.createHmac('sha256', SECRET)
    .update(`${timestamp}.${bodyStr}`)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

function parseDump(dumpText) {
  if (!dumpText) return []
  const lines = dumpText.trim().split('\n')
  const peerLines = lines.slice(1)
  return peerLines.map(line => {
    const parts = line.split('\t')
    if (parts.length < 8) return null
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

function runWg(args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    execFile('wg', args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr
        return reject(error)
      }
      resolve(stdout)
    })
  })
}

const server = http.createServer((req, res) => {
  let bodyStr = ''
  req.on('data', chunk => { bodyStr += chunk })
  req.on('end', async () => {
    const url = req.url
    const method = req.method

    // Health check endpoint (exempt from auth)
    if (url === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ status: 'ok', interface: INTERFACE }))
    }

    // Verify cryptographic signature
    if (!verifySignature(req, bodyStr)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'Invalid or expired signature' }))
    }

    try {
      const body = bodyStr ? JSON.parse(bodyStr) : {}

      if (url === '/peers/add' && method === 'POST') {
        const { publicKey, ip } = body
        if (!publicKey || !ip) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'publicKey and ip are required' }))
        }

        await runWg(['set', INTERFACE, 'peer', publicKey, 'allowed-ips', `${ip}/32`])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, publicKey, ip }))
      }

      if (url === '/peers/remove' && method === 'POST') {
        const { publicKey } = body
        if (!publicKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'publicKey is required' }))
        }

        await runWg(['set', INTERFACE, 'peer', publicKey, 'remove'])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, removed: publicKey }))
      }

      if (url === '/peers' && method === 'GET') {
        const dump = await runWg(['show', INTERFACE, 'dump'])
        const peers = parseDump(dump)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, peers }))
      }

      if (url === '/peers/sync' && method === 'POST') {
        const { peers = [] } = body
        // When > 20 peers change at once, batch update with wg syncconf
        if (peers.length > 20) {
          const tmpConfPath = path.join('/tmp', `wg-sync-${Date.now()}.conf`)
          const confLines = peers.map(p => `[Peer]\nPublicKey = ${p.publicKey}\nAllowedIPs = ${p.ip}/32`).join('\n\n')
          fs.writeFileSync(tmpConfPath, confLines)
          try {
            await runWg(['syncconf', INTERFACE, tmpConfPath])
          } finally {
            try { fs.unlinkSync(tmpConfPath) } catch {}
          }
        } else {
          for (const p of peers) {
            await runWg(['set', INTERFACE, 'peer', p.publicKey, 'allowed-ips', `${p.ip}/32`])
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, count: peers.length }))
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (err) {
      console.error('[vpn-agent error]', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message, stderr: err.stderr }))
    }
  })
})

function start() {
  // Ensure socket directory exists
  const dir = path.dirname(SOCKET_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Remove stale socket if exists
  if (fs.existsSync(SOCKET_PATH)) {
    fs.unlinkSync(SOCKET_PATH)
  }

  server.listen(SOCKET_PATH, () => {
    fs.chmodSync(SOCKET_PATH, '0770')
    console.log(`[vpn-agent] Listening on Unix domain socket: ${SOCKET_PATH}`)
  })
}

if (require.main === module) {
  start()
}

module.exports = {
  server,
  verifySignature,
  parseDump
}
