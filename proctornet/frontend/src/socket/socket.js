import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

// Singleton socket instance — connects only when first imported
let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function connectSocket(token) {
  const s = getSocket()
  s.auth = { token }
  s.connect()
  return s
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export default getSocket
