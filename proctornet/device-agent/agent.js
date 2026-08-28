const http = require('http')
const { exec } = require('child_process')

const PORT = 49152 // BYOD Agent Port

const BANNED_PROCESS_PATTERNS = [
  // Remote Desktop & Screen Sharing
  'anydesk', 'teamviewer', 'ultraviewer', 'chrome-remote-desktop',
  'vnc', 'vncserver', 'rdp', 'mstsc', 'remotedesktop', 'logmein',
  // AI Assistive Tools & Desktop Clients
  'copilot', 'chatgpt', 'claude', 'cursor', 'ollama', 'lmstudio',
  // Virtual / Injected Cameras & Stream Hijackers
  'obs64', 'obs32', 'camtasia', 'bandicam'
]

const VIRTUAL_CAM_PATTERNS = [
  'obs virtual camera', 'manycam', 'vmix', 'camwiz'
]

/**
 * Scan running processes on host machine (Cross-Platform)
 */
function getRunningProcesses() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'tasklist' : 'ps aux'

    exec(cmd, (err, stdout) => {
      if (err) return resolve([])
      const lines = stdout.toLowerCase().split('\n')
      resolve(lines)
    })
  })
}

/**
 * Passive network check (Read-Only)
 */
function ensureWindowsNetworkReadiness() {
  // Purely passive - do not alter Windows network services
}

/**
 * Inspect local network interfaces for WireGuard VPN tunnel connection (10.0.0.x)
 */
function checkVpnNetwork() {
  ensureWindowsNetworkReadiness()
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'ipconfig /all' : 'ip addr'

    exec(cmd, (err, stdout) => {
      if (err) return resolve({ connected: false, vpnIp: null, interfaceFound: false })

      const lower = stdout.toLowerCase()
      const hasWgInterface = lower.includes('wireguard') || lower.includes('wg0')

      // Match IP pattern in 10.0.0.x range
      const ipMatch = stdout.match(/10\.0\.0\.\d{1,3}/)
      const vpnIp = ipMatch ? ipMatch[0] : null
      const isConnected = Boolean(vpnIp || (hasWgInterface && lower.includes('10.0.0.')))

      resolve({
        connected: isConnected,
        vpnIp,
        interfaceFound: hasWgInterface || Boolean(vpnIp),
        subnet: '10.0.0.0/24'
      })
    })
  })
}

const ALLOWED_AGENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL
].filter(Boolean)

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin

  // D-10: Origin Security Gate - Reject unauthorized 3rd-party web origins
  if (origin && !ALLOWED_AGENT_ORIGINS.includes(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Origin forbidden. BYOD agent only accepts requests from ProctorNet applications.' }))
  }

  // Set specific permitted origin (or * for direct non-browser tools)
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  if (req.url === '/scan') {
    try {
      const processLines = await getRunningProcesses()
      const blockedProcesses = []

      for (const line of processLines) {
        for (const pattern of BANNED_PROCESS_PATTERNS) {
          if (line.includes(pattern) && !blockedProcesses.includes(pattern)) {
            blockedProcesses.push(pattern)
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        agentStatus: 'HEALTHY',
        platform: process.platform,
        blockedProcesses,
        virtualCams: [],
        scannedAt: new Date().toISOString(),
      }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: e.message }))
    }
  }

  if (req.url === '/vpn-check') {
    try {
      const vpnResult = await checkVpnNetwork()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        agentStatus: 'HEALTHY',
        platform: process.platform,
        ...vpnResult,
        scannedAt: new Date().toISOString(),
      }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: e.message }))
    }
  }

function isValidWireGuardConfig(configText) {
  if (!configText || typeof configText !== 'string') return false
  if (configText.length > 4096) return false
  // Reject dangerous directives (PostUp, PreUp, PostDown, PreDown, SaveConfig, command injection)
  const dangerousPatterns = [/postup/i, /preup/i, /postdown/i, /predown/i, /saveconfig/i, /[;&|`$]/]
  for (const pattern of dangerousPatterns) {
    if (pattern.test(configText)) return false
  }
  // Must contain standard sections
  return configText.includes('[Interface]') && configText.includes('[Peer]')
}

  if (req.url === '/vpn-activate' && req.method === 'POST') {
    let bodyStr = ''
    req.on('data', chunk => { bodyStr += chunk })
    req.on('end', async () => {
      try {
        const data = JSON.parse(bodyStr || '{}')
        const configText = data.config || ''
        const targetIp = data.vpnPeerIp || null
        const fs = require('fs')
        const path = require('path')
        const os = require('os')

        if (!isValidWireGuardConfig(configText)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({
            success: false,
            connected: false,
            error: 'Invalid or unsupported WireGuard configuration.'
          }))
        }

        if (process.platform === 'win32' && configText) {
          const tempConfPath = path.join(os.tmpdir(), 'proctornet_tunnel.conf')
          fs.writeFileSync(tempConfPath, configText, 'utf8')

          // Attempt WireGuard CLI service installation if supported
          try {
            await new Promise((resolve) => {
              exec(`wireguard.exe /installtunnelservice "${tempConfPath}"`, (err) => {
                if (err) {
                  console.warn('[agent] WireGuard CLI execution note:', err.message)
                }
                resolve()
              })
            })
          } catch (execErr) {
            console.warn('[agent] WireGuard exec error:', execErr.message)
          }
        }

        // Wait brief moment for interface initialization
        await new Promise(r => setTimeout(r, 1200))
        const vpnResult = await checkVpnNetwork()

        if (vpnResult && vpnResult.connected) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({
            success: true,
            connected: true,
            vpnIp: vpnResult.vpnIp || targetIp,
            message: 'WireGuard VPN tunnel verified and active.',
            ...vpnResult
          }))
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({
            success: false,
            connected: false,
            vpnIp: null,
            message: 'WireGuard VPN tunnel is not active. Please import your assigned .conf file into WireGuard and click Activate.',
            ...vpnResult
          }))
        }
      } catch (e) {
        console.error('[agent] /vpn-activate error:', e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({
          success: false,
          connected: false,
          vpnIp: null,
          error: 'Failed to activate WireGuard VPN tunnel.'
        }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  ensureWindowsNetworkReadiness()
  console.log(`🔒 ProctorNet BYOD Companion Agent running on http://127.0.0.1:${PORT}`)
})
