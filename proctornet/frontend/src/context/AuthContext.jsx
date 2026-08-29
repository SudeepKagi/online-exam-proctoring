import React, { createContext, useContext, useReducer, useEffect } from 'react'
import api from '@/utils/api'

const AuthContext = createContext()

const initialState = {
  user: null,
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
        role: action.payload.role || action.payload.user?.role,
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

  // Restore authenticated session from HttpOnly cookie on mount
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        const res = await api.get('/auth/me')
        if (res.data?.user && isMounted) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: res.data.user, role: res.data.user.role },
          })
        } else if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } catch (_err) {
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      }
    }

    restoreSession()
    return () => {
      isMounted = false
    }
  }, [])

  /**
   * login(credentials, role)
   * Calls the correct auth endpoint based on role.
   * Server establishes the secure HttpOnly cookie.
   */
  const login = async (arg1, arg2, arg3) => {
    let credentials = {}
    let role = 'student'

    if (typeof arg1 === 'object' && arg1 !== null) {
      credentials = arg1
      role = arg2
    } else {
      role = arg3 || 'student'
      if (role === 'student') {
        credentials = { usn: arg1, password: arg2 }
      } else {
        credentials = { email: arg1, password: arg2 }
      }
    }

    const endpoints = {
      admin:   '/auth/admin/login',
      faculty: '/auth/faculty/login',
      student: '/auth/student/login',
    }

    try {
      const res = await api.post(endpoints[role], credentials)
      const { user } = res.data

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, role } })
      return { success: true }
    } catch (err) {
      const status     = err.response?.data?.status
      const httpStatus = err.response?.status

      if (!err.response) {
        return { success: false, error: 'Unable to connect to server. Please verify the backend server is running on port 5000.' }
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

      if (httpStatus === 401) {
        return {
          success: false,
          error: role === 'student' ? 'Invalid USN or password. Please check your credentials.' : 'Incorrect email or password. Please try again.'
        }
      }
      if (httpStatus === 404) {
        return {
          success: false,
          error: role === 'student' ? 'No student account found with this USN.' : 'No account found with this email.'
        }
      }
      if (httpStatus === 403) return { success: false, error: err.response?.data?.error || 'Access denied.' }

      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.',
      }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (_err) {
      // Non-critical, proceed with client teardown
    }
    dispatch({ type: 'LOGOUT' })
  }

  const updateUser = (data) => {
    dispatch({ type: 'UPDATE_USER', payload: data })
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.data?.user) {
        updateUser(res.data.user)
        return res.data.user
      }
    } catch (err) {
      console.error('[refreshUser]', err)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword })
    updateUser({ mustChangePassword: false })
    return res.data
  }

  const loginInvigilator = async (examId, invId, invPassword) => {
    try {
      const res = await api.post('/auth/invigilator/login', { examId, invId, invPassword })
      const { session, user } = res.data
      const invUser = user || { id: session.invId, name: `Invigilator ${session.invId}`, examId: session.examId, role: 'invigilator' }

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: invUser, role: 'invigilator' } })
      return { success: true, session }
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Unable to connect to server. Please verify the backend server is running on port 5000.' }
      }
      return { success: false, error: err.response?.data?.error || err.response?.data?.message || 'Invigilator authentication failed. Check your credentials.' }
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, login, loginInvigilator, logout, updateUser, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

