import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response interceptor — handle 401 session expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest =
      error.config?.url?.includes('/login') ||
      error.config?.url?.includes('/register') ||
      error.config?.url?.includes('/auth/me')

    if (error.response?.status === 401 && !isAuthRequest) {
      const currentPath = window.location.pathname
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
    return Promise.reject(error)
  }
)

export default api

