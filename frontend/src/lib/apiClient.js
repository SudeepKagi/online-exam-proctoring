import axios from 'axios'

const baseURL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1'

export const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

api.interceptors.request.use(
  (config) => {
    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.error) {
      const errObj = error.response.data.error
      if (typeof errObj === 'object' && errObj !== null) {
        error.code = errObj.code || error.code
        error.message = errObj.message || errObj.code || error.message
      } else if (typeof errObj === 'string') {
        error.message = errObj
      }
    }
    return Promise.reject(error)
  }
)

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err.response?.data?.error) {
    const error = err.response.data.error
    if (typeof error === 'string') return error
    if (error.message) return error.message
    if (error.code) return error.code
  }
  if (err.response?.data?.message) return err.response.data.message
  if (err.message) return err.message
  return fallback
}

export function reportClientError(err, context = {}) {
  const payload = {
    message: err?.message || String(err),
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
    context,
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Client Error]', payload)
  }
}

export function ensureArray(val) {
  return Array.isArray(val) ? val : []
}

export const apiClient = {
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  patch: (url, data, config) => api.patch(url, data, config),
  delete: (url, config) => api.delete(url, config),
}

export default apiClient
