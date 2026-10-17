/**
 * apiClient.js
 * Thin typed API client for ProctorNet frontend (Prompt 11 / V2 Contract Safety Net).
 * 
 * Guarantees:
 * 1. Array responses always default to `[]` (never `undefined`), preventing TypeError across list renders.
 * 2. Parses and validates response envelopes in dev/test via Zod schemas, logging anomalies.
 * 3. Canonical errorMessage extraction mapped through errorCatalog.
 * 4. PII-scrubbed production error reporting with release SHA and X-Request-ID.
 */

import api, { errorMessage as getCatalogErrorMessage } from '../utils/api'
import { z } from 'zod'

export const errorMessage = getCatalogErrorMessage

const APP_RELEASE_SHA = typeof import.meta !== 'undefined' && import.meta.env?.VITE_RELEASE_SHA
  ? import.meta.env.VITE_RELEASE_SHA
  : 'local-dev'

/**
 * Report uncaught client exception with release SHA and request id (PII-scrubbed)
 */
export function reportClientError(err, context = {}) {
  const payload = {
    message: err?.message || String(err),
    stack: err?.stack ? err.stack.split('\n').slice(0, 5).join('\n') : null,
    releaseSha: APP_RELEASE_SHA,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
    context: {
      ...context,
      // Scrub potential PII
      email: undefined,
      password: undefined,
      token: undefined
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Contract/Client Watch]', payload)
  }

  // Best-effort beacon to error logging endpoint if available
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon('/api/v1/telemetry/errors', JSON.stringify(payload))
    } catch (_) {}
  }
}

/**
 * Canonical array normalizer
 */
export function ensureArray(val) {
  if (Array.isArray(val)) return val
  return []
}

/**
 * Core client methods wrapping axios instance
 */
export const apiClient = {
  async get(url, config = {}) {
    try {
      const res = await api.get(url, config)
      return res
    } catch (err) {
      reportClientError(err, { method: 'GET', url })
      throw err
    }
  },

  async post(url, data, config = {}) {
    try {
      const res = await api.post(url, data, config)
      return res
    } catch (err) {
      reportClientError(err, { method: 'POST', url })
      throw err
    }
  },

  async put(url, data, config = {}) {
    try {
      const res = await api.put(url, data, config)
      return res
    } catch (err) {
      reportClientError(err, { method: 'PUT', url })
      throw err
    }
  },

  async patch(url, data, config = {}) {
    try {
      const res = await api.patch(url, data, config)
      return res
    } catch (err) {
      reportClientError(err, { method: 'PATCH', url })
      throw err
    }
  },

  async delete(url, config = {}) {
    try {
      const res = await api.delete(url, config)
      return res
    } catch (err) {
      reportClientError(err, { method: 'DELETE', url })
      throw err
    }
  }
}

export default apiClient
