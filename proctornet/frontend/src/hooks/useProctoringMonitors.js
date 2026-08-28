import { useState, useEffect, useRef } from 'react'
import * as faceapi from 'face-api.js'
import api from '@/utils/api'

/**
 * useProctoringMonitors Hook
 * Orchestrates webcam stream, face presence detection,
 * and fullscreen / tab-switch compliance.
 */
export function useProctoringMonitors({ examId, emitViolation, isExamActive, allowTabSwitch = false, externalStreamRef }) {
  const videoRef = useRef(null)
  const captureVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)

  const faceIntervalRef = useRef(null)

  const [cameraOk, setCameraOk] = useState(false)
  const [faceOk, setFaceOk] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isFullscreenLocked, setIsFullscreenLocked] = useState(true)

  const notifyViolation = (type, severity, metadata) => {
    emitViolation?.(type, severity, metadata)
  }

  // ── 1. Tab switch / Window blur ──
  useEffect(() => {
    if (!isExamActive || allowTabSwitch) return

    const handleVisibility = () => {
      if (document.hidden) {
        notifyViolation('TAB_SWITCH', 'MEDIUM')
      }
    }

    const handleBlur = () => {
      notifyViolation('WINDOW_BLUR', 'LOW')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isExamActive, allowTabSwitch, emitViolation])

  // ── 2. Fullscreen change listener ──
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFullscreenLocked(isFull)
      if (!isFull && isExamActive) {
        notifyViolation('FULLSCREEN_EXIT', 'HIGH')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isExamActive, emitViolation])

  // ── 3. Load face-api models and initialize Camera ──
  useEffect(() => {
    const MODEL_URL = '/models'
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]).then(() => setModelsLoaded(true)).catch(() => console.warn('Face models unavailable'))

    if (streamRef.current && streamRef.current.active && streamRef.current.getVideoTracks().some(t => t.readyState === 'live')) {
      if (externalStreamRef) externalStreamRef.current = streamRef.current
      setCameraOk(true)
      return
    }

    navigator.mediaDevices?.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (externalStreamRef) externalStreamRef.current = stream
        setCameraOk(true)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('Video play error:', e))
          }
        }
        if (captureVideoRef.current) {
          captureVideoRef.current.srcObject = stream
          captureVideoRef.current.onloadedmetadata = () => {
            captureVideoRef.current.play().catch(e => console.warn('Capture play error:', e))
          }
        }
      })
      .catch(err => {
        console.warn('Camera permission error:', err)
        setCameraOk(false)
      })

    return () => {
      // Stream teardown is managed by ExamInterface on terminal state
    }
  }, [])

  // ── 4. Face-API Presence Polling Loop ──
  useEffect(() => {
    if (!modelsLoaded || !cameraOk || !isExamActive) return

    faceIntervalRef.current = setInterval(async () => {
      const videoEl = captureVideoRef.current || videoRef.current
      if (!videoEl || videoEl.readyState < 2) return

      try {
        const detections = await faceapi.detectAllFaces(
          videoEl,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
        )

        if (detections.length === 1) {
          setFaceOk(true)
        } else if (detections.length === 0) {
          setFaceOk(false)
          notifyViolation('NO_FACE_DETECTED', 'HIGH')
        } else {
          setFaceOk(false)
          notifyViolation('MULTIPLE_FACES_DETECTED', 'HIGH', { count: detections.length })
        }
      } catch (err) {
        console.warn('Face detection loop error:', err)
      }
    }, 4000)

    return () => {
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current)
    }
  }, [modelsLoaded, cameraOk, isExamActive, emitViolation])

  return {
    videoRef,
    captureVideoRef,
    canvasRef,
    streamRef,
    screenVideoRef,
    screenCanvasRef,
    cameraOk,
    faceOk,
    isFullscreenLocked
  }
}
