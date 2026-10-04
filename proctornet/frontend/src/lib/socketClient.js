/**
 * socketClient.js
 * Production-hardened Socket.io client singleton.
 * - Transport: pure WebSocket only (no polling)
 * - Automatic auth token injection
 * - Reconnect -> REST resync notification channel
 */

import { io } from 'socket.io-client'

let socketInstance = null
const resyncHandlers = new Set()

export function getAuthToken() {
  // Check cookie or localStorage/sessionStorage
  try {
    const directToken = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (directToken) return directToken

    const cookies = document.cookie.split(';')
    for (const c of cookies) {
      const [k, v] = c.trim().split('=')
      if (['student_token', 'faculty_token', 'admin_token', 'inv_token', 'token'].includes(k)) {
        return decodeURIComponent(v)
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

export function initSocketClient(options = {}) {
  if (socketInstance) return socketInstance

  const token = options.token || getAuthToken()
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin

  socketInstance = io(socketUrl, {
    transports: ['websocket'], // WebSocket only (Task 1 / 8)
    autoConnect: true,
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000,
    ...options
  })

  socketInstance.on('connect', () => {
    console.log('[Socket] Connected to realtime plane:', socketInstance.id)
  })

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message)
  })

  // Trigger REST resync on reconnect (Task 5 / 8)
  socketInstance.io.on('reconnect', (attempt) => {
    console.log(`[Socket] Reconnected after ${attempt} attempts; triggering authoritative REST resync`)
    for (const handler of resyncHandlers) {
      try {
        handler()
      } catch (err) {
        console.error('[Socket] Error in resync handler:', err)
      }
    }
  })

  return socketInstance
}

export function getSocket() {
  if (!socketInstance) {
    return initSocketClient()
  }
  return socketInstance
}

export function registerResyncHandler(fn) {
  resyncHandlers.add(fn)
  return () => resyncHandlers.delete(fn)
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
