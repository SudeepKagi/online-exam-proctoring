import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/apiClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

  const ProctoringInterruptedOverlay = () => {
    if (!isProctoringInterrupted) return null
    return (
      <div
        data-testid="proctoring-interrupted-overlay"
        className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans"
      >
        <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-[480] text-[#28253b] mb-2">Proctoring Interrupted</h2>
        <p className="text-sm font-[360] text-[#554e7b] max-w-md mb-6 leading-relaxed">
          You stopped screen/camera sharing. Continuous monitoring is strictly mandatory throughout the examination. Re-enable sharing immediately to continue your exam.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {screenLost && (
            <Button
              onClick={reShareScreen}
              className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-6 h-10 shadow-xs cursor-pointer"
            >
              Re-Enable Screen Sharing
            </Button>
          )}
          {cameraLost && (
            <Button
              onClick={reEnableCamera}
              className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-6 h-10 shadow-xs cursor-pointer"
            >
              Re-Enable Camera
            </Button>
          )}
        </div>
      </div>
    )
  }

  const ScreenLostDialog = () => isProctoringInterrupted ? <ProctoringInterruptedOverlay /> : null

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
