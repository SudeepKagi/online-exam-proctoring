import React, { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/apiClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function useScreenProctoring({ stream, attemptId, examId, onViolation } = {}) {
  const streamRef = useRef(stream)
  streamRef.current = stream
  const [screenLost, setScreenLost] = useState(false)

  const capture1280x720 = useCallback(() => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track || track.readyState !== 'live') return null
    try {
      const video = document.createElement('video')
      video.srcObject = streamRef.current
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      canvas.getContext('2d').drawImage(video, 0, 0, 1280, 720)
      return canvas.toDataURL('image/jpeg', 0.5)
    } catch (_) { return null }
  }, [])

  const recordViolationEvent = useCallback(async (eventType, severity = 'MEDIUM', meta = {}) => {
    try {
      let evidenceKey = null
      const frameJpeg = capture1280x720()
      if (frameJpeg && attemptId) {
        try {
          const presignRes = await apiClient.post('/media/presign-upload', {
            purpose: 'SCREEN_SNAPSHOT', attemptId, contentType: 'image/jpeg',
          })
          if (presignRes.data?.uploadUrl) {
            const blob = await (await fetch(frameJpeg)).blob()
            await fetch(presignRes.data.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })
            evidenceKey = presignRes.data?.key
          }
        } catch (_) {}
      }
      await apiClient.post('/proctoring/events', {
        attemptId, examId, eventType, severity, evidenceKey,
        metadata: { ...meta, recordedAt: new Date().toISOString() },
      })
      if (onViolation) onViolation({ eventType, severity })
    } catch (_) {}
  }, [attemptId, examId, capture1280x720, onViolation])

  useEffect(() => {
    const handleVis = () => { if (document.visibilityState === 'hidden') recordViolationEvent('TAB_SWITCH', 'HIGH') }
    const handleFull = () => { if (!document.fullscreenElement) recordViolationEvent('FULLSCREEN_EXITED', 'HIGH') }
    const handleBlur = () => { recordViolationEvent('WINDOW_BLUR', 'MEDIUM') }
    document.addEventListener('visibilitychange', handleVis)
    document.addEventListener('fullscreenchange', handleFull)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVis)
      document.removeEventListener('fullscreenchange', handleFull)
      window.removeEventListener('blur', handleBlur)
    }
  }, [recordViolationEvent])

  useEffect(() => {
    const interval = setInterval(() => recordViolationEvent('SCREEN_SAMPLE', 'INFO'), 30000)
    return () => clearInterval(interval)
  }, [recordViolationEvent])

  useEffect(() => {
    const track = stream?.getVideoTracks?.()[0]
    if (!track) return
    track.onended = () => { setScreenLost(true); recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL') }
  }, [stream, recordViolationEvent])

  const reShareScreen = async () => {
    try {
      const newStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false })
      const track = newStream.getVideoTracks()[0]
      if (track.getSettings()?.displaySurface !== 'monitor') { track.stop(); return false }
      track.onended = () => { setScreenLost(true); recordViolationEvent('SCREEN_SHARE_ENDED', 'CRITICAL') }
      streamRef.current = newStream
      setScreenLost(false)
      return true
    } catch (_) { return false }
  }

  const ScreenLostDialog = () => !screenLost ? null : (
    React.createElement(Dialog, { open: screenLost },
      React.createElement(DialogContent, { className: 'max-w-md [&>button]:hidden' },
        React.createElement(DialogHeader, null,
          React.createElement(DialogTitle, { className: 'text-red-600' }, 'Screen Share Disconnected'),
          React.createElement(DialogDescription, null, 'You must share your entire screen during this exam. Re-share your monitor to continue.')
        ),
        React.createElement(DialogFooter, null,
          React.createElement(Button, { onClick: reShareScreen, className: 'w-full bg-blue-600 hover:bg-blue-700 text-white text-xs' }, 'Re-Share Entire Screen')
        )
      )
    )
  )

  return { screenLost, reShareScreen, capture1280x720, recordViolationEvent, ScreenLostDialog }
}

export default useScreenProctoring
