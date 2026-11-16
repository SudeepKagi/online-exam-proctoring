import { useRef, useCallback, useEffect } from 'react'
import { apiClient } from '@/lib/apiClient'

// Phase 2 B.2: Policy table of which violations attach a DOM screenshot vs metadata-only.
// Plain statement: Page capture captures only the rendered exam webpage DOM canvas,
// NOT other applications, desktop windows, or external desktop processes.
const SCREENSHOT_POLICY = {
  // Attached: Exam webpage state is captured to preserve context
  CLIPBOARD_COPY: true,
  CLIPBOARD_PASTE: true,
  PRINT_SCREEN: true,
  SCREENSHOT_KEY: true,
  DEVTOOLS_OPEN: true,
  CONTEXT_MENU: true,
  FULLSCREEN_EXIT: true,
  WINDOW_RESIZE: true,

  // Metadata-only: Capturing the exam page would mislead since user is away
  TAB_SWITCH: false,
  WINDOW_BLUR: false
}

// Default minimum interval between screenshots per attempt (10s)
const SCREENSHOT_MIN_INTERVAL_MS = 10000

export function useScreenProctoring({ attemptId, examId, onViolation } = {}) {
  const attemptIdRef = useRef(attemptId)
  const examIdRef = useRef(examId)
  const onViolationRef = useRef(onViolation)
  const lastScreenshotTimeRef = useRef(0)
  const retryQueueRef = useRef([])
  const isRetryingRef = useRef(false)

  attemptIdRef.current = attemptId
  examIdRef.current = examId
  onViolationRef.current = onViolation

  // Retry worker for queued screenshot uploads
  const processRetryQueue = useCallback(async () => {
    if (isRetryingRef.current || retryQueueRef.current.length === 0) return
    isRetryingRef.current = true

    while (retryQueueRef.current.length > 0) {
      const item = retryQueueRef.current[0]
      try {
        const { putUrl, postUrl, fields, blob } = item
        if (putUrl) {
          await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          })
        } else if (postUrl) {
          const formData = new FormData()
          Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v))
          formData.append('file', blob)
          await fetch(postUrl, { method: 'POST', body: formData })
        }
        retryQueueRef.current.shift()
      } catch (err) {
        item.retries = (item.retries || 0) + 1
        if (item.retries >= 3) {
          retryQueueRef.current.shift()
        } else {
          break
        }
      }
    }
    isRetryingRef.current = false
  }, [])

  // Lazy-loaded html2canvas page capture (only exam DOM, not other apps)
  const captureAndUploadDomScreenshot = useCallback(async (eventType, logId = null) => {
    const aId = attemptIdRef.current
    const eId = examIdRef.current
    if (!aId || typeof document === 'undefined') return null

    try {
      // Lazy load html2canvas to optimize initial bundle size
      const { default: html2canvas } = await import('html2canvas')

      const targetElement = document.querySelector('[data-testid="exam-arena"]') || document.body
      const canvas = await html2canvas(targetElement, {
        logging: false,
        useCORS: true,
        scale: 0.8
      })

      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.65)
      })

      if (!blob) return null

      // Request S3 presigned upload
      const presignRes = await apiClient.post('/media/presign-upload', {
        purpose: 'VIOLATION_SCREENSHOT',
        attemptId: aId,
        contentType: 'image/jpeg',
        bytes: blob.size,
        metadata: {
          examId: eId,
          eventType,
          logId,
          timestamp: Date.now()
        }
      })

      const { putUrl, postUrl, fields, key } = presignRes.data || {}

      // Execute upload asynchronously without blocking
      try {
        if (putUrl) {
          await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          })
        } else if (postUrl) {
          const formData = new FormData()
          Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v))
          formData.append('file', blob)
          await fetch(postUrl, { method: 'POST', body: formData })
        }
      } catch (uploadErr) {
        // Enqueue retry
        retryQueueRef.current.push({ putUrl, postUrl, fields, blob, key, retries: 0 })
        setTimeout(processRetryQueue, 3000)
      }

      return key || null
    } catch (_) {
      // Capture failure is non-fatal: never crash or block exam runner
      return null
    }
  }, [processRetryQueue])

  // Phase 2 B.3: Save event FIRST, then attach screenshot asynchronously
  const recordViolationEvent = useCallback(async (eventType, severity = 'MEDIUM', meta = {}) => {
    const aId = attemptIdRef.current
    const eId = examIdRef.current
    if (!aId && !eId) return

    const now = Date.now()
    const attachesScreenshot = Boolean(SCREENSHOT_POLICY[eventType])
    const canTakeScreenshot = attachesScreenshot && (now - lastScreenshotTimeRef.current >= SCREENSHOT_MIN_INTERVAL_MS)

    let createdLog = null
    try {
      // 1. Save the violation event record FIRST
      const res = await apiClient.post('/proctoring/events', {
        attemptId: aId,
        examId: eId,
        eventType,
        severity,
        metadata: {
          ...meta,
          attachesScreenshot: canTakeScreenshot,
          recordedAt: new Date().toISOString()
        }
      })
      createdLog = res.data?.result || res.data
    } catch (_) {
      // Network drop: will sync when connection resumes
    }

    // 2. Notify in-memory listeners
    if (onViolationRef.current) {
      onViolationRef.current({
        eventType,
        severity,
        reason: eventType === 'TAB_SWITCH' ? 'Tab switched / window hidden' :
                eventType === 'FULLSCREEN_EXIT' ? 'Fullscreen mode exited' :
                eventType === 'WINDOW_BLUR' ? 'Browser focus lost' :
                eventType === 'PRINT_SCREEN' ? 'Screenshot key combination detected' :
                eventType === 'DEVTOOLS_OPEN' ? 'Developer tools opened' :
                eventType === 'CONTEXT_MENU' ? 'Right-click context menu triggered' :
                eventType === 'WINDOW_RESIZE' ? 'Window resized' : eventType
      })
    }

    // 3. Attach DOM screenshot asynchronously after event is saved
    if (canTakeScreenshot) {
      lastScreenshotTimeRef.current = now
      captureAndUploadDomScreenshot(eventType, createdLog?.id).catch(() => {})
    }
  }, [captureAndUploadDomScreenshot])

  // Listen for client integrity events
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

    const handleContextMenu = (e) => {
      e.preventDefault()
      recordViolationEvent('CONTEXT_MENU', 'MEDIUM')
    }

    const handleKeyDown = (e) => {
      // PrintScreen detection
      if (e.key === 'PrintScreen') {
        recordViolationEvent('PRINT_SCREEN', 'HIGH')
      }
      // Devtools shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) {
        e.preventDefault()
        recordViolationEvent('DEVTOOLS_OPEN', 'CRITICAL')
      }
      // Clipboard copy/paste
      if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === 'C') {
        recordViolationEvent('CLIPBOARD_COPY', 'MEDIUM')
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === 'V') {
        recordViolationEvent('CLIPBOARD_PASTE', 'HIGH')
      }
    }

    const handleResize = () => {
      recordViolationEvent('WINDOW_RESIZE', 'LOW')
    }

    document.addEventListener('visibilitychange', handleVis)
    document.addEventListener('fullscreenchange', handleFull)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('visibilitychange', handleVis)
      document.removeEventListener('fullscreenchange', handleFull)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [recordViolationEvent])

  return {
    recordViolationEvent
  }
}

export default useScreenProctoring
