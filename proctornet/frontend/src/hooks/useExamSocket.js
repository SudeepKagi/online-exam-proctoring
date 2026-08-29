import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

/**
 * useExamSocket Hook
 * Manages authoritative real-time Socket.io lifecycle, room subscriptions, WebRTC streaming to invigilator,
 * and throttled violation reporting.
 */
export function useExamSocket({
  examId,
  user,
  streamRef,
  onTerminated,
  onSuspended,
  onResumed,
  onStateChange
}) {
  const socketRef = useRef(null)
  const pcsRef = useRef({})
  const lastViolationTimeRef = useRef({})
  const [socketConnected, setSocketConnected] = useState(false)
  const [violations, setViolations] = useState(0)

  const onTerminatedRef = useRef(onTerminated)
  onTerminatedRef.current = onTerminated

  const onSuspendedRef = useRef(onSuspended)
  onSuspendedRef.current = onSuspended

  const onResumedRef = useRef(onResumed)
  onResumedRef.current = onResumed

  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  const userRef = useRef(user)
  userRef.current = user

  const streamRefRef = useRef(streamRef)
  streamRefRef.current = streamRef

  const camVideoRef = useRef(null)
  const camCanvasRef = useRef(null)
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)

  useEffect(() => {
    const hiddenContainer = document.createElement('div')
    hiddenContainer.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;'
    document.body.appendChild(hiddenContainer)

    const camVideo = document.createElement('video')
    camVideo.autoplay = true
    camVideo.muted = true
    camVideo.playsInline = true
    camVideo.style.cssText = 'width:320px;height:240px;'
    hiddenContainer.appendChild(camVideo)
    camVideoRef.current = camVideo

    const camCanvas = document.createElement('canvas')
    camCanvas.width = 480
    camCanvas.height = 360
    camCanvasRef.current = camCanvas

    const screenVideo = document.createElement('video')
    screenVideo.autoplay = true
    screenVideo.muted = true
    screenVideo.playsInline = true
    screenVideo.style.cssText = 'width:320px;height:240px;'
    hiddenContainer.appendChild(screenVideo)
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
      if (document.body.contains(hiddenContainer)) {
        document.body.removeChild(hiddenContainer)
      }
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
        video.onloadedmetadata = () => {
          video.play().catch(() => {})
        }
        video.play().catch(() => {})
      }
      if (video.readyState >= 2 || video.videoWidth > 0) {
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.5)
      }
    } catch {
      return null
    }
    return null
  }, [])

  const captureFrameRef = useRef(captureFrame)
  captureFrameRef.current = captureFrame

  // ── Throttled Violation Emitter ──
  const emitViolation = useCallback((type, severity, metadata = {}) => {
    const now = Date.now()
    const lastTime = lastViolationTimeRef.current[type] || 0
    if (now - lastTime < 5000) return // Throttle 5s per violation type

    lastViolationTimeRef.current[type] = now
    setViolations(v => v + 1)

    const currentUser = userRef.current
    const currentStream = streamRefRef.current?.current
    const cameraFrameUrl = metadata.cameraFrameUrl || captureFrameRef.current(currentStream, 'camera') || null
    const screenshotUrl = metadata.screenshotUrl || (window.screenShareStream ? captureFrameRef.current(window.screenShareStream, 'screen') : null)

    socketRef.current?.emit('exam:flag', {
      examId,
      studentId: currentUser?.id,
      studentName: currentUser?.name,
      usn: currentUser?.usn,
      type,
      eventType: type,
      severity: severity || 'MEDIUM',
      details: metadata.details || type,
      cameraFrameUrl,
      screenshotUrl,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }, [examId])

  useEffect(() => {
    const studentId = user?.id
    if (!studentId || !examId) return

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
      const u = userRef.current
      socket.emit('exam:join', {
        examId,
        studentId: u?.id,
        name: u?.name,
        usn: u?.usn
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

    socket.on('exam:suspended', (payload) => {
      toast.error(`⏸️ Exam Suspended: ${payload?.reason || 'Session temporarily paused by proctor'}`, { duration: 8000 })
      onSuspendedRef.current?.(payload)
    })

    socket.on('exam:state', (payload) => {
      if (payload?.currentStatus === 'ACTIVE') {
        if (payload?.previousStatus === 'SUSPENDED' || payload?.previousStatus === 'TERMINATED') {
          toast.success('▶️ Exam Session Resumed by proctor.')
        }
        onResumedRef.current?.()
      }
      onStateChangeRef.current?.(payload)
    })

    socket.on('exam:terminated', (payload) => {
      // Aggressive hardware and media teardown
      if (streamRefRef.current?.current) {
        try { streamRefRef.current.current.getTracks().forEach(t => t.stop()) } catch (_e) {}
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
      onTerminatedRef.current?.(payload)
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

      const camStream = streamRefRef.current?.current
      if (camStream) {
        camStream.getTracks().forEach(track => {
          try { pc.addTrack(track, camStream) } catch (_e) {}
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
          studentId: userRef.current?.id,
          streamMap: {
            cameraStreamId: camStream?.id,
            cameraTrackId: camStream?.getVideoTracks()[0]?.id,
            screenStreamId: window.screenShareStream?.id,
            screenTrackId: window.screenShareStream?.getVideoTracks()[0]?.id
          }
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

      const activeCamStream = streamRefRef.current?.current
      if (activeCamStream) {
        const frame = captureFrameRef.current(activeCamStream, 'camera')
        if (frame) {
          socketRef.current.emit('exam:frame', {
            examId,
            studentId: userRef.current?.id,
            frame
          })
        }
      }

      if (window.screenShareStream) {
        const screenFrame = captureFrameRef.current(window.screenShareStream, 'screen')
        if (screenFrame) {
          socketRef.current.emit('exam:screenFrame', {
            examId,
            studentId: userRef.current?.id,
            frame: screenFrame
          })
        }
      }
    }, 1500)

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
  }, [examId, user?.id])

  return {
    socket: socketRef.current,
    socketConnected,
    violations,
    emitViolation
  }
}
