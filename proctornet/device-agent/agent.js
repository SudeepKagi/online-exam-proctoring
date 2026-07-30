const express = require('express')
const cors = require('cors')
const { exec } = require('child_process')

const app = express()
const PORT = 49152 // BYOD Agent Port

app.use(cors({ origin: '*' }))
app.use(express.json())

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
    const cmd = isWin ? 'tasklist /FO CSV' : 'ps aux'

    exec(cmd, (err, stdout) => {
      if (err || !stdout) return resolve([])
      const lines = stdout.toLowerCase().split('\n')
      const found = []

      lines.forEach((line) => {
        BANNED_PROCESS_PATTERNS.forEach((pattern) => {
          if (line.includes(pattern) && !found.includes(pattern)) {
            found.push(pattern)
          }
        })
      })

      resolve(found)
    })
  })
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'ProctorNet BYOD Agent v1.0', platform: process.platform })
})

app.get('/scan', async (req, res) => {
  const foundProcesses = await getRunningProcesses()
  
  res.json({
    ok: foundProcesses.length === 0,
    timestamp: new Date().toISOString(),
    blockedProcesses: foundProcesses,
    virtualCams: [],
    platform: process.platform,
  })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🛡️  ProctorNet BYOD Local Agent listening on http://127.0.0.1:${PORT}`)
})
