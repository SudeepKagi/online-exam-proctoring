import { io } from 'socket.io-client'
import api from '../utils/api'

let socket = null

export const connectSocket = () => {
  if (socket?.connected) return socket

  socket = io(
    import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
    {
      withCredentials: true, // Attaches pn_at and pn_rt cookies automatically
      transports: ['websocket'], // Pure websocket per Task 1 / C-06
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    }
  )

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id)
  })

  // Handle upcoming token expiration emitted by backend (Phase S2 / SES-09)
  socket.on('auth:expiring', async () => {
    console.warn('⚠️ Server notified auth expiring in 60s, executing silent refresh...')
    try {
      await api.post('/auth/refresh')
      console.log('✅ Token silently refreshed before socket expiry')
    } catch (err) {
      console.error('❌ Failed to refresh session before expiry:', err)
    }
  })

  // Handle session revocation
  socket.on('session:revoked', (data) => {
    console.warn('⚠️ Session revoked by server:', data?.reason)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pn:session-revoked', { detail: data }))
    }
  })

  // Handle student session replaced on another device
  socket.on('session:replaced', (data) => {
    console.warn('⚠️ Session superseded by another device:', data?.reason)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pn:session-replaced', { detail: data }))
      alert('Your examination session was opened on another browser or device. This session has been paused.')
    }
  })

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
