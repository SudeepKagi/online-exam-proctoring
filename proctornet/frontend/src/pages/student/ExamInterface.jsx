import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import * as faceapi from 'face-api.js'
import Editor from '@monaco-editor/react'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import {
  Clock, Camera, CameraOff, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, Flag, Send, Eye, Code, List,
  Lock, Monitor
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// ── Small status pill ──────────────────────────────────
function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

export default function ExamInterface() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Exam data ──
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [secsToStart, setSecsToStart] = useState(null)

  // ── Navigation ──
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})    // { questionId: { selected, code, text } }
  const [flagged, setFlagged] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submittingRef = useRef(false)
  const submittedRef = useRef(false)
  const isConfirmingRef = useRef(false)
  submittingRef.current = submitting
  submittedRef.current = submitted

  // ── Timer ──
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)

  // ── Camera / Face-API ──
  const videoRef = useRef(null)
  const captureVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const faceIntervalRef = useRef(null)
  const [cameraOk, setCameraOk] = useState(false)
  const [faceOk, setFaceOk] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  // ── Screen Share Refs & Fullscreen Gating State ──
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)
  const [isFullscreenLocked, setIsFullscreenLocked] = useState(true)
  const [isScreenShareLocked, setIsScreenShareLocked] = useState(false)

  // ── Socket ──
  const socketRef = useRef(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [violations, setViolations] = useState(0)

  // ── Auto-save ──
  const autoSaveRef = useRef(null)

  // ── Violation Logger ──
  const emitViolation = useCallback((type, severity) => {
    setViolations(v => v + 1)
    
    let cameraFrameUrl = null
    let screenshotUrl = null
    
    // Snap camera frame
    const captVideo = captureVideoRef.current || videoRef.current
    if (captVideo && canvasRef.current) {
      try {
        const ctx = canvasRef.current.getContext('2d')
        const w = captVideo.videoWidth || 320
        const h = captVideo.videoHeight || 240
        canvasRef.current.width = w
        canvasRef.current.height = h
        ctx.drawImage(captVideo, 0, 0, w, h)
        cameraFrameUrl = canvasRef.current.toDataURL('image/jpeg', 0.5)
      } catch (err) {
        console.warn('Failed to capture camera violation frame:', err)
      }
    }
    
    // Snap screen frame
    if (screenVideoRef.current && screenCanvasRef.current) {
      try {
        const sCtx = screenCanvasRef.current.getContext('2d')
        const w = screenVideoRef.current.videoWidth || 640
        const h = screenVideoRef.current.videoHeight || 360
        screenCanvasRef.current.width = w
        screenCanvasRef.current.height = h
        sCtx.drawImage(screenVideoRef.current, 0, 0, w, h)
        screenshotUrl = screenCanvasRef.current.toDataURL('image/jpeg', 0.6)
      } catch (err) {
        console.warn('Failed to capture screen violation frame:', err)
      }
    }
    
    socketRef.current?.emit('exam:flag', { 
      examId, 
      studentId: user?.id, 
      studentName: user?.name, 
      studentUsn: user?.usn, 
      eventType: type, 
      severity,
      cameraFrameUrl,
      screenshotUrl
    })
    
    api.post(`/student/exams/${examId}/violation`, { 
      eventType: type, 
      severity,
      cameraFrameUrl,
      screenshotUrl
    }).catch(() => {})
  }, [examId, user])

  // ─────────────────────────────────────────────────────
  // 1. Load exam data (reusable callback)
  // ─────────────────────────────────────────────────────
  const fetchExamSession = useCallback(async () => {
    try {
      const res = await api.get(`/student/exams/${examId}/start`)
      if (res.data.waiting) {
        setIsWaiting(true)
        setExam(res.data.exam)
        
        // Calculate server-client offset and initial secsToStart
        const serverTime = new Date(res.data.serverTime)
        const startTime = new Date(res.data.exam.startTime)
        const diffMs = startTime.getTime() - serverTime.getTime()
        const diffSecs = Math.max(0, Math.ceil(diffMs / 1000))
        setSecsToStart(diffSecs)
      } else {
        setIsWaiting(false)
        const { exam: examData, questions: qs } = res.data
        setExam(examData)
        setQuestions(qs || [])
        const secs = (examData.duration || 60) * 60
        setTimeLeft(secs)
        
        // Pre-fill saved answers (correctly reading answers from res.data.answers)
        if (res.data.answers) {
          const saved = {}
          res.data.answers.forEach(a => {
            saved[a.questionId] = {
              selected: a.selectedOption,
              code: a.codeAnswer,
              text: a.writtenText
            }
          })
          setAnswers(saved)
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to load exam'
      toast.error(errMsg)
      navigate('/student/exams')
    } finally {
      setLoading(false)
    }
  }, [examId, navigate])

  useEffect(() => {
    fetchExamSession()
  }, [fetchExamSession])

  // ─────────────────────────────────────────────────────
  // 1.1 Waiting holding countdown timer
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isWaiting || secsToStart === null) return
    if (secsToStart <= 0) {
      fetchExamSession()
      return
    }
    const timer = setTimeout(() => {
      setSecsToStart(s => s - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [isWaiting, secsToStart, fetchExamSession])

  // ─────────────────────────────────────────────────────
  // 2. Countdown timer
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || submitted) return
    if (timeLeft <= 0) { handleSubmit(true); return }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timeLeft, submitted])

  // ─────────────────────────────────────────────────────
  // 3. Socket.io — join room + listen for warnings
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('proctornet_token')
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token }, transports: ['websocket', 'polling']
    })
    socketRef.current = socket
    setSocketConnected(true)
    socket.emit('exam:join', { examId, studentId: user?.id, name: user?.name, usn: user?.usn })
    socket.on('exam:warning', ({ message }) => toast.error(`⚠️ ${message}`, { duration: 6000 }))
    socket.on('exam:terminated', () => { toast.error('Exam terminated by invigilator'); handleSubmit(true) })
    return () => {
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [examId, user])

  // ─────────────────────────────────────────────────────
  // 4. Tab-switch / window-blur detection
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleBlur = () => {
      if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
      emitViolation('TAB_SWITCH', 'MEDIUM')
    }
    const handleVisibility = () => {
      if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
      if (document.hidden) emitViolation('TAB_SWITCH', 'MEDIUM')
    }
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [emitViolation])

  // ─────────────────────────────────────────────────────
  // 5. Load face-api models + start camera
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const MODEL_URL = '/models'
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]).then(() => setModelsLoaded(true)).catch(() => console.warn('Face models unavailable'))

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('Play error:', e))
          }
        }
        if (captureVideoRef.current) {
          captureVideoRef.current.srcObject = stream
          captureVideoRef.current.onloadedmetadata = () => {
            captureVideoRef.current.play().catch(e => console.warn('Capture play error:', e))
          }
        }
        setCameraOk(true)
      })
      .catch((err) => {
        console.error('Camera access error:', err)
        setCameraOk(false)
        emitViolation('CAMERA_BLOCKED', 'HIGH')
        toast.error('Camera access denied — violations will be logged')
      })

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      clearInterval(faceIntervalRef.current)
    }
  }, [])

  // Ensure camera feed stays connected when views transition (waiting lobby <-> exam interface)
  useEffect(() => {
    if (streamRef.current) {
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn('Play error:', e))
        }
      }
      if (captureVideoRef.current && !captureVideoRef.current.srcObject) {
        captureVideoRef.current.srcObject = streamRef.current
        captureVideoRef.current.onloadedmetadata = () => {
          captureVideoRef.current.play().catch(e => console.warn('Capture play error:', e))
        }
      }
    }
  }, [isWaiting, cameraOk])

  // ─────────────────────────────────────────────────────
  // 6. Face detection and frame streaming loop (every 1.5s)
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraOk || submitted) return
    faceIntervalRef.current = setInterval(async () => {
      if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
      const captVideo = captureVideoRef.current || videoRef.current
      if (!captVideo) return
      try {
        if (socketRef.current && canvasRef.current) {
          if (!captVideo.srcObject && streamRef.current) {
            captVideo.srcObject = streamRef.current
            captVideo.play().catch(e => console.warn('Webcam recovery play error:', e))
          }
          const ctx = canvasRef.current.getContext('2d')
          canvasRef.current.width = captVideo.videoWidth || 320
          canvasRef.current.height = captVideo.videoHeight || 240
          ctx.drawImage(captVideo, 0, 0, canvasRef.current.width, canvasRef.current.height)
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.5)
          socketRef.current.emit('exam:frame', { examId, studentId: user?.id, frame })
        }

        // Emit screen frame as well
        if (socketRef.current && screenVideoRef.current && screenCanvasRef.current) {
          if (!screenVideoRef.current.srcObject && window.screenShareStream) {
            screenVideoRef.current.srcObject = window.screenShareStream
            screenVideoRef.current.play().catch(e => console.warn('Screen recovery play error:', e))
          }
          const sCtx = screenCanvasRef.current.getContext('2d')
          screenCanvasRef.current.width = 640
          screenCanvasRef.current.height = 360
          sCtx.drawImage(screenVideoRef.current, 0, 0, 640, 360)
          const screenFrame = screenCanvasRef.current.toDataURL('image/jpeg', 0.4)
          socketRef.current.emit('exam:screenFrame', { examId, studentId: user?.id, frame: screenFrame })
        }

        if (modelsLoaded) {
          const options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          const detections = await faceapi.detectAllFaces(captVideo, options)
          if (detections.length === 0) {
            setFaceOk(false)
            emitViolation('NO_FACE', 'HIGH')
          } else if (detections.length > 1) {
            setFaceOk(false)
            emitViolation('MULTIPLE_FACES', 'CRITICAL')
            toast.error('Multiple faces detected!', { duration: 4000 })
          } else {
            setFaceOk(true)
          }
        }
      } catch { /* silent */ }
    }, 1500)
    return () => clearInterval(faceIntervalRef.current)
  }, [modelsLoaded, cameraOk, submitted, examId, user, emitViolation])

  // ─────────────────────────────────────────────────────
  // 7. Auto-save every 30s
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      Object.entries(answers).forEach(([questionId, ans]) => {
        api.post(`/student/exams/${examId}/autosave`, { questionId, ...ans }).catch(() => {})
      })
    }, 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [answers, examId])

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────

  const handleRequestScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always"
        },
        audio: false
      })

      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) {
        throw new Error('No video track found in screen share stream.')
      }

      window.screenShareStream = stream

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream
        screenVideoRef.current.onloadedmetadata = () => {
          screenVideoRef.current.play().catch(e => console.warn('Screen play error:', e))
        }
      }

      // Add the track ended listener to the new stream
      const handleTrackEnded = () => {
        if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
        setIsScreenShareLocked(true)
        emitViolation('SCREEN_SHARE_STOPPED', 'CRITICAL')
        toast.error('Screen sharing stopped! A critical security violation has been logged.', { duration: 6000 })
      }
      videoTrack.addEventListener('ended', handleTrackEnded)

      setIsScreenShareLocked(false)
      toast.success('Screen share successfully re-authorized.')
    } catch (err) {
      console.error(err)
      toast.error('You must share your entire screen to proceed with this exam.')
    }
  }

  // ── Bind Screen Share Stream ──
  useEffect(() => {
    if (!window.screenShareStream) {
      setIsScreenShareLocked(true)
      return
    }

    const screenVideo = screenVideoRef.current
    if (screenVideo) {
      screenVideo.srcObject = window.screenShareStream
      screenVideo.onloadedmetadata = () => {
        screenVideo.play().catch(e => console.warn('Screen play error:', e))
      }

      const videoTrack = window.screenShareStream.getVideoTracks()[0]
      if (videoTrack) {
        const handleTrackEnded = () => {
          if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
          setIsScreenShareLocked(true)
          emitViolation('SCREEN_SHARE_STOPPED', 'CRITICAL')
          toast.error('Screen sharing stopped! A critical security violation has been logged.', { duration: 6000 })
        }
        videoTrack.addEventListener('ended', handleTrackEnded)
        return () => {
          videoTrack.removeEventListener('ended', handleTrackEnded)
        }
      }
    }
  }, [emitViolation])

  // ── Fullscreen Gating & Exit Blur ──
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
      const isFull = !!document.fullscreenElement
      setIsFullscreenLocked(isFull)
      if (!isFull) {
        emitViolation('FULLSCREEN_EXIT', 'HIGH')
        toast.error('Fullscreen mode exited! Please return to fullscreen immediately.')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Try to enter fullscreen on mount
    const requestInitialFullscreen = async () => {
      if (submittedRef.current || submittingRef.current || isConfirmingRef.current) return
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
          setIsFullscreenLocked(true)
        }
      } catch (err) {
        console.warn('Initial fullscreen request failed:', err)
        setIsFullscreenLocked(false)
      }
    }
    requestInitialFullscreen()

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [emitViolation])

  // Emit progress on initial load and whenever answers change
  useEffect(() => {
    if (socketRef.current && socketConnected && questions.length > 0) {
      socketRef.current.emit('student:progress', {
        examId,
        studentId: user?.id,
        answered: Object.keys(answers).length,
        total: questions.length
      })
    }
  }, [questions, answers, examId, user, socketConnected])

  const setAnswer = (questionId, field, value) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: { ...prev[questionId], [field]: value } }
      socketRef.current?.emit('student:progress', {
        examId,
        studentId: user?.id,
        answered: Object.keys(newAnswers).length,
        total: questions.length
      })
      return newAnswers
    })
    api.post(`/student/exams/${examId}/answer`, { questionId, [field]: value }).catch(() => {})
  }

  const toggleFlag = (id) => {
    setFlagged(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const handleSubmit = async (auto = false) => {
    if (submitting || submitted) return
    let confirmed = false
    if (!auto) {
      isConfirmingRef.current = true
      confirmed = confirm('Are you sure you want to submit? You cannot change answers after submission.')
      isConfirmingRef.current = false
      if (!confirmed) {
        // Re-request fullscreen to restore compliance immediately if canceled
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen()
            setIsFullscreenLocked(true)
          }
        } catch (err) {
          setIsFullscreenLocked(false)
        }
        return
      }
    }
    submittingRef.current = true
    setSubmitting(true)
    clearInterval(autoSaveRef.current)
    clearInterval(faceIntervalRef.current)

    try {
      await api.post(`/student/exams/${examId}/submit`, { answers })
      submittedRef.current = true
      setSubmitted(true)

      // Clean up local media feeds immediately to release hardware on successful submission
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (window.screenShareStream) {
        window.screenShareStream.getTracks().forEach(t => t.stop())
      }
      
      // Clean up fullscreen mode programmatically on successful submission
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
        }
      } catch (err) {
        console.warn('Failed to exit fullscreen:', err)
      }

      toast.success('Exam submitted successfully!')
      setTimeout(() => navigate('/student/results'), 3000)
    } catch (err) { 
      toast.error('Submission failed. Try again.') 
      submittingRef.current = false
    } finally { 
      setSubmitting(false) 
    }
  }

  // ── Loading / Submit states ──
  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" /><p className="text-gray-400">Loading exam…</p></div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-green-400" /></div>
        <h2 className="text-2xl font-bold text-white mb-2">Submitted!</h2>
        <p className="text-gray-400">Redirecting to results…</p>
      </div>
    </div>
  )

  if (isWaiting) {
    const timerColor = secsToStart < 60 ? 'text-rose-400 animate-pulse' : secsToStart < 300 ? 'text-amber-400' : 'text-blue-400'
    return (
      <div className="min-h-screen bg-[#070b19] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-950/40 via-[#070b19] to-[#04060d] text-gray-200 flex flex-col items-center justify-center p-4">
        {/* Background glowing rings */}
        <div className="absolute top-20 right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 lg:p-8 relative text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
            </div>
            <div className="text-left">
              <h1 className="font-bold text-sm tracking-wide text-white">PROCTORNET WAITING LOBBY</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Security Check Complete</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">{exam?.title}</h2>
          <p className="text-sm text-gray-400 mb-6">{exam?.subject} • Prof. {exam?.faculty?.name || 'Faculty'}</p>

          {/* Countdown timer */}
          <div className="bg-black/30 rounded-2xl p-6 border border-white/5 mb-6 max-w-sm mx-auto">
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-2">Exam Starts In</p>
            <div className={`font-mono text-4xl font-extrabold tracking-wider ${timerColor}`}>
              {formatTime(secsToStart)}
            </div>
          </div>

          {/* Proctored preview and status list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Live Camera Preview */}
            <div className="space-y-2">
              <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider flex items-center gap-1.5 justify-center"><Camera size={12} /> Active Feed Preview</span>
              <div className="relative bg-black/60 rounded-2xl border border-white/10 overflow-hidden aspect-video flex items-center justify-center mx-auto">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-2xl" />
                {!cameraOk && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                    <div className="text-center">
                      <CameraOff size={24} className="text-red-400 mx-auto mb-1 animate-pulse" />
                      <p className="text-xs text-red-400">Camera Inactive</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Shield and integrity status */}
            <div className="text-left space-y-3 bg-white/5 border border-white/5 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">🛡 Active Security Gating</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Exclusive Fullscreen Gated</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Tab switch enforcement active</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Biometric face tracking ready</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Live frame invigilator socket active</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/10 text-xs text-gray-500 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span>Secure holding state. Do not close or refresh this tab.</span>
          </div>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentIdx]
  const answered = Object.keys(answers).length
  const timerColor = timeLeft < 300 ? 'text-red-400' : timeLeft < 600 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Top bar ── */}
      <header className="bg-gray-900 border-b border-gray-800 h-14 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><Eye size={14} className="text-white" /></div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">{exam?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{exam?.subject} • {questions.length} questions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill ok={cameraOk} label="Camera" />
          <StatusPill ok={faceOk} label="Face" />
          {violations > 0 && <span className="text-xs font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded-full">{violations} flags</span>}
          <div className={`font-mono text-lg font-bold ${timerColor}`}>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: question panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentQ ? (
            <div className="flex-1 overflow-y-auto p-5 lg:p-6">
              {/* Question header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Q{currentIdx + 1} of {questions.length}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      currentQ.difficulty === 'HARD' ? 'bg-red-900/60 text-red-300' : currentQ.difficulty === 'EASY' ? 'bg-green-900/60 text-green-300' : 'bg-amber-900/60 text-amber-300'
                    }`}>{currentQ.difficulty}</span>
                    <span className="text-xs text-gray-500">{currentQ.marks} marks</span>
                  </div>
                  <p className="text-base font-medium text-gray-100 leading-relaxed max-w-2xl">{currentQ.questionText}</p>
                </div>
                <button onClick={() => toggleFlag(currentQ.id)}
                  className={`p-2 rounded-lg transition-colors ${flagged.has(currentQ.id) ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-gray-800 text-gray-500'}`}>
                  <Flag size={16} />
                </button>
              </div>

              {/* MCQ */}
              {currentQ.type === 'MCQ' && (
                <div className="space-y-2.5">
                  {['A','B','C','D'].map((opt, i) => {
                    const optRaw = currentQ[`option${opt}`] || currentQ.options?.[i]
                    if (!optRaw) return null
                    
                    let text = ''
                    if (typeof optRaw === 'object' && optRaw !== null) {
                      if (optRaw.text !== undefined && optRaw.text !== null) {
                        text = typeof optRaw.text === 'object' ? (optRaw.text.text || JSON.stringify(optRaw.text)) : String(optRaw.text)
                      } else {
                        text = JSON.stringify(optRaw)
                      }
                    } else {
                      text = String(optRaw)
                    }

                    const selected = answers[currentQ.id]?.selected === opt
                    return (
                      <button key={opt} onClick={() => setAnswer(currentQ.id, 'selected', opt)}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                          selected ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                        }`}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${selected ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{opt}</span>
                        {text}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Coding question */}
              {currentQ.type === 'CODE' && (
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-400"><Code size={13} /> Code Editor</div>
                    <select className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border-0">
                      <option>Python</option><option>JavaScript</option><option>Java</option><option>C++</option>
                    </select>
                  </div>
                  <Editor
                    height="320px"
                    defaultLanguage="python"
                    value={answers[currentQ.id]?.code || '# Write your solution here\n'}
                    onChange={val => setAnswer(currentQ.id, 'code', val)}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, wordWrap: 'on' }}
                  />
                </div>
              )}

              {/* Subjective */}
              {currentQ.type === 'SUBJECTIVE' && (
                <textarea
                  value={answers[currentQ.id]?.text || ''}
                  onChange={e => setAnswer(currentQ.id, 'text', e.target.value)}
                  placeholder="Write your answer here…"
                  rows={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl text-gray-200 text-sm p-4 focus:outline-none focus:border-blue-500 resize-none"
                />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">No questions loaded.</div>
          )}

          {/* ── Question navigation footer ── */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
            <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors">
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <CheckCircle size={14} className="text-green-400" />
              <span><span className="text-green-400 font-semibold">{answered}</span>/{questions.length} answered</span>
            </div>
            {currentIdx < questions.length - 1 ? (
              <button onClick={() => setCurrentIdx(i => i + 1)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button disabled={submitting} onClick={() => handleSubmit(false)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
                Submit Exam
              </button>
            )}
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <aside className="w-60 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 hidden lg:flex">
          {/* Camera feed */}
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Live Camera</p>
            <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!cameraOk && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <div className="text-center"><CameraOff size={20} className="text-red-400 mx-auto mb-1" /><p className="text-xs text-red-400">No Camera</p></div>
                </div>
              )}
            </div>
          </div>

          {/* Question palette */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-1"><List size={11} /> Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id]?.selected || !!answers[q.id]?.code || !!answers[q.id]?.text
                const isFlagged = flagged.has(q.id)
                const isCurrent = i === currentIdx
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(i)}
                    className={`w-full aspect-square rounded-lg text-xs font-bold transition-all ${
                      isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-400' :
                      isFlagged ? 'bg-amber-500/30 text-amber-400 border border-amber-600' :
                      isAnswered ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 space-y-1.5">
              {[['bg-blue-600', 'Current'], ['bg-green-500/20 border border-green-700', 'Answered'], ['bg-amber-500/30 border border-amber-600', 'Flagged'], ['bg-gray-800', 'Unanswered']].map(([cls, label]) => (
                <div key={label} className="flex items-center gap-2 text-xs text-gray-500">
                  <div className={`w-3 h-3 rounded ${cls}`} />{label}
                </div>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <div className="p-3 border-t border-gray-800">
            <button disabled={submitting} onClick={() => handleSubmit(false)}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
              Submit Exam
            </button>
          </div>
        </aside>
      </div>

      {/* Security Compliance Lock Overlay */}
      {(!isFullscreenLocked || isScreenShareLocked) && !submitted && !submitting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-950/85 backdrop-blur-xl p-4 text-center select-none">
          <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-3xl p-8 shadow-2xl relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
              <AlertTriangle size={36} className="text-red-500 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-white mt-6 mb-2">Security Shield Active</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              {!isFullscreenLocked && isScreenShareLocked
                ? "Multiple security requirements are breached. You have exited fullscreen and screen sharing is inactive."
                : !isFullscreenLocked
                ? "You have exited fullscreen mode. Exiting fullscreen is an unauthorized action and has been logged as a high-severity violation."
                : "Continuous screen sharing is required to proctor this exam. The proctoring system has lost access to your desktop stream."}
              {" "}Your exam workspace is locked until full compliance is restored.
            </p>
            <div className="space-y-3">
              {!isFullscreenLocked && (
                <button
                  onClick={async () => {
                    try {
                      await document.documentElement.requestFullscreen()
                      setIsFullscreenLocked(true)
                    } catch (err) {
                      toast.error('Failed to enter fullscreen mode. Please click again or check browser permissions.')
                    }
                  }}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30"
                >
                  <Lock size={16} />
                  Return to Fullscreen Mode
                </button>
              )}
              {isScreenShareLocked && (
                <button
                  onClick={handleRequestScreenShare}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30"
                >
                  <Monitor size={16} />
                  Re-Authorize Screen Share
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-5 uppercase tracking-widest font-semibold">
              ProctorNet Integrity Shield Active
            </p>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={screenCanvasRef} className="hidden" />
      <video ref={captureVideoRef} style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '320px', height: '240px', opacity: 0, pointerEvents: 'none' }} playsInline muted />
      <video ref={screenVideoRef} style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '640px', height: '360px', opacity: 0, pointerEvents: 'none' }} playsInline muted />
    </div>
  )
}
