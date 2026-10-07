/**
 * ProctorNet Exam Device Companion
 * macOS Hardware & Telemetry Collector (Unprivileged)
 * Architecture: Prompt 4 A2 §2
 */

const path = require('path')
const { safeExec } = require('./windows')

let cachedCameras = null
let lastCameraScanTime = 0
const CAMERA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Collects process basenames via ps -axo pid=,comm=
 */
async function collectProcesses() {
  const res = await safeExec('ps', ['-axo', 'pid=,comm='], 5000)
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
      const fullComm = parts.slice(1).join(' ')
      const base = path.basename(fullComm).toLowerCase().trim()
      if (base) processes.add(base)
    }
  }

  return { ok: true, processes }
}

/**
 * Collects display count via system_profiler SPDisplaysDataType -json
 */
async function collectDisplays() {
  const res = await safeExec('system_profiler', ['SPDisplaysDataType', '-json'], 5000)
  if (!res.ok) {
    return { ok: false, code: res.code, count: 1 }
  }

  try {
    const parsed = JSON.parse(res.stdout)
    const displays = parsed?.SPDisplaysDataType?.[0]?.spdisplays_ndrvs || []
    return { ok: true, count: Array.isArray(displays) && displays.length > 0 ? displays.length : 1 }
  } catch {
    return { ok: false, code: 'PARSE_ERROR', count: 1 }
  }
}

/**
 * Collects cameras via system_profiler SPCameraDataType -json (cached 5 min)
 */
async function collectCameras() {
  const now = Date.now()
  if (cachedCameras && now - lastCameraScanTime < CAMERA_CACHE_TTL_MS) {
    return { ok: true, cameraNames: cachedCameras }
  }

  const res = await safeExec('system_profiler', ['SPCameraDataType', '-json'], 6000)
  if (!res.ok) {
    return { ok: false, code: res.code, cameraNames: cachedCameras || [] }
  }

  try {
    const parsed = JSON.parse(res.stdout)
    const items = parsed?.SPCameraDataType || []
    const cameraNames = items.map(c => c._name || '').filter(Boolean)
    cachedCameras = cameraNames
    lastCameraScanTime = now
    return { ok: true, cameraNames }
  } catch {
    return { ok: false, code: 'PARSE_ERROR', cameraNames: [] }
  }
}

/**
 * Collects VM indicator via kern.hv_vmm_present
 */
async function collectVmIndicators() {
  const res = await safeExec('sysctl', ['-n', 'kern.hv_vmm_present'], 3000)
  const indicators = []
  if (res.ok && res.stdout.trim() === '1') {
    indicators.push('hypervisor_vmm')
  }
  return { ok: true, indicators }
}

/**
 * Master macOS Collector
 */
async function collectMacTelemetry() {
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

  // Screen sharing daemon check
  const isRemote = procRes.processes?.has('screensharingd') || false

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
  collectProcesses,
  collectDisplays,
  collectCameras,
  collectVmIndicators,
  collectMacTelemetry
}
