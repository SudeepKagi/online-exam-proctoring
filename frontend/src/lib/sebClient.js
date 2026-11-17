/**
 * Safe Exam Browser (SEB) Client Utilities
 * Provides browser detection, JS API key harvesting, and multi-protocol ping verification.
 */

/**
 * Detects whether the current browser is Safe Exam Browser.
 * Inspects window.SafeExamBrowser, navigator.userAgent, and document attributes.
 * @returns {boolean}
 */
export function isSebBrowser() {
  if (typeof window === 'undefined') return false

  // 1. Direct JS API object injected by SEB
  if (window.SafeExamBrowser && typeof window.SafeExamBrowser === 'object') {
    return true
  }

  // 2. User Agent inspection (SEB appends version to User Agent)
  const ua = (typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '')
  if (/SEB|SafeExamBrowser/i.test(ua)) {
    return true
  }

  return false
}

/**
 * Retrieves client credentials exposed by Safe Exam Browser's JavaScript API.
 * Modern SEB (v3.x+ on Windows, macOS, iOS) exposes window.SafeExamBrowser.security.
 * @returns {Promise<{ configKey: string | null, browserExamKey: string | null, isSeb: boolean }>}
 */
export async function getSebCredentials() {
  if (typeof window === 'undefined') {
    return { configKey: null, browserExamKey: null, isSeb: false }
  }

  const isSeb = isSebBrowser()
  const sec = window.SafeExamBrowser?.security

  if (!sec) {
    return { configKey: null, browserExamKey: null, isSeb }
  }

  // Try direct synchronous properties first
  let configKey = sec.configKey || null
  let browserExamKey = sec.browserExamKey || null

  // If updateKeys callback is available, invoke it
  if (typeof sec.updateKeys === 'function') {
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 300) // 300ms max wait
        sec.updateKeys(() => {
          clearTimeout(timeout)
          configKey = sec.configKey || configKey
          browserExamKey = sec.browserExamKey || browserExamKey
          resolve()
        })
      })
    } catch (_) {}
  }

  return {
    configKey: configKey ? String(configKey).trim().toLowerCase() : null,
    browserExamKey: browserExamKey ? String(browserExamKey).trim().toLowerCase() : null,
    isSeb
  }
}

/**
 * Verifies the current browser session against the backend SEB ping endpoint.
 * Dispatches both JS API credentials and current URL metadata via POST.
 * Caches result in sessionStorage for quick sync across route changes.
 *
 * @param {import('axios').AxiosInstance} client - Axios apiClient instance
 * @returns {Promise<{ verified: boolean, method?: string, isSeb: boolean }>}
 */
export async function verifySebSession(client) {
  if (typeof window === 'undefined') {
    return { verified: false, isSeb: false }
  }

  const isSeb = isSebBrowser()
  const { configKey, browserExamKey } = await getSebCredentials()

  const payload = {
    configKey: configKey || undefined,
    browserExamKey: browserExamKey || undefined,
    href: window.location.href,
    origin: window.location.origin,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  }

  try {
    const res = await client.post('/seb/ping', payload)
    const verified = Boolean(res.data?.verified)
    const method = res.data?.method || null

    if (verified) {
      try {
        sessionStorage.setItem('proctornet_seb_verified', 'true')
        sessionStorage.setItem('proctornet_seb_verified_at', new Date().toISOString())
        if (method) sessionStorage.setItem('proctornet_seb_method', method)
      } catch (_) {}
    } else {
      try {
        sessionStorage.removeItem('proctornet_seb_verified')
      } catch (_) {}
    }

    return {
      verified,
      method,
      isSeb: Boolean(isSeb || res.data?.isSebAgent)
    }
  } catch (err) {
    // Fallback: try GET /seb/ping for backwards compatibility
    try {
      const getRes = await client.get('/seb/ping')
      const verified = Boolean(getRes.data?.verified)
      if (verified) {
        sessionStorage.setItem('proctornet_seb_verified', 'true')
      }
      return { verified, isSeb }
    } catch (_) {
      return { verified: false, isSeb }
    }
  }
}
