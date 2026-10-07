import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — attach JWT Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('proctornet_token') : null
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
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

// Response interceptor — handle error normalization & 401 session expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
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

    const isAuthRequest =
      error.config?.url?.includes('/login') ||
      error.config?.url?.includes('/register') ||
      error.config?.url?.includes('/auth/me')

    if (error.response?.status === 401 && !isAuthRequest) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('proctornet_token')
        localStorage.removeItem('proctornet_logged_in')
      }

      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('login')) {
        if (currentPath.startsWith('/invigilator')) {
          window.location.href = '/invigilator-login'
        } else if (currentPath.startsWith('/admin')) {
          window.location.href = '/admin/login'
        } else if (currentPath.startsWith('/faculty')) {
          window.location.href = '/faculty/login'
        } else if (currentPath.startsWith('/student') || currentPath.startsWith('/change-password')) {
          window.location.href = '/student/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api

