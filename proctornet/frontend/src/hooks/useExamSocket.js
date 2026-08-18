import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

/**
 * useExamSocket Hook
 * Manages real-time Socket.io lifecycle, room subscriptions, WebRTC streaming to invigilator,
 * and throttled violation reporting.
 */
export function useExamSocket({ examId, user, streamRef, onTerminated }) {
  const socketRef = useRef(null)
  const pcsRef = useRef({})
  const lastViolationTimeRef = useRef({})
  const [socketConnected, setSocketConnected] = useState(false)
  const [violations, setViolations] = useState(0)

  // ── Throttled Violation Emitter ──
  const emitViolation = useCallback((type, severity, metadata = {}) => {
    const now = Date.now()
    const lastTime = lastViolationTimeRef.current[type] || 0
    if (now - lastTime < 10000) return // Throttle 10s per violation type

    lastViolationTimeRef.current[type] = now
    setViolations(v => v + 1)

    socketRef.current?.emit('exam:flag', {
      examId,
      studentId: user?.id,
      studentName: user?.name,
      usn: user?.usn,
      type,
      severity: severity || 'MEDIUM',
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }, [examId, user])

  useEffect(() => {
    if (!user || !examId) return

    const token = localStorage.getItem('proctornet_token')
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    const joinRoom = () => {
      socket.emit('exam:join', {
        examId,
        studentId: user?.id,
        name: user?.name,
        usn: user?.usn
      })
    }

    socket.on('connect', () => {
      setSocketConnected(true)
      joinRoom()
    })

    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('reconnect', () => {
      setSocketConnected(true)
      joinRoom()
    })

    socket.on('exam:warning', ({ message }) => {
      toast.error(`⚠️ ${message}`, { duration: 6000 })
    })

    socket.on('exam:terminated', () => {
      toast.error('Exam terminated by invigilator')
      onTerminated?.()
    })

    // ── WebRTC Live Streaming to Invigilators ──
    socket.on('webrtc:request-stream', async ({ invId }) => {
      if (pcsRef.current[invId]) {
        try { pcsRef.current[invId].close() } catch (e) {}
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      pcsRef.current[invId] = pc

      if (streamRef?.current) {
        streamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, streamRef.current)
        })
      }
      if (window.screenShareStream) {
        window.screenShareStream.getTracks().forEach(track => {
          pc.addTrack(track, window.screenShareStream)
        })
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            targetId: invId
          })
        }
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc:offer', {
          offer,
          invId,
          studentId: user?.id
        })
      } catch (err) {
        console.error('Failed to create WebRTC offer:', err)
      }
    })

    socket.on('webrtc:answer', async ({ answer, invId }) => {
      const pc = pcsRef.current[invId]
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        } catch (err) {
          console.error('Failed to set remote WebRTC description:', err)
        }
      }
    })

    socket.on('webrtc:ice-candidate', async ({ candidate, senderId }) => {
      const pc = pcsRef.current[senderId]
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Failed to add remote WebRTC ICE candidate:', err)
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
      Object.values(pcsRef.current).forEach(pc => {
        try { pc.close() } catch (e) {}
      })
      pcsRef.current = {}
    }
  }, [examId, user, streamRef, onTerminated])

  return {
    socket: socketRef.current,
    socketConnected,
    violations,
    emitViolation
  }
}
