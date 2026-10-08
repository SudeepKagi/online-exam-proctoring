import axios from 'axios'

// Multi-tab auth synchronization channel (Phase S2 / SES-05)
export const authChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('pn-auth')
  : null

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true, // Automatically sends HttpOnly cookies: pn_at, pn_rt
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// Request interceptor: add unique X-Request-ID and optional Idempotency-Key
api.interceptors.request.use(
  (config) => {
    // Generate UUID / random ID for tracing if not set
    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    // Attach Idempotency-Key for state-mutating operations if provided
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase()) && config.idempotencyKey) {
      config.headers['Idempotency-Key'] = config.idempotencyKey
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Helper to safely extract user-facing error strings (avoids React Error #31)
export function extractErrorMessage(err, fallback = 'An unexpected error occurred') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  const respErr = err.response?.data?.error
  if (typeof respErr === 'string') return respErr
  if (respErr && typeof respErr === 'object' && respErr !== null) {
    return respErr.message || respErr.code || fallback
  }
  if (err.response?.data?.message && typeof err.response.data.message === 'string') {
    return err.response.data.message
  }
  if (err.message && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// Silent Refresh Queue Management
let isRefreshing = false
let failedQueue = []

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

// Response interceptor: handle silent refresh, error normalization, and non-destructive exam re-auth
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Normalize unified error envelope
    if (error.response?.data?.error) {
      const errObj = error.response.data.error
      if (typeof errObj === 'object' && errObj !== null) {
        error.code = errObj.code || error.code
        error.message = errObj.message || errObj.code || error.message
        error.details = errObj.details
      } else if (typeof errObj === 'string') {
        error.message = errObj
      }
    }

    const isAuthUrl =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout') ||
      originalRequest?.url?.includes('/register')

    // Handle 401 Unauthorized via Silent Refresh (SES-04 / S2)
    if (error.response?.status === 401 && !isAuthUrl && !originalRequest?._retry) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Execute silent refresh against /api/v1/auth/refresh
        await api.post('/auth/refresh', {})
        isRefreshing = false
        processQueue(null)
        // Broadcast token refreshed to other tabs
        authChannel?.postMessage({ type: 'REFRESH' })
        // Retry original failed request
        return api(originalRequest)
      } catch (refreshErr) {
        isRefreshing = false
        processQueue(refreshErr)

        // Session refresh completely failed: check if user is taking an active exam
        const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
        const isExamActive =
          pathname.includes('/exam') ||
          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pn_active_attempt'))

        if (isExamActive) {
          // EXAM-AWARE: Never do a hard redirect during an active exam! (SES-04)
          // Broadcast non-destructive re-auth modal event on the current page
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('pn:exam-reauth-required', {
                detail: {
                  message: 'Your session ended — sign in to continue without losing your answers.',
                  originalRequest
                }
              })
            )
          }
          return Promise.reject(refreshErr)
        }

        // Non-exam view: perform clean logout and redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('proctornet_logged_in')
          localStorage.removeItem('proctornet_role')
          authChannel?.postMessage({ type: 'LOGOUT' })

          if (!pathname.includes('/login') && !pathname.includes('login')) {
            if (pathname.startsWith('/invigilator')) {
              window.location.href = '/invigilator-login'
            } else if (pathname.startsWith('/admin')) {
              window.location.href = '/admin/login'
            } else if (pathname.startsWith('/faculty')) {
              window.location.href = '/faculty/login'
            } else if (pathname.startsWith('/student') || pathname.startsWith('/change-password')) {
              window.location.href = '/student/login'
            }
          }
        }

        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
)

export default api
