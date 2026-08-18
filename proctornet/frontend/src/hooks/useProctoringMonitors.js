import { useState, useEffect, useRef } from 'react'
import * as faceapi from 'face-api.js'
import api from '@/utils/api'

/**
 * useProctoringMonitors Hook
 * Orchestrates webcam stream, face presence detection, YOLO object detection polling,
 * audio volume/speech level analysis, and fullscreen / tab-switch compliance.
 */
export function useProctoringMonitors({ emitViolation, isExamActive, allowTabSwitch = false }) {
  const videoRef = useRef(null)
  const captureVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)

  const faceIntervalRef = useRef(null)
  const yoloIntervalRef = useRef(null)
  const audioIntervalRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const noiseSustainRef = useRef(0)

  const [cameraOk, setCameraOk] = useState(false)
  const [faceOk, setFaceOk] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [yoloStatus, setYoloStatus] = useState(null) // null | 'clean' | 'threat'
  const [micLevel, setMicLevel] = useState(0)
  const [isFullscreenLocked, setIsFullscreenLocked] = useState(true)

  // ── 1. Tab switch / Window blur ──
  useEffect(() => {
    if (!isExamActive || allowTabSwitch) return

    const handleVisibility = () => {
      if (document.hidden) {
        emitViolation?.('TAB_SWITCH', 'MEDIUM')
      }
    }

    const handleBlur = () => {
      emitViolation?.('WINDOW_BLUR', 'LOW')
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
        emitViolation?.('FULLSCREEN_EXIT', 'HIGH')
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

    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
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

        // ── Initialize Audio Analysis ──
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          audioContextRef.current = audioContext
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          analyserRef.current = analyser

          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          audioIntervalRef.current = setInterval(() => {
            if (!isExamActive) return
            analyser.getByteFrequencyData(dataArray)
            const sum = dataArray.reduce((a, b) => a + b, 0)
            const avg = sum / dataArray.length
            const normalized = Math.min(1, avg / 128)
            setMicLevel(normalized)

            if (normalized > 0.45) {
              noiseSustainRef.current++
              if (noiseSustainRef.current >= 3) {
                emitViolation?.('SUSPICIOUS_AUDIO', 'MEDIUM', { noiseLevel: normalized })
                noiseSustainRef.current = 0
              }
            } else {
              noiseSustainRef.current = 0
            }
          }, 1000)
        } catch (audioErr) {
          console.warn('Audio analyser init warning:', audioErr)
        }
      })
      .catch(err => {
        console.warn('Camera/Mic permission error:', err)
        setCameraOk(false)
      })

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current)
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    }
  }, [isExamActive, emitViolation])

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
          emitViolation?.('NO_FACE_DETECTED', 'HIGH')
        } else {
          setFaceOk(false)
          emitViolation?.('MULTIPLE_FACES_DETECTED', 'HIGH', { count: detections.length })
        }
      } catch (err) {
        console.warn('Face detection loop error:', err)
      }
    }, 4000)

    return () => {
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current)
    }
  }, [modelsLoaded, cameraOk, isExamActive, emitViolation])

  // ── 5. YOLOv8n Object Detection Polling Loop ──
  useEffect(() => {
    if (!isExamActive || !cameraOk) return

    yoloIntervalRef.current = setInterval(async () => {
      const videoEl = captureVideoRef.current || videoRef.current
      if (!videoEl || !canvasRef.current || videoEl.readyState < 2) return

      try {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        canvas.width = 320
        canvas.height = 240
        ctx.drawImage(videoEl, 0, 0, 320, 240)
        const frameBase64 = canvas.toDataURL('image/jpeg', 0.5)

        const res = await api.post('/student/exams/active/yolo-check', { frame: frameBase64 }, { timeout: 3000 })
        if (res.data) {
          if (res.data.phone_detected) {
            setYoloStatus('threat')
            emitViolation?.('CELL_PHONE_DETECTED', 'HIGH')
          } else if (res.data.book_detected) {
            setYoloStatus('threat')
            emitViolation?.('BOOK_DETECTED', 'MEDIUM')
          } else if (res.data.laptop_detected) {
            setYoloStatus('threat')
            emitViolation?.('SECOND_DEVICE_DETECTED', 'HIGH')
          } else {
            setYoloStatus('clean')
          }
        }
      } catch (err) {
        // Silent catch to prevent exam disruption
      }
    }, 8000)

    return () => {
      if (yoloIntervalRef.current) clearInterval(yoloIntervalRef.current)
    }
  }, [isExamActive, cameraOk, emitViolation])

  return {
    videoRef,
    captureVideoRef,
    canvasRef,
    streamRef,
    screenVideoRef,
    screenCanvasRef,
    cameraOk,
    faceOk,
    yoloStatus,
    micLevel,
    isFullscreenLocked
  }
}
