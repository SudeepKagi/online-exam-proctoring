/**
 * Client Error Mapping & Sanitization Utility (§Phase 4 Standard)
 * Codifies .agents/skills/client-error-resilience/SKILL.md
 * Never leaks raw stack traces, SQL errors, or [object Object].
 */

export function generateReferenceId(prefix = 'REF') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${code}`
}

const ERROR_CODE_MAP = {
  TOKEN_EXPIRED: {
    title: 'Session Expired',
    message: 'Your secure session has timed out. Please sign in again to continue.',
    action: 'login',
    actionLabel: 'Sign In'
  },
  TOKEN_INVALID: {
    title: 'Session Invalid',
    message: 'Your credentials could not be verified. Please sign in again.',
    action: 'login',
    actionLabel: 'Sign In'
  },
  SEB_REQUIRED: {
    title: 'Secure Browser Required',
    message: 'This examination requires Safe Exam Browser. Please launch the exam using the Safe Exam Browser link.',
    action: 'seb_link',
    actionLabel: 'Launch Safe Exam Browser'
  },
  SEB_CONFIG_KEY_MISMATCH: {
    title: 'Security Settings Mismatch',
    message: 'Your Safe Exam Browser configuration does not match the official exam configuration.',
    action: 'diagnostics',
    actionLabel: 'Run Diagnostics'
  },
  SEB_PIN_INVALID: {
    title: 'Access Code Invalid',
    message: 'The 6-digit access code entered does not match an active session for this exam.',
    action: 'retry',
    actionLabel: 'Try Again'
  },
  ATTEMPT_ALREADY_EXISTS: {
    title: 'Exam Already Completed',
    message: 'An attempt has already been submitted for this examination. Repeat attempts are not permitted.',
    action: 'results',
    actionLabel: 'View Results'
  },
  ATTEMPT_TERMINATED: {
    title: 'Session Terminated',
    message: 'This examination session has been concluded. Please check your submission status.',
    action: 'dashboard',
    actionLabel: 'Return to Dashboard'
  },
  EXAM_NOT_OPEN: {
    title: 'Exam Not Yet Open',
    message: 'The scheduled testing window for this exam has not opened yet. Please check back at the scheduled start time.',
    action: 'dashboard',
    actionLabel: 'Return to Dashboard'
  },
  EXAM_ENDED: {
    title: 'Exam Window Closed',
    message: 'The scheduled window for this exam has ended. Submissions are no longer accepted.',
    action: 'dashboard',
    actionLabel: 'Return to Dashboard'
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    message: 'You have sent too many requests in a short period. Please wait a moment before trying again.',
    action: 'retry',
    actionLabel: 'Try Again'
  },
  NETWORK_ERROR: {
    title: 'Connection Issue',
    message: 'Unable to reach the examination server. Your answers are saved locally and will sync once connectivity returns.',
    action: 'retry',
    actionLabel: 'Retry Connection'
  },
  INTERNAL_ERROR: {
    title: 'Service Temporarily Unavailable',
    message: 'Our servers encountered an unexpected issue. Your exam progress is preserved. Please try again.',
    action: 'retry',
    actionLabel: 'Retry'
  }
}

export function mapClientError(error, defaultAction = 'retry') {
  const referenceId = generateReferenceId('ERR')

  // Handle null / undefined
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Unexpected Issue',
      message: 'An unexpected issue occurred. Please try again.',
      action: defaultAction,
      actionLabel: 'Retry',
      referenceId
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: 'CLIENT_MESSAGE',
      title: 'Notice',
      message: error,
      action: defaultAction,
      actionLabel: 'Dismiss',
      referenceId
    }
  }

  // Extract from Axios / API response payload
  const responseData = error.response?.data
  const status = error.response?.status
  const backendCode = responseData?.code || responseData?.error || (status ? `HTTP_${status}` : null)
  const backendMsg = responseData?.message || responseData?.error

  // Check known code mapping
  if (backendCode && ERROR_CODE_MAP[backendCode]) {
    const entry = ERROR_CODE_MAP[backendCode]
    return {
      code: backendCode,
      title: entry.title,
      message: backendMsg || entry.message,
      action: entry.action,
      actionLabel: entry.actionLabel,
      referenceId: responseData?.referenceId || referenceId
    }
  }

  // HTTP status fallbacks
  if (status === 401) {
    return {
      code: 'TOKEN_EXPIRED',
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again to continue.',
      action: 'login',
      actionLabel: 'Sign In',
      referenceId
    }
  }

  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      title: 'Access Restricted',
      message: backendMsg || 'You do not have permission to view or access this resource.',
      action: 'dashboard',
      actionLabel: 'Return to Dashboard',
      referenceId
    }
  }

  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      title: 'Resource Not Found',
      message: backendMsg || 'The requested exam, session, or record could not be found.',
      action: 'dashboard',
      actionLabel: 'Return to Dashboard',
      referenceId
    }
  }

  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      title: 'Too Many Requests',
      message: backendMsg || 'Please pause for a few seconds before trying again.',
      action: 'retry',
      actionLabel: 'Try Again',
      referenceId
    }
  }

  if (status >= 500) {
    return {
      code: 'SERVER_ERROR',
      title: 'Server Error',
      message: 'The examination server encountered a temporary error. Your saved progress is intact.',
      action: 'retry',
      actionLabel: 'Retry',
      referenceId
    }
  }

  // Network offline / abort / timeout
  if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
    return {
      code: 'NETWORK_ERROR',
      title: 'Connection Disrupted',
      message: 'Unable to connect to the exam server. Your saved answers are safely preserved in offline storage.',
      action: 'retry',
      actionLabel: 'Retry Connection',
      referenceId
    }
  }

  // Default clean human-readable error (never raw stack)
  return {
    code: 'GENERAL_ERROR',
    title: 'Operation Failed',
    message: typeof error.message === 'string' && !error.message.includes('[object') && !error.message.includes('at ')
      ? error.message
      : 'An unexpected issue occurred while processing your request. Please try again.',
    action: defaultAction,
    actionLabel: 'Retry',
    referenceId
  }
}
