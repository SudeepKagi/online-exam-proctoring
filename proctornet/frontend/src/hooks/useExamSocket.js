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

  const camVideoRef = useRef(null)
  const camCanvasRef = useRef(null)
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)

  useEffect(() => {
    const camVideo = document.createElement('video')
    camVideo.autoplay = true
    camVideo.muted = true
    camVideo.playsInline = true
    camVideoRef.current = camVideo

    const camCanvas = document.createElement('canvas')
    camCanvas.width = 480
    camCanvas.height = 360
    camCanvasRef.current = camCanvas

    const screenVideo = document.createElement('video')
    screenVideo.autoplay = true
    screenVideo.muted = true
    screenVideo.playsInline = true
    screenVideoRef.current = screenVideo

    const screenCanvas = document.createElement('canvas')
    screenCanvas.width = 640
    screenCanvas.height = 360
    screenCanvasRef.current = screenCanvas

    return () => {
      camVideo.srcObject = null
      screenVideo.srcObject = null
      camVideoRef.current = null
      camCanvasRef.current = null
      screenVideoRef.current = null
      screenCanvasRef.current = null
    }
  }, [])

  const captureFrame = useCallback((stream, type = 'camera') => {
    if (!stream || !stream.active) return null
    const video = type === 'screen' ? screenVideoRef.current : camVideoRef.current
    const canvas = type === 'screen' ? screenCanvasRef.current : camCanvasRef.current
    if (!video || !canvas) return null

    try {
      if (video.srcObject !== stream) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
      if (video.readyState >= 2) {
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.5)
      }
    } catch {
      return null
    }
    return null
  }, [])

  // ── Throttled Violation Emitter ──
  const emitViolation = useCallback((type, severity, metadata = {}) => {
    const now = Date.now()
    const lastTime = lastViolationTimeRef.current[type] || 0
    if (now - lastTime < 8000) return // Throttle 8s per violation type

    lastViolationTimeRef.current[type] = now
    setViolations(v => v + 1)

    const cameraFrameUrl = metadata.cameraFrameUrl || captureFrame(streamRef?.current, 'camera') || null
    const screenshotUrl = metadata.screenshotUrl || (window.screenShareStream ? captureFrame(window.screenShareStream, 'screen') : null)

    socketRef.current?.emit('exam:flag', {
      examId,
      studentId: user?.id,
      studentName: user?.name,
      usn: user?.usn,
      type,
      eventType: type,
      severity: severity || 'MEDIUM',
      details: metadata.details || type,
      cameraFrameUrl,
      screenshotUrl,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }, [examId, user, streamRef, captureFrame])

  useEffect(() => {
    if (!user || !examId) return

    const token = localStorage.getItem('proctornet_token')
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
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
      toast.error(`⚠️ Notice from Invigilator: ${message}`, { duration: 8000 })
    })

    socket.on('exam:terminated', (payload) => {
      // Aggressive hardware and media teardown
      if (streamRef?.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()) } catch (_e) {}
      }
      if (window.screenShareStream) {
        try { window.screenShareStream.getTracks().forEach(t => t.stop()) } catch (_e) {}
        window.screenShareStream = null
      }
      Object.values(pcsRef.current).forEach(pc => {
        try { pc.close() } catch (e) {}
      })
      pcsRef.current = {}

      toast.error(`🚨 Exam Terminated: ${payload?.reason || 'Academic integrity violation'}`, { duration: 10000 })
      onTerminated?.(payload)
    })

    // ── WebRTC Live Streaming to Invigilators ──
    socket.on('webrtc:request-stream', async ({ invId }) => {
      if (pcsRef.current[invId]) {
        try { pcsRef.current[invId].close() } catch (e) {}
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      pcsRef.current[invId] = pc

      if (streamRef?.current) {
        streamRef.current.getTracks().forEach(track => {
          try { pc.addTrack(track, streamRef.current) } catch (_e) {}
        })
      }
      if (window.screenShareStream) {
        window.screenShareStream.getTracks().forEach(track => {
          try { pc.addTrack(track, window.screenShareStream) } catch (_e) {}
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
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        })
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

    // Periodic fallback frame streaming to invigilator
    // Adaptive Governor: If WebRTC is actively streaming, throttle frame relay to a 15s keepalive heartbeat.
    // If WebRTC is negotiating, disconnected, or failed, stream at 2.5s fallback rate.
    let tickCount = 0
    const frameInterval = setInterval(() => {
      if (!socketRef.current?.connected) return
      tickCount++

      const hasActiveWebRtc = Object.values(pcsRef.current).some(
        pc => pc.connectionState === 'connected' || pc.iceConnectionState === 'connected'
      )

      // When WebRTC is active, skip 5 out of 6 ticks (throttle from 2.5s -> 15s)
      if (hasActiveWebRtc && (tickCount % 6 !== 0)) {
        return
      }

      if (streamRef?.current) {
        const frame = captureFrame(streamRef.current, 'camera')
        if (frame) {
          socketRef.current.emit('exam:frame', {
            examId,
            studentId: user?.id,
            frame
          })
        }
      }

      if (window.screenShareStream) {
        const screenFrame = captureFrame(window.screenShareStream, 'screen')
        if (screenFrame) {
          socketRef.current.emit('exam:screenFrame', {
            examId,
            studentId: user?.id,
            frame: screenFrame
          })
        }
      }
    }, 2500)

    return () => {
      clearInterval(frameInterval)
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
      Object.values(pcsRef.current).forEach(pc => {
        try { pc.close() } catch (e) {}
      })
      pcsRef.current = {}
    }
  }, [examId, user, streamRef, onTerminated, captureFrame])

  return {
    socket: socketRef.current,
    socketConnected,
    violations,
    emitViolation
  }
}
