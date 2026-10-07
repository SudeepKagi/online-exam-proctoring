import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { normalizeViolationType } from '@/shared/violationTypes'

import { reportViolationWithEvidence } from '@/lib/evidenceUploader'

/**
 * useExamSocket Hook (P7 Cleaned / Q3 Integrated / R2)
 * Handles Socket.io real-time control plane events (state changes, proctor warnings, chat).
 * Media streaming is handled exclusively by LiveKit SFU (ProctorPublisher) - no media over socket!
 */
export function useExamSocket({
  examId,
  attemptId,
  user,
  onTerminated,
  onSuspended,
  onResumed,
  onStateChange
}) {
  const socketRef = useRef(null)
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

  // ── Throttled Violation Emitter (Q3.4 / A-06 / R2) ──
  const emitViolation = useCallback((type, severity, metadata = {}) => {
    const canonicalType = normalizeViolationType(type)
    if (!canonicalType) {
      console.warn(`[useExamSocket] Rejected unknown client violation type: '${type}'`)
      return
    }

    const now = Date.now()
    const lastTime = lastViolationTimeRef.current[canonicalType] || 0
    if (now - lastTime < 5000) return // Throttle 5s per violation type

    lastViolationTimeRef.current[canonicalType] = now
    setViolations(v => v + 1)

    // 1. Send control event over socket without image bytes
    socketRef.current?.emit('violation', {
      examId,
      attemptId,
      eventType: canonicalType,
      clientTimestamp: new Date().toISOString(),
      metadata
    })

    // 2. Trigger HTTP violation recording, direct S3 upload, and completion (R2)
    if (attemptId) {
      const videoEl = document.querySelector('video')
      reportViolationWithEvidence({
        attemptId,
        eventType: canonicalType,
        metadata,
        videoElement: videoEl
      }).catch((err) => {
        console.warn('[useExamSocket] Background evidence upload notice:', err.message)
      })
    }
  }, [examId, attemptId])

  useEffect(() => {
    const studentId = user?.id
    if (!studentId || !examId) return

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'], // pure websocket
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    const joinAttempt = () => {
      if (attemptId) {
        socket.emit('attempt:join', { attemptId })
      }
    }

    socket.on('connect', () => {
      setSocketConnected(true)
      joinAttempt()
    })

    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('reconnect', () => {
      setSocketConnected(true)
      joinAttempt()
    })

    // Staff proctor warnings (P6 private room)
    socket.on('proctor:warning', ({ message }) => {
      toast.error(`⚠️ Notice from Invigilator: ${message}`, { duration: 8000 })
    })

    // Authoritative attempt state change
    socket.on('attempt:state', (payload) => {
      if (payload?.status === 'ACTIVE') {
        toast.success('▶️ Exam Session Resumed by proctor.')
        onResumedRef.current?.(payload)
      } else if (payload?.status === 'SUSPENDED') {
        toast.error(`⏸️ Exam Suspended: ${payload?.reason || 'Session temporarily paused by proctor'}`, { duration: 8000 })
        onSuspendedRef.current?.(payload)
      } else if (payload?.status === 'TERMINATED') {
        toast.error(`🚨 Exam Terminated: ${payload?.reason || 'Academic integrity violation'}`, { duration: 10000 })
        onTerminatedRef.current?.(payload)
      }
      onStateChangeRef.current?.(payload)
    })

    // Periodic lightweight heartbeat (Task 4 in P6)
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { examId })
      }
    }, 15000)

    return () => {
      clearInterval(heartbeatTimer)
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [examId, attemptId, user?.id])

  return {
    socket: socketRef.current,
    socketConnected,
    violations,
    emitViolation
  }
}
