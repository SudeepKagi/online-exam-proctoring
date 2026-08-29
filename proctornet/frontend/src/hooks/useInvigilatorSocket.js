import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'

/**
 * useInvigilatorSocket Hook
 * Manages socket connection for invigilators, multi-candidate WebRTC peer connections,
 * and live proctoring alerts and actions.
 */
export function useInvigilatorSocket({ examId, onAlertReceived, enabled = true }) {
  const socketRef = useRef(null)
  const pcsRef = useRef({})
  const requestedStreamsRef = useRef(new Set())
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
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('inv:join', { examId, role: 'invigilator' }, () => {
        // Automatically request streams for candidates registered prior to socket connect
        requestedStreamsRef.current.forEach((studentId) => {
          socket.emit('webrtc:request-stream', {
            studentId,
            invId: socket.id,
            examId
          })
        })
      })
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

      window.latestStudentFrames = window.latestStudentFrames || {}
      if (alertData?.cameraFrameUrl && alertData?.studentId) {
        window.latestStudentFrames[alertData.studentId] = {
          ...(window.latestStudentFrames[alertData.studentId] || {}),
          camera: alertData.cameraFrameUrl
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.cameraFrameUrl, type: 'camera' }
        }))
      }
      if (alertData?.screenshotUrl && alertData?.studentId) {
        window.latestStudentFrames[alertData.studentId] = {
          ...(window.latestStudentFrames[alertData.studentId] || {}),
          screen: alertData.screenshotUrl
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.screenshotUrl, type: 'screen' }
        }))
      }

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        toast.error(`🚨 High Risk Alert: ${alert.studentName} (${alert.type})`, { duration: 5000 })
      }
    })

    socket.on('student:flag', (alertData) => {
      window.latestStudentFrames = window.latestStudentFrames || {}
      if (alertData?.cameraFrameUrl && alertData?.studentId) {
        window.latestStudentFrames[alertData.studentId] = {
          ...(window.latestStudentFrames[alertData.studentId] || {}),
          camera: alertData.cameraFrameUrl
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.cameraFrameUrl, type: 'camera' }
        }))
      }
      if (alertData?.screenshotUrl && alertData?.studentId) {
        window.latestStudentFrames[alertData.studentId] = {
          ...(window.latestStudentFrames[alertData.studentId] || {}),
          screen: alertData.screenshotUrl
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: alertData.studentId, frame: alertData.screenshotUrl, type: 'screen' }
        }))
      }
    })

    // ── Periodic Live Stream Feeds (Camera & Screen) ──
    socket.on('student:cameraFrame', (data) => {
      if (data?.studentId && data?.frame) {
        window.latestStudentFrames = window.latestStudentFrames || {}
        window.latestStudentFrames[data.studentId] = {
          ...(window.latestStudentFrames[data.studentId] || {}),
          camera: data.frame
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: data.studentId, frame: data.frame, type: 'camera' }
        }))
      }
    })

    socket.on('student:screenFrame', (data) => {
      if (data?.studentId && data?.frame) {
        window.latestStudentFrames = window.latestStudentFrames || {}
        window.latestStudentFrames[data.studentId] = {
          ...(window.latestStudentFrames[data.studentId] || {}),
          screen: data.frame
        }
        window.dispatchEvent(new CustomEvent('student-frame-update', {
          detail: { studentId: data.studentId, frame: data.frame, type: 'screen' }
        }))
      }
    })

    // ── Student Joined: Initiate WebRTC Stream ──
    socket.on('student:joined', ({ studentId }) => {
      if (studentId) {
        requestedStreamsRef.current.add(studentId)
        socket.emit('webrtc:request-stream', {
          studentId,
          invId: socket.id,
          examId
        })
      }
    })

    // ── Real-Time Student Session State Transitions ──
    socket.on('student:stateChange', (stateData) => {
      window.dispatchEvent(new CustomEvent('student-state-update', { detail: stateData }))
    })

    // ── Student In-Exam Chat Messages ──
    socket.on('student:chat', (data) => {
      if (data?.studentId) {
        setChats(prev => ({
          ...prev,
          [data.studentId]: [
            ...(prev[data.studentId] || []),
            { sender: 'student', studentName: data.studentName, message: data.message, timestamp: data.timestamp || new Date().toISOString() }
          ]
        }))
      }
    })

    // ── WebRTC Signaling from Students ──
    socket.on('webrtc:offer', async ({ offer, studentId, streamMap }) => {
      try {
        if (pcsRef.current[studentId]) {
          try { pcsRef.current[studentId].close() } catch (e) {}
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        })
        pcsRef.current[studentId] = pc

        pc.ontrack = (event) => {
          const stream = event.streams[0] || new MediaStream([event.track])
          const track = event.track

          let streamType = 'camera'
          if (streamMap?.screenTrackId && track.id === streamMap.screenTrackId) {
            streamType = 'screen'
          } else if (streamMap?.screenStreamId && stream.id === streamMap.screenStreamId) {
            streamType = 'screen'
          } else if (streamMap?.cameraTrackId && track.id === streamMap.cameraTrackId) {
            streamType = 'camera'
          } else if (streamMap?.cameraStreamId && stream.id === streamMap.cameraStreamId) {
            streamType = 'camera'
          } else if (window.activeWebRTCStreams?.[studentId]?.camera && window.activeWebRTCStreams[studentId].camera !== stream) {
            streamType = 'screen'
          }

          window.activeWebRTCStreams = window.activeWebRTCStreams || {}
          window.activeWebRTCStreams[studentId] = {
            ...(window.activeWebRTCStreams[studentId] || {}),
            [streamType]: stream
          }
          window.dispatchEvent(new CustomEvent('student-stream-update', {
            detail: { studentId, stream, type: streamType }
          }))
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
      if (window.activeWebRTCStreams) {
        window.activeWebRTCStreams = {}
      }
    }
  }, [examId, enabled])

  const requestStudentStream = useCallback((studentId) => {
    if (!studentId) return
    requestedStreamsRef.current.add(studentId)
    if (socketRef.current?.connected) {
      socketRef.current.emit('webrtc:request-stream', {
        studentId,
        examId,
        invId: socketRef.current.id
      })
    }
  }, [examId])

  const sendWarning = useCallback((studentId, message) => {
    return new Promise((resolve) => {
      const payload = { examId, studentId, message }
      socketRef.current?.emit('inv:warn', payload, (ack) => {
        resolve(ack || { ok: true })
      })
      socketRef.current?.emit('exam:warning', payload)
    })
  }, [examId])

  const pauseStudentExam = useCallback((studentId, reason = 'Session paused by proctor') => {
    return new Promise((resolve) => {
      const payload = { examId, studentId, reason }
      socketRef.current?.emit('inv:pause', payload, (ack) => {
        resolve(ack || { ok: true })
      })
    })
  }, [examId])

  const resumeStudentExam = useCallback((studentId) => {
    return new Promise((resolve) => {
      const payload = { examId, studentId }
      socketRef.current?.emit('inv:resume', payload, (ack) => {
        resolve(ack || { ok: true })
      })
    })
  }, [examId])

  const terminateStudentExam = useCallback((studentId, reason) => {
    return new Promise((resolve) => {
      const payload = { examId, studentId, reason }
      socketRef.current?.emit('inv:terminate', payload, (ack) => {
        resolve(ack || { ok: true })
      })
      socketRef.current?.emit('exam:terminate', payload)
    })
  }, [examId])

  const sendChat = useCallback((studentId, message) => {
    if (!studentId || !message?.trim()) return
    const payload = { examId, studentId, message: message.trim() }
    socketRef.current?.emit('inv:chat', payload)
    setChats(prev => ({
      ...prev,
      [studentId]: [
        ...(prev[studentId] || []),
        { sender: 'invigilator', message: message.trim(), timestamp: new Date().toISOString() }
      ]
    }))
  }, [examId])

  return {
    socket: socketRef.current,
    connected,
    alerts,
    chats,
    requestStudentStream,
    sendWarning,
    pauseStudentExam,
    resumeStudentExam,
    terminateStudentExam,
    sendChat
  }
}
