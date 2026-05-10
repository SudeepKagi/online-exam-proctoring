import React, { createContext, useContext, useReducer, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AuthContext = createContext()

const initialState = {
  user: null,
  token: null,
  role: null,
  isLoading: true,
  isAuthenticated: false
}

function authReducer(state, action) {
  switch(action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        role: action.payload.role,
        isAuthenticated: true,
        isLoading: false
      }
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false
      }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Axios default header and rehydration
  useEffect(() => {
    const token = localStorage.getItem('proctornet_token')
    const user = localStorage.getItem('proctornet_user')
    const role = localStorage.getItem('proctornet_role')
    
    if(token && user) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          token,
          user: JSON.parse(user),
          role
        }
      })
    } else {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const login = async (credentials, role) => {
    try {
      const endpoint = {
        admin: '/api/auth/admin/login',
        faculty: '/api/auth/faculty/login',
        student: '/api/auth/student/login'
      }[role]

      const res = await axios.post(`${API}${endpoint}`, credentials)
      
      const { token, user } = res.data
      
      localStorage.setItem('proctornet_token', token)
      localStorage.setItem('proctornet_user', JSON.stringify(user))
      localStorage.setItem('proctornet_role', role)
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user, role }
      })
      
      return { success: true }
    } catch(err) {
      return { 
        success: false, 
        error: err.response?.data?.message || err.response?.data?.error || 'Login failed' 
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('proctornet_token')
    localStorage.removeItem('proctornet_user')
    localStorage.removeItem('proctornet_role')
    localStorage.removeItem('inv_token')
    localStorage.removeItem('inv_examId')
    localStorage.removeItem('inv_session')
    delete axios.defaults.headers.common['Authorization']
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <AuthContext.Provider value={{ 
      ...state, login, logout 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
