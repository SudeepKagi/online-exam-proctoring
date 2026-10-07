/**
 * ProctorNet Exam Device Companion
 * Windows Hardware & Telemetry Collector (Unprivileged)
 * Architecture: Prompt 4 A2 §2
 */

const { execFile } = require('child_process')
const { MAX_COMMAND_BUFFER } = require('../config')

/**
 * Safely executes a binary via execFile with large maxBuffer and timeout
 */
function safeExec(file, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    execFile(file, args, {
      timeout: timeoutMs,
      maxBuffer: MAX_COMMAND_BUFFER,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ENOENT') {
          return resolve({ ok: false, code: 'CMD_MISSING', error: error.message, stdout: '' })
        }
        if (error.killed || error.signal === 'SIGTERM') {
          return resolve({ ok: false, code: 'CMD_TIMEOUT', error: 'Command execution timed out', stdout: '' })
        }
        if (error.message && error.message.includes('maxBuffer')) {
          return resolve({ ok: false, code: 'BUFFER_OVERFLOW', error: 'Command output exceeded buffer', stdout: '' })
        }
        return resolve({ ok: false, code: 'CMD_FAILED', error: error.message, stdout: stdout || '' })
      }
      resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' })
    })
  })
}

/**
 * Collects running process base names via tasklist /fo csv /nh
 * Returns Set of lowercase base names (e.g. 'chrome', 'obs64')
 */
async function collectProcesses() {
  const res = await safeExec('tasklist.exe', ['/fo', 'csv', '/nh'], 5000)
  if (!res.ok) {
    return { ok: false, code: res.code, processes: new Set() }
  }

  const processes = new Set()
  const lines = res.stdout.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
    const match = line.match(/^"([^"]+)"/)
    if (match && match[1]) {
      const base = match[1].toLowerCase().replace(/\.exe$/i, '').trim()
      if (base) processes.add(base)
    }
  }

  return { ok: true, processes }
}

/**
 * Collects display count via PowerShell (Screen.AllScreens)
 */
async function collectDisplays() {
  const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens.Count`
  const res = await safeExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], 4000)
  if (!res.ok) {
    return { ok: false, code: res.code, count: 1 }
  }

  const count = parseInt(res.stdout.trim(), 10)
  return { ok: !isNaN(count), count: isNaN(count) ? 1 : count }
}

/**
 * Collects video capture device names via Get-PnpDevice
 */
async function collectCameras() {
  const psScript = `Get-PnpDevice -Class Camera,Image -Status OK -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FriendlyName`
  const res = await safeExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], 5000)
  if (!res.ok) {
    return { ok: false, code: res.code, cameraNames: [] }
  }

  const cameraNames = res.stdout.split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)

  return { ok: true, cameraNames }
}

/**
 * Collects virtual machine hardware indicators (Manufacturer, Model, BIOS)
 */
async function collectVmIndicators() {
  const psScript = `(Get-CimInstance Win32_ComputerSystem).Manufacturer + ' ' + (Get-CimInstance Win32_ComputerSystem).Model + ' ' + (Get-CimInstance Win32_BIOS).SerialNumber`
  const res = await safeExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], 4000)
  if (!res.ok) {
    return { ok: false, code: res.code, indicators: [] }
  }

  const indicators = []
  const combined = (res.stdout || '').toLowerCase()

  const VM_PATTERNS = ['vmware', 'virtualbox', 'qemu', 'kvm', 'virtual machine', 'innotek', 'xen', 'parallels']
  for (const pat of VM_PATTERNS) {
    if (combined.includes(pat)) {
      indicators.push(pat)
    }
  }

  return { ok: true, indicators }
}

/**
 * Detects inbound RDP/remote session indicators
 */
function checkRemoteSession() {
  const sessionName = process.env.SESSIONNAME || ''
  if (/^rdp-/i.test(sessionName)) {
    return true
  }
  return false
}

/**
 * Master Windows Collector
 */
async function collectWindowsTelemetry() {
  const errors = []

  const [procRes, dispRes, camRes, vmRes] = await Promise.all([
    collectProcesses(),
    collectDisplays(),
    collectCameras(),
    collectVmIndicators()
  ])

  if (!procRes.ok) errors.push(`processes:${procRes.code}`)
  if (!dispRes.ok) errors.push(`displays:${dispRes.code}`)
  if (!camRes.ok) errors.push(`cameras:${camRes.code}`)
  if (!vmRes.ok) errors.push(`vm:${vmRes.code}`)

  const isRemote = checkRemoteSession()

  return {
    ok: errors.length === 0,
    errors,
    data: {
      processes: procRes.processes || new Set(),
      displayCount: dispRes.count || 1,
      cameraNames: camRes.cameraNames || [],
      vmIndicators: vmRes.indicators || [],
      isRemoteSession: isRemote
    }
  }
}

module.exports = {
  safeExec,
  collectProcesses,
  collectDisplays,
  collectCameras,
  collectVmIndicators,
  checkRemoteSession,
  collectWindowsTelemetry
}
