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

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🔒 ProctorNet BYOD Companion Agent running on http://127.0.0.1:${PORT}`)
})
