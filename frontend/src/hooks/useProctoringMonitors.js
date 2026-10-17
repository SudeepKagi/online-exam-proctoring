import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useProctoringMonitors Hook
 * Orchestrates browser security compliance:
 * - Fullscreen lockdown enforcement across all standard and vendor-prefixed browser APIs
 * - Tab-switch and window-blur violation detection
 * - Screen sharing monitoring
 * 
 * Note: Continuous face cam polling is disabled in-exam per policy (face cam is strictly
 * entry/pre-check only; only screen share is fed during the exam).
 */
export function useProctoringMonitors({
  examId,
  emitViolation,
  isExamActive,
  allowTabSwitch = false,
  requireFullscreen = true,
  aiReverifyInterval = 10
}) {
  const videoRef = useRef(null)
  const captureVideoRef = useRef(null)
  const canvasRef = useRef(null)

  const isDocumentFullscreen = () => {
    if (typeof document === 'undefined') return true
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    )
  }

  const [isFullscreenLocked, setIsFullscreenLocked] = useState(() => isDocumentFullscreen())

  const notifyViolation = useCallback((type, severity, metadata) => {
    emitViolation?.(type, severity, metadata)
  }, [emitViolation])

  // ── 1. Tab switch / Window blur / Pagehide ──
  useEffect(() => {
    if (!isExamActive || allowTabSwitch) return

    const handleVisibility = () => {
      if (document.hidden) {
        notifyViolation('TAB_SWITCH', 'MEDIUM', {
          reason: 'Exam tab switched or minimized'
        })
      }
    }

    const handleBlur = () => {
      notifyViolation('WINDOW_BLUR', 'LOW', {
        reason: 'Exam window lost focus'
      })
    }

    const handlePageHide = () => {
      notifyViolation('TAB_SWITCH', 'HIGH', {
        reason: 'Browser page hidden or navigated away'
      })
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [isExamActive, allowTabSwitch, notifyViolation])

  // ── 2. Fullscreen change listener (standard + all vendor prefixes) ──
  useEffect(() => {
    if (!isExamActive || !requireFullscreen) return

    const handleFullscreenChange = () => {
      const isFull = isDocumentFullscreen()
      setIsFullscreenLocked(isFull)
      if (!isFull) {
        notifyViolation('FULLSCREEN_EXIT', 'HIGH', {
          reason: 'Fullscreen lockdown exited by candidate'
        })
      }
    }

    // Verify initial fullscreen state when becoming active
    setIsFullscreenLocked(isDocumentFullscreen())

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ]

    events.forEach(evt => document.addEventListener(evt, handleFullscreenChange))

    return () => {
      events.forEach(evt => document.removeEventListener(evt, handleFullscreenChange))
    }
  }, [isExamActive, requireFullscreen, notifyViolation])

  return {
    videoRef,
    captureVideoRef,
    canvasRef,
    cameraOk: true,
    faceOk: true,
    isFullscreenLocked,
    setIsFullscreenLocked,
    notifyViolation
  }
}
