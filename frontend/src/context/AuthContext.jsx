import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, errorMessage } from '@/lib/apiClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const checkSession = async () => {
      const loggedIn = localStorage.getItem('proctornet_logged_in')
      if (!loggedIn) {
        if (mounted) setIsLoading(false)
        return
      }
      try {
        const res = await api.get('/auth/me')
        if (res.data?.user && mounted) {
          setUser(res.data.user)
          setRole(res.data.user.role)
        }
      } catch (_err) {
        localStorage.removeItem('proctornet_logged_in')
        localStorage.removeItem('proctornet_role')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    checkSession()
    return () => { mounted = false }
  }, [])

  const login = async (credentials, selectedRole) => {
    try {
      const payload = typeof credentials === 'object' ? { ...credentials } : { email: credentials }
      if (selectedRole) payload.role = selectedRole.toUpperCase()
      const res = await api.post('/auth/login', payload)
      const loggedUser = res.data?.user
      if (loggedUser) {
        setUser(loggedUser)
        setRole(loggedUser.role)
        localStorage.setItem('proctornet_logged_in', 'true')
        localStorage.setItem('proctornet_role', loggedUser.role.toLowerCase())
        return { success: true, user: loggedUser }
      }
      return { success: false, error: 'Login response did not contain user data.' }
    } catch (err) {
      return { success: false, error: errorMessage(err, 'Authentication failed.') }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (_) {}
    localStorage.removeItem('proctornet_logged_in')
    localStorage.removeItem('proctornet_role')
    setUser(null)
    setRole(null)
  }

  const updateUser = (data) => {
    setUser((prev) => (prev ? { ...prev, ...data } : data))
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.data?.user) {
        setUser(res.data.user)
        setRole(res.data.user.role)
        return res.data.user
      }
    } catch (_) {}
    return null
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        loading: isLoading,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
