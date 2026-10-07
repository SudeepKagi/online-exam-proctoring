import { io } from 'socket.io-client'

let socket = null

export const connectSocket = () => {
  if (socket?.connected) return socket
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('proctornet_token') : null

  socket = io(
    import.meta.env.VITE_SOCKET_URL 
    || (typeof window !== 'undefined' ? window.location.origin : ''),
    {
      withCredentials: true,
      auth: { token },
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000
    }
  )
  
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id)
  })
  
  socket.on('connect_error', (err) => {
    console.error('❌ Socket error:', err.message)
  })
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })
  
  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if(socket) {
    socket.disconnect()
    socket = null
  }
}
