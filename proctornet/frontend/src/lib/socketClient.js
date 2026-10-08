/**
 * socketClient.js
 * Production-hardened Socket.io client singleton (Phase S2 / Appendix C).
 * - Transport: pure WebSocket only (no polling)
 * - Cookie-based handshake authentication (withCredentials: true)
 * - Reconnect -> REST resync notification channel
 */

import { io } from 'socket.io-client'

let socketInstance = null
const resyncHandlers = new Set()

export function initSocketClient(options = {}) {
  if (socketInstance) return socketInstance

  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin

  socketInstance = io(socketUrl, {
    transports: ['websocket'], // WebSocket only (Task 1 / 8)
    autoConnect: true,
    withCredentials: true, // Attaches pn_at and pn_rt cookies automatically
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
