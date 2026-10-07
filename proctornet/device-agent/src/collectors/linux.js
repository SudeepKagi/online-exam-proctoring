/**
 * ProctorNet Exam Device Companion
 * Linux Hardware & Telemetry Collector (Unprivileged)
 * Architecture: Prompt 4 A2 §2
 */

const fs = require('fs')
const path = require('path')
const { safeExec } = require('./windows')

/**
 * Collects process basenames via ps -eo pid=,comm=
 */
async function collectProcesses() {
  const res = await safeExec('ps', ['-eo', 'pid=,comm='], 5000)
  if (!res.ok) {
    return { ok: false, code: res.code, processes: new Set() }
  }

  const processes = new Set()
  const lines = res.stdout.split(/\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      const comm = parts.slice(1).join(' ')
      const base = path.basename(comm).toLowerCase().trim()
      if (base) processes.add(base)
    }
  }

  return { ok: true, processes }
}

/**
 * Collects display count via xrandr --query
 */
async function collectDisplays() {
  const res = await safeExec('xrandr', ['--query'], 4000)
  if (!res.ok) {
    // Under Wayland or headless, xrandr may not be available. Best effort: default 1
    return { ok: true, count: 1 }
  }

  // Count " connected"
  const matches = res.stdout.match(/\bconnected\b/g)
  return { ok: true, count: matches ? matches.length : 1 }
}

/**
 * Collects video device names from /sys/class/video4linux
 */
async function collectCameras() {
  const cameraNames = []
  try {
    const baseDir = '/sys/class/video4linux'
    if (fs.existsSync(baseDir)) {
      const entries = fs.readdirSync(baseDir)
      for (const entry of entries) {
        const namePath = path.join(baseDir, entry, 'name')
        if (fs.existsSync(namePath)) {
          const devName = fs.readFileSync(namePath, 'utf8').trim()
          if (devName) cameraNames.push(devName)
        }
      }
    }
  } catch {
    // Best-effort
  }

  return { ok: true, cameraNames }
}

/**
 * Collects VM indicator via systemd-detect-virt or DMI
 */
async function collectVmIndicators() {
  const indicators = []

  const res = await safeExec('systemd-detect-virt', [], 3000)
  if (res.ok) {
    const virt = res.stdout.trim().toLowerCase()
    if (virt && virt !== 'none') {
      indicators.push(virt)
    }
  } else {
    // Fallback: check /sys/class/dmi/id/product_name
    try {
      const dmiPath = '/sys/class/dmi/id/product_name'
      if (fs.existsSync(dmiPath)) {
        const prod = fs.readFileSync(dmiPath, 'utf8').trim().toLowerCase()
        if (prod.includes('virtualbox') || prod.includes('vmware') || prod.includes('kvm') || prod.includes('qemu')) {
          indicators.push(prod)
        }
      }
    } catch {
      // Best-effort
    }
  }

  return { ok: true, indicators }
}

/**
 * Master Linux Collector
 */
async function collectLinuxTelemetry() {
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

  return {
    ok: errors.length === 0,
    errors,
    data: {
      processes: procRes.processes || new Set(),
      displayCount: dispRes.count || 1,
      cameraNames: camRes.cameraNames || [],
      vmIndicators: vmRes.indicators || [],
      isRemoteSession: false
    }
  }
}

module.exports = {
  collectProcesses,
  collectDisplays,
  collectCameras,
  collectVmIndicators,
  collectLinuxTelemetry
}
