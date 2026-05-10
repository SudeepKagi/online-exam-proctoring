import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('proctornet_token') || localStorage.getItem('inv_token')
    if(token) {
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
    // Check if it's NOT a login/register request
    const isAuthRequest = error.config?.url?.includes('/login') || error.config?.url?.includes('/register')
    
    if(error.response?.status === 401 && !isAuthRequest) {
      localStorage.clear()
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api
