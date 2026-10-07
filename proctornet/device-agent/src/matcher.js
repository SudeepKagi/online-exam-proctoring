/**
 * ProctorNet Exam Device Companion
 * Rule Matcher Engine & Telemetry Synthesizer
 * Architecture: Prompt 4 §3.4 (Zero False Positives via Base Name Equality)
 */

/**
 * Normalizes an executable base name: strips .exe, converts to lowercase, trims
 */
function normalizeExeName(name) {
  if (!name || typeof name !== 'string') return ''
  return name.replace(/\.exe$/i, '').toLowerCase().trim()
}

/**
 * Matches collected hardware/process telemetry against active policy rules
 * Evaluates rules LOCALLY in memory and produces hits only (data minimization)
 *
 * @param {Object} collectorOutput Output from collector { ok, errors, data }
 * @param {Array<Object>} rules Active policy rules
 * @returns {Object} Report payload { findings, display, session, vm, cameras, collection }
 */
function matchTelemetry(collectorOutput, rules = []) {
  const data = collectorOutput?.data || {}
  const processes = data.processes || new Set()
  const displayCount = data.displayCount || 1
  const cameraNames = data.cameraNames || []
  const vmIndicators = data.vmIndicators || []
  const isRemoteSession = Boolean(data.isRemoteSession)

  const findings = []
  const virtualCamerasFound = []

  // Check virtual cameras from camera device names
  const VIRTUAL_CAM_KEYWORDS = ['obs virtual camera', 'manycam', 'v4l2loopback', 'splitcam', 'snap camera', 'xsplit vcam']
  for (const camName of cameraNames) {
    const lowerCam = camName.toLowerCase()
    for (const kw of VIRTUAL_CAM_KEYWORDS) {
      if (lowerCam.includes(kw)) {
        virtualCamerasFound.push(camName)
        break
      }
    }
  }

  // Iterate over active policy rules
  for (const rule of rules) {
    if (!rule.enabled && rule.enabled !== undefined) continue

    const matchers = rule.matchers || {}
    let matched = false

    // 1. Process base name exact equality
    if (matchers.type === 'exeName') {
      const target = normalizeExeName(matchers.value)
      if (processes.has(target)) {
        matched = true
      }
    }

    // 2. Process base name contains (explicit opt-in)
    else if (matchers.type === 'exeNameContains') {
      const target = normalizeExeName(matchers.value)
      for (const proc of processes) {
        if (proc.includes(target)) {
          matched = true
          break
        }
      }
    }

    // 3. Virtual camera matchers
    else if (rule.category === 'VIRTUAL_CAMERA') {
      if (matchers.type === 'deviceName') {
        const target = (matchers.value || '').toLowerCase()
        if (cameraNames.some(c => c.toLowerCase().includes(target))) {
          matched = true
        }
      } else if (matchers.type === 'exeName') {
        const target = normalizeExeName(matchers.value)
        if (processes.has(target)) {
          matched = true
        }
      } else if (virtualCamerasFound.length > 0) {
        matched = true
      }
    }

    // 4. Remote session indicators
    else if (rule.category === 'REMOTE_SESSION') {
      if (matchers.type === 'exeName') {
        const target = normalizeExeName(matchers.value)
        if (processes.has(target)) {
          matched = true
        }
      }
      if (isRemoteSession && rule.id === 'r-session-rdpclip') {
        matched = true
      }
    }

    // 5. Virtual machine indicators
    else if (rule.category === 'VIRTUAL_MACHINE') {
      if (vmIndicators.length > 0) {
        matched = true
      }
    }

    // 6. Display indicators
    else if (rule.category === 'DISPLAY') {
      if (displayCount > 1) {
        matched = true
      }
    }

    if (matched) {
      findings.push({
        ruleId: rule.id,
        evidence: rule.name
      })
    }
  }

  return {
    findings,
    display: { count: displayCount },
    session: { remote: isRemoteSession },
    vm: { indicators: vmIndicators },
    cameras: { virtual: virtualCamerasFound },
    collection: {
      ok: Boolean(collectorOutput?.ok),
      errors: collectorOutput?.errors || []
    }
  }
}

module.exports = {
  normalizeExeName,
  matchTelemetry
}
