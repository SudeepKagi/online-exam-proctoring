import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'

/**
 * useInvigilatorSocket Hook
 * Manages socket connection for invigilators, multi-candidate WebRTC peer connections,
 * and live proctoring alerts.
 */
export function useInvigilatorSocket({ examId, onAlertReceived }) {
  const socketRef = useRef(null)
  const pcsRef = useRef({})
  const [connected, setConnected] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [chats, setChats] = useState({})

  useEffect(() => {
    const token = localStorage.getItem('proctornet_inv_token') || localStorage.getItem('proctornet_token')
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('exam:join', { examId, role: 'invigilator' })
    })

    socket.on('disconnect', () => setConnected(false))

    // ── Live Flag / Violation Event ──
    socket.on('exam:flag', (alertData) => {
      const alert = {
        id: alertData.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...alertData,
        timestamp: alertData.timestamp || new Date().toISOString()
      }
      setAlerts(prev => [alert, ...prev.slice(0, 99)])
      onAlertReceived?.(alert)

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        toast.error(`🚨 High Risk Alert: ${alert.studentName} (${alert.type})`, { duration: 5000 })
      }
    })

    // ── WebRTC Signaling from Students ──
    socket.on('webrtc:offer', async ({ offer, studentId }) => {
      try {
        if (pcsRef.current[studentId]) {
          try { pcsRef.current[studentId].close() } catch (e) {}
        }

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        })
        pcsRef.current[studentId] = pc

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            window.activeWebRTCStreams = window.activeWebRTCStreams || {}
            window.activeWebRTCStreams[studentId] = {
              camera: event.streams[0]
            }
            window.dispatchEvent(new CustomEvent('student-stream-update', {
              detail: { studentId, stream: event.streams[0], type: 'camera' }
            }))
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:ice-candidate', {
              candidate: event.candidate,
              targetId: studentId
            })
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        socket.emit('webrtc:answer', {
          answer,
          studentId,
          invId: socket.id
        })
      } catch (err) {
        console.error('Invigilator WebRTC offer processing error:', err)
      }
    })

    socket.on('webrtc:ice-candidate', async ({ candidate, senderId }) => {
      const pc = pcsRef.current[senderId]
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Invigilator ICE candidate error:', err)
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      Object.values(pcsRef.current).forEach(pc => {
        try { pc.close() } catch (e) {}
      })
      pcsRef.current = {}
    }
  }, [examId, onAlertReceived])

  const requestStudentStream = useCallback((studentId) => {
    socketRef.current?.emit('webrtc:request-stream', {
      studentId,
      invId: socketRef.current?.id
    })
  }, [])

  const sendWarning = useCallback((studentId, message) => {
    socketRef.current?.emit('exam:warning', {
      examId,
      studentId,
      message
    })
    toast.success('Warning dispatched to student')
  }, [examId])

  const terminateStudentExam = useCallback((studentId, reason) => {
    socketRef.current?.emit('exam:terminate', {
      examId,
      studentId,
      reason
    })
    toast.error('Termination order dispatched to student')
  }, [examId])

  return {
    socket: socketRef.current,
    connected,
    alerts,
    chats,
    requestStudentStream,
    sendWarning,
    terminateStudentExam
  }
}
