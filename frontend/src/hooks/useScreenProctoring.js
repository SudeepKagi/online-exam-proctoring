import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/apiClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function useScreenProctoring({ stream, attemptId, examId, onViolation } = {}) {
  const [screenLost, setScreenLost] = useState(false)
  const activeStream = stream || (typeof window !== 'undefined' ? window.__proctorScreenStream : null)
  const streamRef = useRef(activeStream)
  streamRef.current = activeStream
  const hiddenVideoRef = useRef(null)

  useEffect(() => {
    if (!hiddenVideoRef.current && typeof document !== 'undefined') {
      const v = document.createElement('video')
      v.autoplay = true
      v.muted = true
      v.playsInline = true
      v.style.position = 'fixed'
      v.style.top = '-9999px'
      v.style.left = '-9999px'
      v.style.width = '1px'
      v.style.height = '1px'
      v.style.opacity = '0'
      v.style.pointerEvents = 'none'
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
      // Keep hidden video attached or cleanup on unmount
    }
  }, [activeStream])

  const capture960x540 = useCallback(() => {
    const video = hiddenVideoRef.current
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track || track.readyState !== 'live' || !video) return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 540
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, 960, 540)
      return canvas.toDataURL('image/jpeg', 0.55)
    } catch (_) {
      return null
    }
  }, [])

  const recordViolationEvent = useCallback(async (eventType, severity = 'MEDIUM', meta = {}) => {
    if (!attemptId && !examId) return
    try {
      const snapshotDataUrl = capture960x540()
      await apiClient.post('/proctoring/events', {
        attemptId,
        examId,
        eventType,
        severity,
        snapshotDataUrl,
        metadata: { ...meta, recordedAt: new Date().toISOString() }
      })
      if (onViolation && eventType !== 'HEARTBEAT_SNAPSHOT') {
        onViolation({ eventType, severity, snapshotDataUrl })
      }
    } catch (_) {}
  }, [attemptId, examId, capture960x540, onViolation])

  // Real-time violation handlers: tab switch, fullscreen change, window blur
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'hidden') {
        recordViolationEvent('TAB_SWITCH', 'HIGH')
      }
    }
    const handleFull = () => {
      if (!document.fullscreenElement) {
        recordViolationEvent('FULLSCREEN_EXIT', 'HIGH')
      }
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

  // 20-second heartbeat screen snapshot capture
  useEffect(() => {
    const interval = setInterval(() => {
      recordViolationEvent('HEARTBEAT_SNAPSHOT', 'INFO')
    }, 20000)
    return () => clearInterval(interval)
  }, [recordViolationEvent])

  // Monitor screen track ending
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    track.onended = () => {
      setScreenLost(true)
      recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL')
    }
  }, [activeStream, recordViolationEvent])

  const reShareScreen = async () => {
    try {
      const newStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false
      })
      const track = newStream.getVideoTracks()[0]
      if (track.getSettings()?.displaySurface !== 'monitor') {
        track.stop()
        return false
      }
      track.onended = () => {
        setScreenLost(true)
        recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL')
      }
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

  const ScreenLostDialog = () => !screenLost ? null : (
    React.createElement(Dialog, { open: screenLost },
      React.createElement(DialogContent, { className: 'max-w-md [&>button]:hidden font-sans' },
        React.createElement(DialogHeader, null,
          React.createElement(DialogTitle, { className: 'text-destructive font-bold' }, 'Screen Share Disconnected'),
          React.createElement(DialogDescription, { className: 'text-xs text-muted-foreground mt-1' }, 'You must share your entire screen throughout the exam. Re-share your monitor immediately to resume.')
        ),
        React.createElement(DialogFooter, { className: 'mt-4' },
          React.createElement(Button, { onClick: reShareScreen, className: 'w-full bg-primary text-primary-foreground text-xs font-semibold' }, 'Re-Share Entire Screen')
        )
      )
    )
  )

  return { screenLost, reShareScreen, capture960x540, recordViolationEvent, ScreenLostDialog }
}

export default useScreenProctoring
