import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  response => response,
  error => {
    // Only redirect if it's a 401 AND not a login/register request
    const isAuthRequest = error.config?.url?.includes('/login') || error.config?.url?.includes('/register')
    
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('proctornet_auth')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api
