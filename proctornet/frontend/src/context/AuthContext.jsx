import { createContext, useContext, useState, useEffect } from 'react'
import api from '@/services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('proctornet_auth')
    if (stored) {
      try {
        const { user: u, token: t } = JSON.parse(stored)
        setUser(u)
        setToken(t)
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`
      } catch {
        localStorage.removeItem('proctornet_auth')
      }
    }
    setLoading(false)
  }, [])

  const login = (userData, jwtToken) => {
    setUser(userData)
    setToken(jwtToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`
    localStorage.setItem('proctornet_auth', JSON.stringify({
      user: userData,
      token: jwtToken,
    }))
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    delete api.defaults.headers.common['Authorization']
    localStorage.removeItem('proctornet_auth')
  }

  const isAuthenticated = !!user && !!token

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
