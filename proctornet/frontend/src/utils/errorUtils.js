/**
 * errorUtils.js
 * Centralized error parsing, classification, and user-friendly message generation.
 * Maps canonical backend domain error codes to UX guidance.
 */

const DOMAIN_ERROR_MAP = {
  AUTHENTICATION_REQUIRED: 'Your authentication credentials are missing or expired. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again to continue.',
  NOT_AUTHORIZED: 'Access denied. You do not have permission to access this resource or perform this action.',
  EXAM_NOT_FOUND: 'The specified examination could not be found.',
  EXAM_NOT_ACTIVE: 'This examination is not currently open or active.',
  EXAM_ALREADY_SUBMITTED: 'This examination has already been completed and submitted.',
  EXAM_TERMINATED: 'This examination session was terminated by an invigilator for academic integrity violation.',
  EXAM_SUSPENDED: 'This examination session is currently suspended.',
  EXAM_ENDED: 'The official examination window has closed.',
  VPN_REQUIRED: 'WireGuard VPN connection is mandatory for this assessment. Please activate your tunnel.',
  VPN_DISCONNECTED: 'WireGuard VPN tunnel disconnected. Please reactivate WireGuard to resume your exam.',
  MULTI_TAB_PROHIBITED: 'Multiple simultaneous exam tabs detected. Please close extra tabs.',
  SESSION_NOT_ACTIVE: 'This examination session is no longer active.',
  RATE_LIMITED: 'Request limit reached. Please wait a moment before trying again.',
  INTERNAL_ERROR: 'The examination platform encountered an unexpected error. Please retry.'
}

export function getErrorMessage(error, fallbackMessage = 'An unexpected error occurred. Please try again.') {
  if (!error) return fallbackMessage

  // String error
  if (typeof error === 'string') return error

  // Network / Connection errors
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'The request timed out. Please check your network connection and try again.'
    }
    if (error.message === 'Network Error' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return 'You appear to be offline. Please verify your internet connection.'
    }
    return 'Unable to reach the server. Please check your connection or try again shortly.'
  }

  const { status, data } = error.response
  const code = data?.code || data?.errorCode
  if (code && DOMAIN_ERROR_MAP[code]) {
    return DOMAIN_ERROR_MAP[code]
  }

  const serverMsg = data?.error || data?.message || data?.details

  // If server provided a clean explicit string, check if it's descriptive
  if (typeof serverMsg === 'string' && serverMsg.length > 0 && !serverMsg.includes('PrismaClient') && !serverMsg.includes('SyntaxError')) {
    return serverMsg
  }

  // Canonical HTTP Status Code mapping
  switch (status) {
    case 400:
      return serverMsg || 'The request could not be processed. Please check your input.'
    case 401:
      return 'Your session has expired. Please log in again to continue.'
    case 403:
      return 'Access denied. You do not have permission to perform this action.'
    case 404:
      return 'The requested resource was not found.'
    case 409:
      return 'A conflict occurred. This record or operation already exists.'
    case 422:
      return 'Validation failed. Please verify that all required fields are correctly filled.'
    case 429:
      return 'Too many requests. Please slow down and wait a moment before trying again.'
    case 500:
      return 'The server encountered an error processing your request. Please try again shortly.'
    case 502:
    case 503:
    case 504:
      return 'The service is temporarily unavailable or undergoing maintenance. Please retry in a few moments.'
    default:
      return serverMsg || fallbackMessage
  }
}

export function getErrorCategory(error) {
  if (!error?.response) return 'network'
  const status = error.response.status
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'general'
}
