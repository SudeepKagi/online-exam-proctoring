import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'

/**
 * useInvigilatorSocket Hook
 * Manages socket connection for invigilators, multi-candidate WebRTC peer connections,
 * and live proctoring alerts.
 */
export function useInvigilatorSocket({ examId, onAlertReceived, enabled = true }) {
  const socketRef = useRef(null)
  const pcsRef = useRef({})
  const onAlertRef = useRef(onAlertReceived)
  onAlertRef.current = onAlertReceived

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

    const token = localStorage.getItem('inv_token') || localStorage.getItem('proctornet_inv_token') || localStorage.getItem('proctornet_token')
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('inv:join', { examId, role: 'invigilator' })
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
      onAlertRef.current?.(alert)

      if (alertData.cameraFrameUrl) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.cameraFrameUrl, type: 'camera' }
        }))
      }
      if (alertData.screenshotUrl) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.screenshotUrl, type: 'screen' }
        }))
      }

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        toast.error(`🚨 High Risk Alert: ${alert.studentName} (${alert.type})`, { duration: 5000 })
      }
    })

    socket.on('student:flag', (alertData) => {
      if (alertData?.cameraFrameUrl) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.cameraFrameUrl, type: 'camera' }
        }))
      }
      if (alertData?.screenshotUrl) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.screenshotUrl, type: 'screen' }
        }))
      }
    })

    // ── Periodic Live Stream Feeds (Camera & Screen) ──
    socket.on('student:cameraFrame', (data) => {
      if (data?.studentId && data?.frame) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: data.studentId, frame: data.frame, type: 'camera' }
        }))
      }
    })

    socket.on('student:screenFrame', (data) => {
      if (data?.studentId && data?.frame) {
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: data.studentId, frame: data.frame, type: 'screen' }
        }))
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
            const track = event.track
            const isScreen = track.label?.toLowerCase().includes('screen') || track.label?.toLowerCase().includes('display') || (window.activeWebRTCStreams?.[studentId]?.camera && window.activeWebRTCStreams[studentId].camera !== event.streams[0])
            const streamType = isScreen ? 'screen' : 'camera'

            window.activeWebRTCStreams = window.activeWebRTCStreams || {}
            window.activeWebRTCStreams[studentId] = {
              ...(window.activeWebRTCStreams[studentId] || {}),
              [streamType]: event.streams[0]
            }
            window.dispatchEvent(new CustomEvent('student-stream-update', {
              detail: { studentId, stream: event.streams[0], type: streamType }
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
  }, [examId, enabled])

  const requestStudentStream = useCallback((studentId) => {
    socketRef.current?.emit('webrtc:request-stream', {
      studentId,
      invId: socketRef.current?.id
    })
  }, [])

  const sendWarning = useCallback((studentId, message) => {
    const payload = { examId, studentId, message }
    socketRef.current?.emit('exam:warning', payload)
    socketRef.current?.emit('inv:warn', payload)
    toast.success('Warning dispatched to student')
  }, [examId])

  const terminateStudentExam = useCallback((studentId, reason) => {
    const payload = { examId, studentId, reason }
    socketRef.current?.emit('exam:terminate', payload)
    socketRef.current?.emit('inv:terminate', payload)
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
