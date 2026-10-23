import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/apiClient'
import { ProctoringInterruptedOverlay } from '@/components/exam/ProctoringInterruptedOverlay'

const SCREEN_CONSTRAINTS = {
  video: {
    displaySurface: 'monitor',
    width: { max: 1280 },
    height: { max: 720 },
    frameRate: { max: 5 }
  },
  audio: false
}

export function useScreenProctoring({ stream, attemptId, examId, onViolation } = {}) {
  const [screenLost, setScreenLost] = useState(false)
  const streamRef = useRef(null)
  const hiddenVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const attemptIdRef = useRef(attemptId)
  const examIdRef = useRef(examId)
  const onViolationRef = useRef(onViolation)

  attemptIdRef.current = attemptId
  examIdRef.current = examId
  onViolationRef.current = onViolation

  const activeStream = stream || (typeof window !== 'undefined' ? window.__proctorScreenStream : null)
  streamRef.current = activeStream

  useEffect(() => {
    if (!hiddenVideoRef.current && typeof document !== 'undefined') {
      const v = document.createElement('video')
      v.autoplay = true
      v.muted = true
      v.playsInline = true
      v.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'
      document.body.appendChild(v)
      hiddenVideoRef.current = v
    }

    const video = hiddenVideoRef.current
    if (video && activeStream && activeStream.active) {
      if (video.srcObject !== activeStream) {
        video.srcObject = activeStream
        video.play().catch(() => {})
      }
    }

    return () => {
      // Teardown tracks on unmount if requested
    }
  }, [activeStream])

  // Asynchronous downscaled 640x360 snapshot (non-blocking)
  const captureSnapshot = useCallback(async () => {
    const video = hiddenVideoRef.current
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track || track.readyState !== 'live' || !video || video.readyState < 2) return null

    try {
      if (!canvasRef.current && typeof document !== 'undefined') {
        canvasRef.current = document.createElement('canvas')
        canvasRef.current.width = 640
        canvasRef.current.height = 360
      }
      const canvas = canvasRef.current
      if (!canvas) return null
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, 640, 360)

      return await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null)
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        }, 'image/jpeg', 0.6)
      })
    } catch (_) {
      return null
    }
  }, [])

  const recordViolationEvent = useCallback(async (eventType, severity = 'MEDIUM', meta = {}) => {
    const aId = attemptIdRef.current
    const eId = examIdRef.current
    if (!aId && !eId) return

    try {
      const snapshotDataUrl = await captureSnapshot()
      await apiClient.post('/proctoring/events', {
        attemptId: aId,
        examId: eId,
        eventType,
        severity,
        snapshotDataUrl,
        metadata: { ...meta, recordedAt: new Date().toISOString() }
      }).catch(() => {})

      if (onViolationRef.current && eventType !== 'HEARTBEAT_SNAPSHOT') {
        onViolationRef.current({ eventType, severity, snapshotDataUrl })
      }
    } catch (_) {}
  }, [captureSnapshot])

  // Real-time violation handlers
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'hidden') recordViolationEvent('TAB_SWITCH', 'HIGH')
    }
    const handleFull = () => {
      if (!document.fullscreenElement) recordViolationEvent('FULLSCREEN_EXIT', 'HIGH')
    }
    const handleBlur = () => {
      recordViolationEvent('WINDOW_BLUR', 'MEDIUM')
    }

    document.addEventListener('visibilitychange', handleVis)
    document.addEventListener('fullscreenchange', handleFull)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVis)
      document.removeEventListener('fullscreenchange', handleFull)
      window.removeEventListener('blur', handleBlur)
    }
  }, [recordViolationEvent])

  // Throttled 25-second heartbeat
  useEffect(() => {
    if (!attemptId) return
    const interval = setInterval(() => {
      recordViolationEvent('HEARTBEAT_SNAPSHOT', 'INFO')
    }, 25000)
    return () => clearInterval(interval)
  }, [attemptId, recordViolationEvent])

  // Monitor screen track ending
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    const onEnded = () => {
      setScreenLost(true)
      recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL')
    }
    track.addEventListener('ended', onEnded)
    track.onended = onEnded
    return () => {
      track.removeEventListener('ended', onEnded)
      if (track.onended === onEnded) track.onended = null
    }
  }, [activeStream, recordViolationEvent])

  const [cameraLost, setCameraLost] = useState(false)
  const cameraStreamRef = useRef(null)

  useEffect(() => {
    const camStream = typeof window !== 'undefined' ? (window.__proctorCameraStream || null) : null
    cameraStreamRef.current = camStream
    const track = camStream?.getVideoTracks?.()[0]
    if (!track) return
    const onCamEnded = () => {
      setCameraLost(true)
      recordViolationEvent('CAMERA_DISCONNECTED', 'CRITICAL')
    }
    track.addEventListener('ended', onCamEnded)
    track.onended = onCamEnded
    return () => {
      track.removeEventListener('ended', onCamEnded)
      if (track.onended === onCamEnded) track.onended = null
    }
  }, [recordViolationEvent])

  const reShareScreen = async () => {
    try {
      const newStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS)
      const track = newStream.getVideoTracks()[0]
      if (track.getSettings()?.displaySurface !== 'monitor') {
        track.stop()
        return false
      }
      const onEnded = () => {
        setScreenLost(true)
        recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL')
      }
      track.addEventListener('ended', onEnded)
      track.onended = onEnded
      streamRef.current = newStream
      if (typeof window !== 'undefined') window.__proctorScreenStream = newStream
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = newStream
        hiddenVideoRef.current.play().catch(() => {})
      }
      setScreenLost(false)
      return true
    } catch (_) {
      return false
    }
  }

  const reEnableCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      const track = newStream.getVideoTracks()[0]
      const onCamEnded = () => {
        setCameraLost(true)
        recordViolationEvent('CAMERA_DISCONNECTED', 'CRITICAL')
      }
      track.addEventListener('ended', onCamEnded)
      track.onended = onCamEnded
      cameraStreamRef.current = newStream
      if (typeof window !== 'undefined') window.__proctorCameraStream = newStream
      setCameraLost(false)
      return true
    } catch (_) {
      return false
    }
  }

  const isProctoringInterrupted = screenLost || cameraLost

  const ProctoringOverlayWrapper = () => (
    <ProctoringInterruptedOverlay
      isOpen={isProctoringInterrupted}
      screenLost={screenLost}
      cameraLost={cameraLost}
      onReShareScreen={reShareScreen}
      onReEnableCamera={reEnableCamera}
    />
  )

  const ScreenLostDialog = () => isProctoringInterrupted ? <ProctoringOverlayWrapper /> : null

  return {
    screenLost,
    cameraLost,
    isProctoringInterrupted,
    reShareScreen,
    reEnableCamera,
    captureSnapshot,
    recordViolationEvent,
    ScreenLostDialog,
    ProctoringInterruptedOverlay
  }
}

export default useScreenProctoring
