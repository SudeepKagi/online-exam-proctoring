import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — add token
// Priority: inv_token for invigilator requests, proctornet_token for regular users
api.interceptors.request.use(
  (config) => {
    const invToken = localStorage.getItem('inv_token')
    const regularToken = localStorage.getItem('proctornet_token')
    // Use inv_token if the request is to an invigilator endpoint
    const isInvRoute = config.url?.includes('/invigilator/')
    const token = (isInvRoute && invToken) ? invToken : (regularToken || invToken)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = error.config?.url?.includes('/login') || error.config?.url?.includes('/register')
    
    if (error.response?.status === 401 && !isAuthRequest) {
      const isInvigilatorSession = !!localStorage.getItem('inv_token') && !localStorage.getItem('proctornet_token')
      
      if (isInvigilatorSession) {
        localStorage.removeItem('inv_token')
        localStorage.removeItem('inv_examId')
        localStorage.removeItem('inv_session')
        window.location.href = '/invigilator-login'
      } else {
        const role = localStorage.getItem('proctornet_role')
        localStorage.removeItem('proctornet_token')
        localStorage.removeItem('proctornet_user')
        localStorage.removeItem('proctornet_role')
        
        const loginPath = role === 'admin' ? '/admin/login'
          : role === 'faculty' ? '/faculty/login'
          : '/student/login'
        window.location.href = loginPath
      }
    }
    return Promise.reject(error)
  }
)

export default api
