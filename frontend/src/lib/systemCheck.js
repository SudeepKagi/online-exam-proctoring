/**
 * ProctorNet Student System Readiness Checks
 * Measures camera access, network latency, server clock skew, and OS compatibility.
 */

export const CLOCK_SKEW_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Evaluates clock skew between client and server.
 * Invariant: Never blocks the student (blocked is always false). Warns if skew > 2 minutes.
 *
 * @param {number|Date|string} clientTime - Client epoch or Date
 * @param {number|Date|string} serverTime - Server epoch or Date
 * @returns {{ passed: boolean, warning: boolean, blocked: false, skewMs: number, skewMinutes: number, message: string }}
 */
export function evaluateClockSkew(clientTime, serverTime) {
  const clientMs = typeof clientTime === 'number' ? clientTime : new Date(clientTime).getTime()
  const serverMs = typeof serverTime === 'number' ? serverTime : new Date(serverTime).getTime()

  if (Number.isNaN(clientMs) || Number.isNaN(serverMs)) {
    return {
      passed: true,
      warning: true,
      blocked: false,
      skewMs: 0,
      skewMinutes: 0,
      message: 'Unable to synchronize time with server. Your exam will use server-authoritative time.'
    }
  }

  const skewMs = Math.abs(clientMs - serverMs)
  const skewMinutes = Math.max(1, Math.round(skewMs / 60000))
  const isSkewed = skewMs > CLOCK_SKEW_THRESHOLD_MS

  if (isSkewed) {
    return {
      passed: true,
      warning: true,
      blocked: false,
      skewMs,
      skewMinutes,
      message: `Your computer clock differs by ~${skewMinutes} min from the exam server. Please adjust your system time.`
    }
  }

  const skewSeconds = Math.round(skewMs / 1000)
  return {
    passed: true,
    warning: false,
    blocked: false,
    skewMs,
    skewMinutes: 0,
    message: skewSeconds <= 1 ? 'Clock perfectly synchronized' : `Clock in sync (${skewSeconds}s difference)`
  }
}

/**
 * Evaluates round-trip network latency.
 *
 * @param {number} latencyMs - Milliseconds measured for round trip
 * @returns {{ passed: boolean, latencyMs: number, rating: 'Good'|'Fair'|'Poor', message: string }}
 */
export function evaluateLatency(latencyMs) {
  const ms = Math.max(0, Math.round(latencyMs))
  if (ms < 150) {
    return {
      passed: true,
      latencyMs: ms,
      rating: 'Good',
      message: `Fast connection (${ms} ms latency)`
    }
  }
  if (ms < 600) {
    return {
      passed: true,
      latencyMs: ms,
      rating: 'Fair',
      message: `Stable connection (${ms} ms latency)`
    }
  }
  return {
    passed: true, // Warn rather than hard-block
    latencyMs: ms,
    rating: 'Poor',
    message: `High latency detected (${ms} ms). Responses may take longer to save.`
  }
}

/**
 * Evaluates client operating system compatibility.
 *
 * @param {boolean} sebRequired - Whether this exam mandates Safe Exam Browser
 * @param {string} [customUserAgent] - Optional override for testing
 * @returns {{ isWindows: boolean, compatible: boolean, message: string, supportContact?: string }}
 */
export function evaluateOperatingSystem(sebRequired, customUserAgent) {
  const ua = customUserAgent || (typeof navigator !== 'undefined' ? (navigator.userAgent || navigator.platform || '') : '')
  const isWindows = /Windows|Win32|Win64|WOW64/i.test(ua)

  const supportContact = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL) || 'support@institution.edu'

  if (sebRequired && !isWindows) {
    return {
      isWindows: false,
      compatible: false,
      message: 'This secure exam is configured for Windows. Please use a Windows computer or contact your instructor.',
      supportContact
    }
  }

  return {
    isWindows,
    compatible: true,
    message: isWindows ? 'Windows computer detected (Compatible)' : 'Computer operating system compatible'
  }
}

const STORAGE_KEY = 'proctornet_readiness_check'

/**
 * Persists readiness check results to localStorage.
 */
export function saveReadinessResult(results) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...results,
        timestamp: Date.now()
      }))
    }
  } catch (_) {}
}

/**
 * Retrieves cached readiness check result.
 */
export function getSavedReadinessResult() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    }
  } catch (_) {
    return null
  }
  return null
}
