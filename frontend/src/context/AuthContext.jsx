import React, { createContext, useContext, useReducer, useEffect } from 'react'
import api, { authChannel } from '@/utils/api'

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

  // Restore authenticated session on mount (only if session indicator exists)
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      const hasLoginFlag = typeof window !== 'undefined' ? localStorage.getItem('proctornet_logged_in') : null

      // Guest / unauthenticated visitor: resolve loading immediately without firing noisy /auth/me
      if (!hasLoginFlag) {
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
        return
      }

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
        if (typeof window !== 'undefined') {
          localStorage.removeItem('proctornet_logged_in')
          localStorage.removeItem('proctornet_role')
        }
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      }
    }

    restoreSession()

    // Multi-tab sync via BroadcastChannel('pn-auth') (SES-05)
    if (authChannel) {
      const handleAuthMessage = (event) => {
        const { type, payload } = event.data || {}
        if (type === 'LOGIN' && payload?.user) {
          dispatch({ type: 'LOGIN_SUCCESS', payload })
        } else if (type === 'LOGOUT') {
          dispatch({ type: 'LOGOUT' })
        } else if (type === 'REFRESH') {
          api.get('/auth/me').then(res => {
            if (res.data?.user) dispatch({ type: 'UPDATE_USER', payload: res.data.user })
          }).catch(() => {})
        }
      }
      authChannel.addEventListener('message', handleAuthMessage)
      return () => {
        isMounted = false
        authChannel.removeEventListener('message', handleAuthMessage)
      }
    }

    return () => {
      isMounted = false
    }
  }, [])

  /**
   * login(credentials, role)
   * Calls the correct auth endpoint based on role.
   * Uses HttpOnly cookies for session state (Zero-localStorage policy).
   */
  const login = async (arg1, arg2, arg3) => {
    let credentials
    let role

    if (typeof arg1 === 'object' && arg1 !== null) {
      credentials = arg1
      role = arg2 || 'student'
    } else {
      role = arg3 || 'student'
      if (role === 'student') {
        credentials = { usn: arg1, password: arg2 }
      } else {
        credentials = { email: arg1, password: arg2 }
      }
    }

    // Role switching protection in single browser origin (SES-05)
    if (state.isAuthenticated && state.user && state.role && state.role.toLowerCase() !== role.toLowerCase()) {
      return {
        success: false,
        error: `A session for ${state.role.toUpperCase()} is currently active. Please sign out before logging in as a ${role.toUpperCase()}.`
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

      if (typeof window !== 'undefined') {
        localStorage.setItem('proctornet_logged_in', 'true')
        localStorage.setItem('proctornet_role', role)
      }

      authChannel?.postMessage({
        type: 'LOGIN',
        payload: { user, role }
      })

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, role } })
      return { success: true, user }
    } catch (err) {
      const rawError = err.response?.data?.error
      const errorMessage = typeof rawError === 'object' ? rawError?.message : rawError
      const status     = err.response?.data?.status || (typeof rawError === 'object' ? rawError?.code : null)
      const httpStatus = err.response?.status

      if (!err.response) {
        return { success: false, error: 'Unable to connect to the authentication server. Please check your internet connection or server status.' }
      }

      if (status === 'PENDING_APPROVAL' || status === 'PENDING_ADMIN' || status === 'PENDING_FACULTY') {
        return { success: false, error: "Your account is awaiting admin approval. You'll be notified by email." }
      }
      if (status === 'SUSPENDED') {
        return { success: false, error: 'Your account has been suspended. Please contact the administrator.' }
      }
      if (status === 'REJECTED') {
        const reason = err.response?.data?.reason || errorMessage
        return { success: false, error: `Registration rejected${reason ? ': ' + reason : '. Contact admin.'}` }
      }

      if (httpStatus === 401) {
        return {
          success: false,
          error: errorMessage || (role === 'student' ? 'Invalid USN or password. Please check your credentials.' : 'Incorrect email or password. Please try again.')
        }
      }
      if (httpStatus === 404) {
        return {
          success: false,
          error: errorMessage || (role === 'student' ? 'No student account found with this USN.' : 'No account found with this email.')
        }
      }
      if (httpStatus === 403) return { success: false, error: errorMessage || 'Access denied.' }
      if (httpStatus === 429) return { success: false, error: errorMessage || 'Too many login attempts. Please wait a moment and try again.' }

      return {
        success: false,
        error: errorMessage || err.response?.data?.message || err.message || 'Login failed. Please check your credentials and try again.',
      }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (_err) {
      // Non-critical, proceed with client teardown
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('proctornet_logged_in')
      localStorage.removeItem('proctornet_role')
    }
    authChannel?.postMessage({ type: 'LOGOUT' })
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
    // Role switching protection
    if (state.isAuthenticated && state.user && state.role && state.role.toLowerCase() !== 'invigilator') {
      return {
        success: false,
        error: `A session for ${state.role.toUpperCase()} is currently active. Please sign out before logging in as an invigilator.`
      }
    }

    try {
      const res = await api.post('/auth/invigilator/login', { examId, invId, invPassword })
      const { session, user } = res.data

      if (typeof window !== 'undefined') {
        localStorage.setItem('proctornet_logged_in', 'true')
        localStorage.setItem('proctornet_role', 'invigilator')
      }

      const invUser = user || { id: session.invId, name: `Invigilator ${session.invId}`, examId: session.examId, role: 'invigilator' }

      authChannel?.postMessage({
        type: 'LOGIN',
        payload: { user: invUser, role: 'invigilator' }
      })

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: invUser, role: 'invigilator' } })
      return { success: true, session }
    } catch (err) {
      const rawError = err.response?.data?.error
      const errorMessage = typeof rawError === 'object' ? rawError?.message : rawError
      if (!err.response) {
        return { success: false, error: 'Unable to connect to server. Please check your network connection.' }
      }
      return { success: false, error: errorMessage || err.response?.data?.message || 'Invigilator authentication failed. Check your credentials.' }
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, loading: state.isLoading, login, loginInvigilator, logout, updateUser, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
