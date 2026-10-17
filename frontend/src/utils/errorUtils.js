/**
 * errorUtils.js
 * Centralized error parsing and user-friendly message generation.
 * Integrates with errorCatalog.js (§4.5 Abstraction Spec).
 */

import { ERROR_CATALOG, formatErrorMessage } from '../lib/errorCatalog'

export { ERROR_CATALOG, formatErrorMessage }

export function getErrorMessage(error, fallbackMessage = 'Something went wrong. Please try again.') {
  return formatErrorMessage(error, fallbackMessage)
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
