import React, { createContext, useContext, useReducer, useEffect } from 'react'
import api from '@/utils/api'

const AuthContext = createContext()

const initialState = {
  user: null,
  token: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
}

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        role: action.payload.role,
        isAuthenticated: true,
        isLoading: false,
      }
    case 'LOGOUT':
      return { ...initialState, isLoading: false }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('proctornet_token')
    const user = localStorage.getItem('proctornet_user')
    const role = localStorage.getItem('proctornet_role')

    if (token && user) {
      try {
        // Keep token in sync with api interceptor
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { token, user: JSON.parse(user), role },
        })
      } catch {
        localStorage.removeItem('proctornet_token')
        localStorage.removeItem('proctornet_user')
        localStorage.removeItem('proctornet_role')
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  /**
   * login(credentials, role)
   * Calls the correct auth endpoint based on role.
   * api.js interceptor attaches the token automatically on subsequent requests.
   */
  const login = async (credentials, role) => {
    const endpoints = {
      admin:   '/auth/admin/login',
      faculty: '/auth/faculty/login',
      student: '/auth/student/login',
    }

    try {
      const res = await api.post(endpoints[role], credentials)
      const { token, user } = res.data

      localStorage.setItem('proctornet_token', token)
      localStorage.setItem('proctornet_user', JSON.stringify(user))
      localStorage.setItem('proctornet_role', role)

      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, user, role } })
      return { success: true }
    } catch (err) {
      const status     = err.response?.data?.status
      const httpStatus = err.response?.status

      if (!err.response) {
        return { success: false, error: 'Unable to connect to server. Check your internet connection.' }
      }

      if (status === 'PENDING_APPROVAL' || status === 'PENDING_ADMIN' || status === 'PENDING_FACULTY') {
        return { success: false, error: "Your account is awaiting admin approval. You'll be notified by email." }
      }
      if (status === 'SUSPENDED') {
        return { success: false, error: 'Your account has been suspended. Please contact the administrator.' }
      }
      if (status === 'REJECTED') {
        const reason = err.response?.data?.reason
        return { success: false, error: `Registration rejected${reason ? ': ' + reason : '. Contact admin.'}` }
      }

      if (httpStatus === 401) return { success: false, error: 'Incorrect password. Please try again.' }
      if (httpStatus === 404) return { success: false, error: 'No account found with this email.' }
      if (httpStatus === 403) return { success: false, error: err.response?.data?.error || 'Access denied.' }

      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.',
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
    dispatch({ type: 'LOGOUT' })
  }

  const updateUser = (data) => {
    const updated = { ...state.user, ...data }
    localStorage.setItem('proctornet_user', JSON.stringify(updated))
    dispatch({ type: 'UPDATE_USER', payload: data })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
