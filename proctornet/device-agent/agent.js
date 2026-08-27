const http = require('http')
const { exec } = require('child_process')

const PORT = 49152 // BYOD Agent Port

const BANNED_PROCESS_PATTERNS = [
  'anydesk', 'teamviewer', 'ultraviewer', 'chrome-remote-desktop',
  'vnc', 'vncserver', 'rdp', 'mstsc', 'remotedesktop', 'logmein'
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
 * Automatically ensure Windows Network Setup Service is active without requiring student manual commands
 */
function ensureWindowsNetworkReadiness() {
  if (process.platform !== 'win32') return
  exec('powershell -NoProfile -Command "if ((Get-Service NetSetupSvc -ErrorAction SilentlyContinue).Status -ne \'Running\') { Start-Service NetSetupSvc -ErrorAction SilentlyContinue }"', () => {})
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

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  ensureWindowsNetworkReadiness()
  console.log(`🔒 ProctorNet BYOD Companion Agent running on http://127.0.0.1:${PORT}`)
})
