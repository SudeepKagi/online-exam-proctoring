import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'

/**
 * useInvigilatorSocket Hook (P7 Cleaned)
 * Handles invigilator control plane events: coalesced roster deltas, new violations, and chat.
 * WebRTC video feeds are handled exclusively by LiveKit SFU (ProctorViewer) with selective subscription.
 */
export function useInvigilatorSocket({ examId, onAlertReceived, onRosterDelta, enabled = true }) {
  const socketRef = useRef(null)
  const onAlertRef = useRef(onAlertReceived)
  onAlertRef.current = onAlertReceived

  const onRosterDeltaRef = useRef(onRosterDelta)
  onRosterDeltaRef.current = onRosterDelta

  const [connected, setConnected] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [chats, setChats] = useState({})

  useEffect(() => {
    if (!enabled || !examId) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
      return
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'], // pure websocket
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('inv:join', { examId })
    })

    socket.on('disconnect', () => setConnected(false))

    // ── 500ms Coalesced Roster Delta (P6) ──
    socket.on('roster:delta', (deltas) => {
      onRosterDeltaRef.current?.(deltas)
    })

    // ── Live Violation Event ──
    socket.on('violation:new', (alertData) => {
      const alert = {
        id: alertData.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        ...alertData,
        timestamp: alertData.timestamp || new Date().toISOString()
      }
      setAlerts(prev => [alert, ...prev.slice(0, 99)])
      onAlertRef.current?.(alert)

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        toast.error(`🚨 Security Alert: Candidate ${alert.attemptId} (${alert.eventType || alert.type})`, { duration: 5000 })
      }
    })

    // ── Student Chat Messages ──
    socket.on('chat:new', (data) => {
      if (data?.studentId) {
        setChats(prev => ({
          ...prev,
          [data.studentId]: [
            ...(prev[data.studentId] || []),
            {
              sender: data.senderRole?.toLowerCase() || 'student',
              senderName: data.senderName,
              message: data.message,
              timestamp: data.timestamp || new Date().toISOString()
            }
          ]
        }))
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [examId, enabled])

  return {
    socket: socketRef.current,
    connected,
    alerts,
    chats
  }
}
