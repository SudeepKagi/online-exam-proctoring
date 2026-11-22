/**
 * Global Client Error & Unhandled Rejection Reporter (§Phase 4 Standard)
 * Codifies .agents/skills/client-error-resilience/SKILL.md
 * Redacts personal data, rate-limits reports, and guards against unhandled crashes.
 */

let errorCountInWindow = 0
let windowResetTimer = null
const MAX_ERRORS_PER_MINUTE = 10

function isRateLimited() {
  if (!windowResetTimer) {
    windowResetTimer = setTimeout(() => {
      errorCountInWindow = 0
      windowResetTimer = null
    }, 60000)
  }
  errorCountInWindow++
  return errorCountInWindow > MAX_ERRORS_PER_MINUTE
}

export function sanitizeErrorPayload(err) {
  const message = typeof err?.message === 'string' ? err.message : String(err)
  const stack = typeof err?.stack === 'string' ? err.stack.slice(0, 500) : null

  // Redact potential emails, tokens, or JWTs
  const sanitizedMessage = message
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/ey[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')

  return {
    type: err?.name || 'ClientError',
    message: sanitizedMessage,
    stack: stack ? stack.replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]') : undefined,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : '',
    timestamp: new Date().toISOString()
  }
}

export function reportClientError(err, context = 'unhandled') {
  if (isRateLimited()) return

  const payload = sanitizeErrorPayload(err)
  payload.context = context

  // Send to backend telemetry if endpoint is available, fail silently
  if (typeof fetch === 'function') {
    fetch('/api/v1/telemetry/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Intentionally silent: never trigger recursive error handler
    })
  }
}

export function initGlobalErrorListeners() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    if (event.error) {
      reportClientError(event.error, 'window.onerror')
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason || new Error('Unhandled Promise Rejection')
    reportClientError(reason, 'unhandledrejection')
  })
}
