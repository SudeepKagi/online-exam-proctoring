/**
 * errorCatalog.js
 * Frontend Error Catalogue (§4.5 Abstraction Spec).
 * 
 * Maps domain error codes to friendly, service-level UX messages.
 * Never renders internal library messages, driver strings, or SQL/Prisma details.
 */

export const ERROR_CATALOG = {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED: 'Please sign in to access your exam session.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again to continue.',
  NOT_AUTHORIZED: 'Access denied. You do not have permission to access this resource.',
  INVALID_CREDENTIALS: 'The username or password entered is incorrect.',
  ACCOUNT_LOCKED: 'Account temporarily locked. Please contact your examination administrator.',
  ACCOUNT_PENDING_APPROVAL: 'Your candidate profile is currently awaiting administrator review.',

  // Exam Access & Session Lifecycle
  EXAM_NOT_FOUND: 'The requested examination could not be found.',
  EXAM_NOT_ACTIVE: 'This examination is not currently open or active.',
  EXAM_ALREADY_SUBMITTED: 'This examination has already been completed and submitted.',
  EXAM_TERMINATED: 'This examination session was concluded by the proctoring service.',
  EXAM_SUSPENDED: 'This examination session is currently suspended.',
  EXAM_ENDED: 'The official examination window has concluded.',
  SESSION_NOT_ACTIVE: 'This examination session is no longer active.',
  MULTI_TAB_PROHIBITED: 'Multiple exam windows detected. Please return to your primary exam tab.',

  // Network & Environment
  VPN_REQUIRED: 'A secure network connection is required for this examination.',
  VPN_DISCONNECTED: 'Secure network connection disconnected. Please reconnect to resume your examination.',
  PROHIBITED_PROCESS: 'Prohibited background software detected. Please close external applications.',
  MEDIA_PERMISSION_DENIED: 'Camera and microphone access is required to proceed.',
  SCREEN_SHARE_REQUIRED: 'Entire screen sharing is required to proceed.',

  // Submission & Validation
  VALIDATION_ERROR: 'Please check your inputs and ensure all required fields are complete.',
  FIELD_NOT_ALLOWED: 'This field cannot be modified directly. Please contact administration for changes.',
  STALE_REVISION: 'Your changes could not be saved because the data was updated elsewhere.',
  FORBIDDEN: 'Access denied. You do not have permission to access this resource.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again to continue.',
  CONFLICT: 'This operation conflicts with an existing record or active session.',
  RATE_LIMITED: 'Request limit reached. Please wait a moment before trying again.',
  CONCURRENT_SUBMISSION: 'Another submission is currently in progress.',

  // Generic System Failures
  SERVICE_UNAVAILABLE: 'The exam service is temporarily undergoing maintenance. Please retry shortly.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.'
}

export const errorMessage = formatErrorMessage

/**
 * Format any frontend or backend error into a friendly, abstracted service-level message.
 * Never leaks axios/Prisma/SQL or stack details to the user.
 * 
 * @param {Error|Object|string} error 
 * @param {string} [fallback] 
 * @returns {string}
 */
export function formatErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback

  // If passed an already formatted clean user string without tech jargon
  if (typeof error === 'string') {
    if (isTechnicalString(error)) {
      return fallback
    }
    return error
  }

  // Network offline or unreachable (Axios / fetch error)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return "We couldn't reach the exam service in time. Please check your connection."
    }
    return "We couldn't reach the exam service. Check your connection."
  }

  const { status, data, headers } = error.response

  // Extract request ID if available for auditing
  const requestId = data?.requestId || data?.error?.requestId || headers?.['x-request-id'] || ''
  const refSuffix = requestId ? ` Reference: ${requestId}` : ''

  // Canonical error code from backend response envelope
  const code = data?.code || data?.errorCode || data?.error?.code

  if (code && ERROR_CATALOG[code]) {
    return ERROR_CATALOG[code] + (status >= 500 ? refSuffix : '')
  }

  // Handle standard HTTP statuses cleanly
  if (status === 401) {
    return ERROR_CATALOG.SESSION_EXPIRED
  }
  if (status === 403) {
    return ERROR_CATALOG.NOT_AUTHORIZED
  }
  if (status === 404) {
    return 'The requested exam item or resource was not found.'
  }
  if (status === 409) {
    return 'This operation conflicts with an existing record or active session.'
  }
  if (status === 422) {
    return ERROR_CATALOG.VALIDATION_ERROR
  }
  if (status === 429) {
    return ERROR_CATALOG.RATE_LIMITED
  }

  // Check if message is a clean, non-technical message provided by the application
  const explicitMsg = data?.message || data?.error?.message || data?.error
  if (typeof explicitMsg === 'string' && explicitMsg.trim().length > 0 && !isTechnicalString(explicitMsg)) {
    return explicitMsg
  }

  // 5xx and unknown failures
  return `Something went wrong. Please try again.${refSuffix}`
}

function isTechnicalString(str) {
  if (!str) return false
  const TECHNICAL_PATTERN = /\b(prisma|postgres|sql|econnrefused|jwt|syntaxerror|typeerror|internal server error|axios|stack|wireguard|livekit|webrtc)\b/i
  return TECHNICAL_PATTERN.test(str)
}
