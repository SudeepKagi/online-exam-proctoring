import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { isAttemptFinished } from '@/utils/examAttemptState'
import { 
  Shield, Camera, Wifi, Monitor, CheckCircle2, XCircle, 
  Loader2, ArrowRight, Lock, Key, Cpu, RefreshCw, AlertTriangle, Play, Sparkles, Check, Download,
  ExternalLink, Clock, FileDown, CheckCircle, Info, AlertOctagon, Terminal, PhoneCall
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setSharedScreenStream, clearSharedScreenStream } from '@/lib/mediaState'
import DeviceCompanionPanel from '@/components/agent/DeviceCompanionPanel'
import { connectSocket, getSocket } from '@/socket/socket'

const STAGES = [
  { id: 'system', name: 'Exam Device Companion Audit', icon: Cpu, desc: 'Hardware & software proctoring companion check' },
  { id: 'media', name: 'Hardware Media Feeds', icon: Camera, desc: 'Webcam feed mapping & mandatory screen share authorization' },
  { id: 'face', name: 'Candidate Biometric Verification', icon: Shield, desc: 'Matching live biometric stream against student profile' },
  { id: 'lock', name: 'Full-screen Assessment Lock & Terms', icon: Lock, desc: 'Viewport locking & candidate integrity agreement' }
]

export default function SecurityCheck() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const reviewPollTimeoutRef = useRef(null)

  const [activeStage, setActiveStage] = useState(0)
  const [stageStatus, setStageStatus] = useState({
    system: 'pending', // pending | loading | pass | fail
    media: 'pending',
    face: 'pending',
    lock: 'pending'
  })
  const [stageDetails, setStageDetails] = useState({
    system: 'Waiting to start...',
    media: 'Waiting to start...',
    face: 'Waiting to start...',
    lock: 'Waiting to start...'
  })

  const [exam, setExam] = useState(null)
  const [student, setStudent] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [companionDetails, setCompanionDetails] = useState(null)
  const [vpnStatus, setVpnStatus] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [screenShared, setScreenShared] = useState(false)
  const [timeToExamStart, setTimeToExamStart] = useState(0)
  const [termsAgreed, setTermsAgreed] = useState(true)

  const updateStage = useCallback((key, status, detail) => {
    setStageStatus(prev => ({ ...prev, [key]: status }))
    setStageDetails(prev => ({ ...prev, [key]: detail }))
  }, [])

  // 1. Stage 0: Exam Device Companion Status Handler
  const handleCompanionStatusChange = useCallback((statusData) => {
    setCompanionDetails(statusData)
    const isHealthy = statusData?.state === 'HEALTHY' || statusData?.state === 'CONNECTED'
    const isWaived = Boolean(statusData?.waiver)
    const isOptional = Boolean(statusData?.gatePassed || statusData?.state === 'OPTIONAL' || statusData?.reason === 'POLICY_NOT_REQUIRED' || exam?.deviceAgentPolicy === 'OPTIONAL' || exam?.deviceAgentPolicy === 'OFF')
    const isDisconnected = statusData?.state === 'LOST_CONNECTION' || statusData?.state === 'DISCONNECTED' || statusData?.state === 'STALE'
    const findings = statusData?.findings || []

    if (isWaived) {
      updateStage('system', 'pass', 'Exam Device Companion • Staff Waiver Active')
    } else if (isOptional) {
      updateStage('system', 'pass', 'Exam Device Companion • Not required for this exam')
    } else if (isHealthy && findings.length === 0) {
      updateStage('system', 'pass', 'Exam Device Companion Active • 0 Prohibited Apps • Clean Integrity')
    } else if (findings.length > 0) {
      const names = findings.map(f => f.ruleName || f.evidence || f.ruleId).join(', ')
      updateStage('system', 'fail', `Prohibited software detected: ${names}. Please close to proceed.`)
    } else if (isDisconnected) {
      updateStage('system', 'fail', 'Device Companion connection lost. Please run the companion and enter code.')
    } else {
      updateStage('system', 'loading', 'Waiting for Exam Device Companion to connect...')
    }
  }, [exam?.deviceAgentPolicy, updateStage])

  // Comprehensive Fullscreen Detection (HTML5, F11, Window Maximize)
  const checkIsFullscreen = useCallback(() => {
    if (typeof window === 'undefined') return false
    const html5Fs = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)
    const mediaFs = Boolean(window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches)
    const screenFs = typeof screen !== 'undefined' && (
      window.innerHeight >= screen.height - 35 ||
      window.outerHeight >= screen.height - 35 ||
      (window.screenTop === 0 && window.screenY === 0 && window.innerHeight >= screen.availHeight - 10)
    )
    return html5Fs || mediaFs || screenFs
  }, [])

  // Listen to live fullscreen changes (HTML5, F11, OS resize)
  useEffect(() => {
    const handleFsChange = () => {
      const active = checkIsFullscreen()
      setIsFullscreen(active)
      if (active) {
        updateStage('lock', 'pass', 'Full-screen assessment lock active')
      } else {
        updateStage('lock', 'loading', 'Ready for full-screen assessment lock activation')
      }
    }

    handleFsChange()
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    document.addEventListener('mozfullscreenchange', handleFsChange)
    window.addEventListener('resize', handleFsChange)

    let mql = null
    if (typeof window !== 'undefined' && window.matchMedia) {
      mql = window.matchMedia('(display-mode: fullscreen)')
      mql.addEventListener?.('change', handleFsChange)
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
      document.removeEventListener('mozfullscreenchange', handleFsChange)
      window.removeEventListener('resize', handleFsChange)
      if (mql) mql.removeEventListener?.('change', handleFsChange)
    }
  }, [checkIsFullscreen, updateStage])

  const handleRequestFullscreen = async () => {
    try {
      const el = document.documentElement
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen
      if (rfs && !document.fullscreenElement) {
        await rfs.call(el)
      }
      setIsFullscreen(true)
      updateStage('lock', 'pass', 'Full-screen assessment lock active')
      toast.success('Full-screen mode active!')
    } catch (err) {
      console.warn('Fullscreen request failed:', err)
      if (checkIsFullscreen()) {
        setIsFullscreen(true)
        updateStage('lock', 'pass', 'Full-screen assessment lock active')
        toast.success('Full-screen mode active!')
      } else {
        toast.error('Browser blocked full-screen request. Press F11 on your keyboard.')
      }
    }
  }

  // Track socket connection & companion real-time updates across ALL stages
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  useEffect(() => {
    const sock = connectSocket()
    if (sock) {
      setIsSocketConnected(Boolean(sock.connected))
      const onConnect = () => {
        setIsSocketConnected(true)
        if (attemptId) sock.emit('attempt:join', { attemptId })
      }
      const onDisconnect = () => setIsSocketConnected(false)
      sock.on('connect', onConnect)
      sock.on('disconnect', onDisconnect)

      const onAgentStatus = (data) => {
        if (!data) return
        handleCompanionStatusChange(data)
        if (data.findings && data.findings.length > 0) {
          const names = data.findings.map(f => f.ruleName || f.evidence || f.ruleId).join(', ')
          toast.error(`⚠️ Prohibited software detected: ${names}. Close immediately to proceed!`, {
            id: 'prohibited-app-alert',
            duration: 8000
          })
        } else if (data.state === 'HEALTHY' || data.state === 'CONNECTED') {
          toast.success('✓ Prohibited applications closed. Companion check clean!', {
            id: 'prohibited-app-alert'
          })
        }
      }

      const onAgentWarning = (data) => {
        const name = data?.ruleName || data?.ruleId || 'prohibited process'
        toast.error(`⚠️ PROHIBITED SOFTWARE DETECTED: ${name}. Close this application immediately to proceed!`, {
          id: 'prohibited-app-alert',
          duration: 9000
        })
      }

      const onAgentCleared = () => {
        toast.success('✓ All prohibited applications closed. Security check passed!', {
          id: 'prohibited-app-alert'
        })
      }

      sock.on('agent:status', onAgentStatus)
      sock.on('agent:warning', onAgentWarning)
      sock.on('agent:cleared', onAgentCleared)

      return () => {
        sock.off('connect', onConnect)
        sock.off('disconnect', onDisconnect)
        sock.off('agent:status', onAgentStatus)
        sock.off('agent:warning', onAgentWarning)
        sock.off('agent:cleared', onAgentCleared)
      }
    }
  }, [attemptId, handleCompanionStatusChange])

  // Join attempt room when attemptId becomes available
  useEffect(() => {
    if (!attemptId) return
    const sock = getSocket()
    if (sock?.connected) {
      sock.emit('attempt:join', { attemptId })
    }
  }, [attemptId])

  // Continuous background polling for companion status (runs across all 4 stages)
  const prevFindingsCountRef = useRef(0)
  useEffect(() => {
    if (!attemptId && !student?.id) return
    let isCancelled = false

    const pollCompanion = async () => {
      try {
        let data = null
        if (attemptId) {
          const res = await api.get(`/attempts/${attemptId}/agent/status`).catch(() => null)
          if (res?.data && res.data.state !== 'NOT_PAIRED') {
            data = res.data
          }
        }
        if (!data) {
          const res = await api.get('/student/agent/status').catch(() => null)
          if (res?.data) {
            data = res.data
          }
        }

        if (data && !isCancelled) {
          handleCompanionStatusChange(data)
          const currFindings = data.findings || []
          if (currFindings.length > 0 && prevFindingsCountRef.current === 0) {
            const names = currFindings.map(f => f.ruleName || f.evidence || f.ruleId).join(', ')
            toast.error(`⚠️ Prohibited software detected: ${names}. Close this application immediately!`, {
              id: 'prohibited-app-alert',
              duration: 8000
            })
          } else if (currFindings.length === 0 && prevFindingsCountRef.current > 0) {
            toast.success('✓ Prohibited applications closed! Security integrity cleared.', {
              id: 'prohibited-app-alert'
            })
          }
          prevFindingsCountRef.current = currFindings.length
        }
      } catch (_) {}
    }

    pollCompanion()
    const interval = setInterval(pollCompanion, 3500)
    return () => {
      isCancelled = true
      clearInterval(interval)
    }
  }, [attemptId, student?.id, handleCompanionStatusChange])

  // Window blur & tab visibility tracking for Candidate Integrity
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && activeStage === 3) {
        toast.error('⚠️ Assessment Integrity Alert: Window switching or minimizing is strictly monitored.', {
          id: 'tab-switch-alert',
          duration: 5000
        })
      }
    }
    const handleBlur = () => {
      if (activeStage === 3) {
        toast.error('⚠️ Window Focus Lost: Please keep your exam browser window focused.', {
          id: 'focus-lost-alert',
          duration: 4000
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
    }
  }, [activeStage])

  // Biometric states
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const [isFaceProcessing, setIsFaceProcessing] = useState(false)
  const [faceStatus, setFaceStatus] = useState('idle') // idle | verified | review | failed
  const [reviewElapsed, setReviewElapsed] = useState(0)
  const [vmRenderer, setVmRenderer] = useState('')

  const isHttpsSecure = typeof window !== 'undefined' ? (window.isSecureContext || window.location.protocol === 'https:') : false

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Real-time countdown timer for exam start
  useEffect(() => {
    if (timeToExamStart <= 0) return
    const timer = setInterval(() => {
      setTimeToExamStart(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeToExamStart])

  // Timer for review wait elapsed seconds
  useEffect(() => {
    if (faceStatus !== 'review') {
      setReviewElapsed(0)
      return
    }
    const timer = setInterval(() => {
      setReviewElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [faceStatus])

  useEffect(() => {
    return () => {
      stopCamera()
      if (reviewPollTimeoutRef.current) {
        clearTimeout(reviewPollTimeoutRef.current)
      }
    }
  }, [])

  // Initial load: uses readiness check (never starts the exam clock!)
  useEffect(() => {
    const loadExamAndStudent = async () => {
      try {
        const examRes = await api.get(`/student/exams/${examId}`)
        const examData = examRes.data.exam || examRes.data

        // Block re-entry if already submitted or finalized
        if (isAttemptFinished(examData)) {
          toast.error('You have already attended and submitted this examination. Re-entry is strictly prohibited.')
          navigate(`/student/results?examId=${examId}`)
          return
        }

        const serverTime = examRes.data?.serverTime ? new Date(examRes.data.serverTime) : new Date()
        const startTime = new Date(examData?.startTime || Date.now())
        const endTime = new Date(examData?.endTime || (Date.now() + 3600000))

        // Block if exam has already ended
        if ((examData?.endTime && serverTime > endTime) || ['ENDED', 'EVALUATED', 'RESULT_PUBLISHED'].includes(examData?.status)) {
          toast.error('This examination session has ended and is closed for entry.')
          navigate('/student/exams')
          return
        }

        // Pre-check gate: opens 30 minutes (1800 seconds) before start (T2.6 / Spread the herd)
        const earlyCheckWindowMs = 30 * 60 * 1000 // 30 minutes
        if (examData?.startTime && serverTime.getTime() < startTime.getTime() - earlyCheckWindowMs) {
          toast.error('Pre-exam security checkup unlocks 30 minutes before scheduled start time.')
          navigate(`/student/exams/${examId}/lobby`)
          return
        }

        const remainingSecs = Math.max(0, Math.floor((startTime.getTime() - serverTime.getTime()) / 1000))
        setTimeToExamStart(remainingSecs)

        setExam(examData)
        const userRes = await api.get('/auth/me')
        setStudent(userRes.data.user)

        // Initialize or retrieve readiness attempt (Separated from real attempt activation per T2)
        try {
          const readinessRes = await api.post(`/exams/${examId}/readiness`)
          const resolvedAttemptId = readinessRes?.data?.attempt?.id || readinessRes?.data?.attemptId || readinessRes?.data?.id
          if (resolvedAttemptId) {
            setAttemptId(resolvedAttemptId)
            // Query truthful VPN status
            try {
              const vpnRes = await api.get(`/attempts/${resolvedAttemptId}/vpn-status`)
              setVpnStatus(vpnRes.data)
            } catch (_) {}
          }
        } catch (readinessErr) {
          if (readinessErr.response?.status === 409 || readinessErr.response?.data?.error?.code === 'ATTEMPT_ALREADY_FINISHED') {
            toast.error('This attempt is already finalized and cannot be resumed.')
            navigate(`/student/results?examId=${examId}`)
            return
          }
          // precheck mode fallback
        }

        // Audit WebGL Renderer
        try {
          const canvas = document.createElement('canvas')
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
          let renderer = 'Standard GPU'
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
            if (debugInfo) {
              renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Standard GPU'
            }
          }
          setVmRenderer(renderer)
        } catch {
          setVmRenderer('Standard Display')
        }
      } catch (err) {
        toast.error('Failed to load exam details.')
        navigate('/student/exams')
      }
    }
    loadExamAndStudent()
  }, [examId, navigate])



  // 2. Camera Hardware Initialization
  const startCamera = async () => {
    if (streamRef.current) return
    updateStage('media', 'loading', 'Initializing high-definition webcam feed...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: Boolean(exam?.micRequired) 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn('Camera feed play:', e))
        }
      }
      updateStage('media', 'loading', 'Webcam feed active. Click "Authorize Screen Share" to continue.')
    } catch (err) {
      updateStage('media', 'fail', 'Webcam access denied. Please grant browser camera permissions.')
      toast.error('Webcam access is required for ProctorNet exams.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  // Cleanup media streams on component unmount if not entering exam
  useEffect(() => {
    return () => {
      const isEnteringExam = window.location.pathname.includes('/exam') || window.location.pathname.includes('/student/exam')
      if (!isEnteringExam) {
        stopCamera()
        clearSharedScreenStream()
      }
    }
  }, [])

  // Authorize Screen Share
  const requestScreenShare = async () => {
    updateStage('media', 'loading', 'Requesting screen sharing authorization...')
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', cursor: 'always' },
        audio: false
      })

      const track = screenStream.getVideoTracks()[0]
      if (!track) throw new Error('No screen video track found')

      setSharedScreenStream(screenStream)
      setScreenShared(true)

      track.addEventListener('ended', () => {
        setScreenShared(false)
        clearSharedScreenStream()
        updateStage('media', 'fail', 'Screen sharing disconnected by user.')
        toast.error('Screen sharing is required throughout the exam session.')
      })

      updateStage('media', 'pass', 'Webcam and Screen Share Streams Authorized cleanly')
      toast.success('Screen share stream active!')
      setActiveStage(2)
      runBiometricVerification()
    } catch (err) {
      updateStage('media', 'fail', 'Screen sharing authorization was declined or cancelled.')
      toast.error('You must share your entire screen to proceed with this exam.')
    }
  }

  // Capture canvas image as WebP Blob (FLW-03)
  const captureFrameBlob = () => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) return resolve(null)
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.90
      )
    })
  }

  // Client Quality Gate: Luminance (40-220), Laplacian sharpness (variance >= 15), Face size (>=20% frame)
  const evaluateFrameQuality = (canvas, detection) => {
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const imgData = ctx.getImageData(0, 0, width, height)
    const d = imgData.data

    // 1. Luminance Check
    let sumL = 0
    const totalPx = width * height
    for (let i = 0; i < d.length; i += 4) {
      sumL += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    }
    const avgLum = sumL / totalPx
    if (avgLum < 40) {
      return { ok: false, message: 'Lighting is too dark. Please ensure proper room illumination.' }
    }
    if (avgLum > 220) {
      return { ok: false, message: 'Lighting is too bright or washed out. Please reduce direct backlight.' }
    }

    // 2. Laplacian Sharpness (Downsampled grid variance)
    let lapSum = 0
    let lapSq = 0
    let count = 0
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4
        const c = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]
        const top = 0.299 * d[((y - 1) * width + x) * 4] + 0.587 * d[((y - 1) * width + x) * 4 + 1] + 0.114 * d[((y - 1) * width + x) * 4 + 2]
        const btm = 0.299 * d[((y + 1) * width + x) * 4] + 0.587 * d[((y + 1) * width + x) * 4 + 1] + 0.114 * d[((y + 1) * width + x) * 4 + 2]
        const l = 0.299 * d[(y * width + (x - 1)) * 4] + 0.587 * d[(y * width + (x - 1)) * 4 + 1] + 0.114 * d[(y * width + (x - 1)) * 4 + 2]
        const r = 0.299 * d[(y * width + (x + 1)) * 4] + 0.587 * d[(y * width + (x + 1)) * 4 + 1] + 0.114 * d[(y * width + (x + 1)) * 4 + 2]
        const val = top + btm + l + r - 4 * c
        lapSum += val
        lapSq += val * val
        count++
      }
    }
    const mean = lapSum / (count || 1)
    const variance = (lapSq / (count || 1)) - (mean * mean)
    if (variance < 15) {
      return { ok: false, message: 'Camera image is too blurry. Please focus the lens and hold still.' }
    }

    // 3. Face Height Check (>= 20% of frame)
    if (detection?.box) {
      const faceHeightRatio = detection.box.height / height
      if (faceHeightRatio < 0.20) {
        return { ok: false, message: 'Face is too far from camera. Please position closer to the screen.' }
      }
    }

    return { ok: true }
  }

  // Handle Review Decision transition (from Socket or Poll)
  const handleReviewDecision = useCallback((decision, reason) => {
    if (decision === 'PASS') {
      if (reviewPollTimeoutRef.current) clearTimeout(reviewPollTimeoutRef.current)
      setFaceStatus('verified')
      updateStage('face', 'pass', 'Identity verified successfully by invigilator')
      toast.success('Identity verified by invigilator!')
      setActiveStage(3)
      updateStage('lock', 'loading', 'Ready for full-screen assessment lock activation')
    } else if (decision === 'FAIL') {
      if (reviewPollTimeoutRef.current) clearTimeout(reviewPollTimeoutRef.current)
      setFaceStatus('failed')
      updateStage('face', 'fail', reason || 'Identity verification declined by invigilator')
      toast.error(reason || 'Identity verification declined by invigilator')
    }
  }, [])

  // Start polling for invigilator decision during review
  const startReviewPolling = useCallback((activeAttemptId) => {
    if (!activeAttemptId) return
    let delay = 3000
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await api.get(`/attempts/${activeAttemptId}/identity-status`)
        const decision = res.data?.decision || (res.data?.verified ? 'PASS' : null)
        if (decision === 'PASS' || decision === 'FAIL') {
          handleReviewDecision(decision, res.data?.reason)
          return
        }
      } catch (_) {}

      if (!cancelled) {
        delay = Math.min(10000, Math.round(delay * 1.5))
        reviewPollTimeoutRef.current = setTimeout(poll, delay)
      }
    }

    reviewPollTimeoutRef.current = setTimeout(poll, delay)
    return () => {
      cancelled = true
      if (reviewPollTimeoutRef.current) clearTimeout(reviewPollTimeoutRef.current)
    }
  }, [handleReviewDecision])

  // 3. Stage 2: Candidate Biometric Verification (FLW-03: Presigned frame upload & quality gate)
  const runBiometricVerification = async () => {
    if (reviewPollTimeoutRef.current) clearTimeout(reviewPollTimeoutRef.current)
    setActiveStage(2)
    updateStage('face', 'loading', 'Initializing biometric face detection...')
    setIsFaceProcessing(true)

    try {
      if (!faceModelsLoaded) {
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
          setFaceModelsLoaded(true)
        } catch (mErr) {
          console.warn('Local /models loading failed:', mErr)
        }
      }

      updateStage('face', 'loading', 'Position your face inside the camera guide frame...')

      let attempts = 0
      const maxAttempts = 6

      const interval = setInterval(async () => {
        attempts++

        const video = videoRef.current
        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          if (attempts >= maxAttempts) {
            clearInterval(interval)
            updateStage('face', 'fail', 'Webcam feed dropped or unavailable. Please restart camera.')
            setIsFaceProcessing(false)
          }
          return
        }

        let detection = null
        try {
          if (faceModelsLoaded && faceapi.nets.tinyFaceDetector.params) {
            detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
          }
        } catch (_) {}

        if (detection || !faceModelsLoaded) {
          clearInterval(interval)

          // 1. Capture WebP Blob
          const blob = await captureFrameBlob()
          if (!blob) {
            updateStage('face', 'fail', 'Failed to capture frame from webcam.')
            setIsFaceProcessing(false)
            return
          }

          // 2. Client Quality Gate
          const quality = evaluateFrameQuality(canvasRef.current, detection)
          if (!quality.ok) {
            updateStage('face', 'fail', quality.message)
            setIsFaceProcessing(false)
            toast.error(quality.message)
            return
          }

          let verified = false
          let pendingReview = false
          let decision = 'FAIL'
          let serviceMessage

          try {
            // FLW-03: Server-issued presigned upload ticket
            const presignRes = await api.post('/media/presign-upload', {
              purpose: 'LIVE_FRAME',
              attemptId,
              contentType: blob.type || 'image/jpeg',
              bytes: blob.size
            })

            const { putUrl, postUrl, fields, key } = presignRes.data

            // Upload directly to S3 / MinIO with fallback resilience
            let uploadSuccess = false
            let uploadErr = null

            if (putUrl) {
              try {
                const uploadRes = await fetch(putUrl, {
                  method: 'PUT',
                  body: blob,
                  headers: { 'Content-Type': blob.type || 'image/jpeg' }
                })
                if (uploadRes.ok) {
                  uploadSuccess = true
                } else {
                  uploadErr = new Error(`Presigned PUT responded ${uploadRes.status}`)
                }
              } catch (pErr) {
                uploadErr = pErr
              }
            }

            if (!uploadSuccess && postUrl) {
              try {
                const fd = new FormData()
                if (fields) {
                  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
                }
                fd.append('file', blob)
                const uploadRes = await fetch(postUrl, { method: 'POST', body: fd })
                if (uploadRes.ok) {
                  uploadSuccess = true
                  uploadErr = null
                } else {
                  uploadErr = new Error(`Presigned POST responded ${uploadRes.status}`)
                }
              } catch (postErr) {
                uploadErr = postErr
              }
            }

            if (!uploadSuccess && uploadErr) {
              throw uploadErr
            }

            // Verify identity using server-issued key
            let verifyRes
            try {
              verifyRes = await api.post(`/attempts/${attemptId}/verify-identity`, {
                liveFrameKey: key
              })
            } catch (_) {
              verifyRes = await api.post(`/student/exams/${examId}/verify-face`, {
                liveFrameKey: key,
                attemptId
              })
            }

            verified = Boolean(verifyRes.data?.verified)
            pendingReview = Boolean(verifyRes.data?.pendingReview)
            decision = verifyRes.data?.decision || (verified ? 'PASS' : 'FAIL')
            serviceMessage = verifyRes.data?.message || ''
          } catch (apiErr) {
            console.warn('Biometric backend verification notice:', apiErr.message)
            serviceMessage = apiErr.response?.data?.message || apiErr.message || ''
          }

          setIsFaceProcessing(false)
          if (verified || decision === 'PASS') {
            setFaceStatus('verified')
            updateStage('face', 'pass', 'Identity verified successfully')
            toast.success('Identity verified successfully!')
            setActiveStage(3)
            updateStage('lock', 'loading', 'Ready for full-screen assessment lock activation')
          } else if (pendingReview || decision === 'REVIEW') {
            setFaceStatus('review')
            updateStage('face', 'loading', 'Waiting for invigilator verification')
            toast('Identity verification is under review. Waiting for invigilator.')

            // Connect socket & listen on attempt room
            try {
              const socket = connectSocket()
              if (socket && attemptId) {
                socket.emit('attempt:join', { attemptId })
                socket.on('identity:decision', (data) => {
                  if (data?.attemptId === attemptId) {
                    handleReviewDecision(data.decision, data.reason)
                  }
                })
              }
            } catch (_) {}

            // Start polling with exponential backoff (3s -> 10s)
            startReviewPolling(attemptId)
          } else {
            setFaceStatus('failed')
            const displayMsg = serviceMessage || "We couldn't confirm your identity — retry or call the invigilator."
            updateStage('face', 'fail', displayMsg)
            toast.error(displayMsg)
          }
        } else {
          if (attempts >= maxAttempts) {
            clearInterval(interval)
            updateStage('face', 'fail', 'No human face detected in frame. Please face the camera directly and retry.')
            setIsFaceProcessing(false)
            toast.error('No face detected. Please reposition and retry.')
          } else {
            updateStage('face', 'loading', `Searching for face in frame... (Attempt ${attempts}/${maxAttempts})`)
          }
        }
      }, 1500)

    } catch (err) {
      updateStage('face', 'fail', 'Face verification error: ' + (err.response?.data?.message || err.message || 'Service unavailable.'))
      setIsFaceProcessing(false)
      toast.error('Face verification failed. Please try again.')
    }
  }

  // Call Invigilator assistance action
  const handleAskInvigilator = async () => {
    try {
      await api.post('/student/support/ticket', {
        examId,
        subject: 'Biometric verification under review',
        message: `Candidate ${student?.name || 'Student'} (${student?.usn || student?.id}) requests review approval for exam session.`
      }).catch(() => null)
      toast.success('Invigilator notified. They will review your stream momentarily.')
    } catch (_) {
      toast.success('Invigilator notified.')
    }
  }

  // 4. Stage 3: Lock Fullscreen & Start Exam (Activates attempt and starts clock)
  const handleLockAndStartExam = async () => {
    if (hasProhibitedApps) {
      toast.error(`Please close prohibited applications (${bannedAppNames}) before entering exam.`)
      return
    }

    if (!stage0Passed) {
      toast.error('Exam Device Companion must be active and healthy (or waived) to proceed.')
      setActiveStage(0)
      return
    }

    // Real tunnel verification queries real backend vpn-status
    if (exam?.vpnRequired && vpnStatus && !vpnStatus.vpnVerified) {
      toast.error('Secure network tunnel verification failed. Please ensure the network guard is active.')
      setActiveStage(0)
      return
    }

    // Attempt fullscreen immediately to preserve user activation gesture
    try {
      const el = document.documentElement
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen
      if (rfs && !document.fullscreenElement) {
        await rfs.call(el)
      }
      setIsFullscreen(true)
      updateStage('lock', 'pass', 'Full-screen assessment lock active')
    } catch (fsErr) {
      console.warn('requestFullscreen before attempt call:', fsErr.message)
    }

    if (exam?.endTime && new Date() > new Date(exam.endTime)) {
      toast.error('This examination has ended and is closed for entry.')
      navigate('/student/exams')
      return
    }

    try {
      // Real attempt activation starts the exam clock
      await api.post(`/exams/${examId}/attempt`)
      updateStage('lock', 'pass', 'Entering proctored examination interface...')
      if (timeToExamStart > 0) {
        toast.success(`Security check passed! Holding in secure exam mode until exam starts (${formatCountdown(timeToExamStart)}).`)
      } else {
        toast.success('Security check complete! Entering exam...')
      }

      // Stop webcam tracks — camera is strictly for entry verification; exam uses screen share only
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()) } catch (_) {}
        streamRef.current = null
      }

      setTimeout(() => {
        navigate(`/student/exams/${examId}/exam`)
      }, 400)
    } catch (err) {
      const errCode = err.response?.data?.code || err.response?.data?.error
      const errMsg = err.response?.data?.message || err.message
      if (errCode === 'AGENT_REQUIRED') {
        updateStage('system', 'fail', 'Device Companion required to start exam.')
        toast.error('Start the Device Companion and enter the code shown on Step 1.')
        setActiveStage(0)
      } else if (err.response?.status === 409 || errCode === 'ATTEMPT_ALREADY_FINISHED' || errMsg?.includes('already finalized')) {
        toast.error('This attempt is already finalized and cannot be resumed.')
        navigate(`/student/results?examId=${examId}`)
        return
      } else if (errCode === 'EXAM_NOT_OPEN') {
        toast.error("This exam hasn't opened yet.")
      } else if (errCode === 'IDENTITY_REQUIRED' || errCode === 'IDENTITY_REVIEW') {
        updateStage('face', 'fail', 'Identity verification required before entering.')
        toast.error('Identity verification required before entering exam.')
        setActiveStage(2)
      } else if (errCode === 'ROOM_FULL') {
        toast.error('Exam room is currently full. Please try again shortly or contact your invigilator.')
      } else if (errCode === 'SESSION_EXPIRED') {
        toast.error('Your session has expired. Please log in again.')
        navigate('/login')
      } else {
        updateStage('lock', 'fail', errMsg || 'Failed to start exam session.')
        toast.error(errMsg || 'Failed to start exam.')
      }
    }
  }

  const companionFindings = companionDetails?.findings || []
  const hasProhibitedApps = companionFindings.length > 0 || (companionDetails?.state === 'DEGRADED' && companionFindings.length > 0)
  const bannedAppNames = companionFindings.map(f => f.ruleName || f.evidence || f.ruleId).filter(Boolean).join(', ')

  const stage0Passed = Boolean(
    companionDetails &&
    (
      companionDetails.state === 'HEALTHY' ||
      companionDetails.state === 'CONNECTED' ||
      companionDetails.waiver ||
      companionDetails.gatePassed ||
      companionDetails.state === 'OPTIONAL' ||
      companionDetails.policy === 'OFF' ||
      companionDetails.policy === 'OPTIONAL' ||
      exam?.deviceAgentPolicy === 'OFF' ||
      exam?.deviceAgentPolicy === 'OPTIONAL'
    ) &&
    (!companionDetails.findings || companionDetails.findings.length === 0)
  )
  const allPassed = stage0Passed && stageStatus.media === 'pass' && stageStatus.face === 'pass'

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans selection:bg-primary selection:text-white relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-5xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Left Sidebar: 4 Automated Security Stages */}
        <div className="w-full md:w-80 bg-background border-r border-border p-6 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="ProctorNet Logo" className="w-10 h-10 object-contain rounded-xl shadow-xs" />
              <div>
                <h1 className="font-bold text-sm text-foreground tracking-tight">PROCTORNET SECURE</h1>
                <p className="text-[10px] text-primary font-mono font-semibold uppercase tracking-wider">Candidate Verification</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-medium mb-4">Mandatory Pre-Exam Security Pipeline</p>

            <div className="space-y-2">
              {STAGES.map((stage, idx) => {
                const status = stageStatus[stage.id]
                const isActive = activeStage === idx

                return (
                  <button 
                    key={stage.id} 
                    type="button"
                    onClick={() => setActiveStage(idx)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? 'bg-primary/10 border-primary/40 text-foreground shadow-lg shadow-indigo-500/5 font-semibold' 
                        : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {status === 'pass' && <CheckCircle2 size={18} className="text-emerald-500" />}
                      {status === 'fail' && <XCircle size={18} className="text-rose-500" />}
                      {status === 'loading' && <Loader2 size={18} className="text-primary animate-spin" />}
                      {status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border border-border flex items-center justify-center text-[9px] font-mono font-bold text-muted-foreground">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${isActive ? 'text-primary' : 'text-foreground/90'}`}>
                        {stage.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 font-mono">{stage.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border text-center">
            <p className="text-[11px] text-muted-foreground font-mono">
              Candidate: <span className="text-foreground font-semibold">{student?.name || 'Verified User'}</span> ({student?.usn || 'USN'})
            </p>
          </div>
        </div>

        {/* Right Content Area: Interactive Workstation */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between min-h-[540px] bg-card">
          {/* View A: Post-Check Waiting Lobby */}
          {allPassed && timeToExamStart > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 bg-card animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-md">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="px-3.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  ALL 4 SECURITY STAGES 100% VERIFIED
                </span>
                <h2 className="text-2xl font-bold text-foreground mt-2.5">{exam?.title}</h2>
                <p className="text-xs text-muted-foreground mt-1 font-normal max-w-lg mx-auto">
                  Your Device Companion, webcam, screen share, and biometric identity are fully cleared. Please remain in place until the exam session opens.
                </p>
              </div>

              {/* Countdown Holding Card */}
              <div className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-inner space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                  <Clock size={13} className="text-primary animate-pulse" /> Official Exam Begins In
                </p>
                <div className="font-mono text-4xl font-bold tracking-tight text-primary">
                  {formatCountdown(timeToExamStart)}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Scheduled Start: {exam?.startTime ? new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live Soon'}
                </p>
              </div>

              {/* Active Monitoring Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-xl text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-foreground/90 font-medium">Device Companion: Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isHttpsSecure && isSocketConnected ? 'bg-emerald-500' : isHttpsSecure ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="truncate text-foreground/90 font-medium">Network: {isHttpsSecure && isSocketConnected ? 'Connected (Secure)' : isHttpsSecure ? 'HTTPS Secure' : 'HTTP Local'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-foreground/90 font-medium">Screen: Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-foreground/90 font-medium">Face: Verified</span>
                </div>
              </div>
            </div>
          ) : (
            /* View B: Standard Step-by-Step Security Workstation */
            <div>
              {/* Exam & Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 mb-6 gap-2">
                <div>
                  <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Stage {activeStage + 1} of 4
                  </span>
                  <h2 className="text-xl font-bold text-foreground mt-0.5">{STAGES[activeStage].name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {timeToExamStart > 0 && (
                    <Badge variant="outline" className="font-mono text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                      <Clock size={12} className="mr-1 inline" /> Starts in {formatCountdown(timeToExamStart)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/10 w-fit">
                    Exam: {exam?.title || 'Verification'}
                  </Badge>
                </div>
              </div>

              {/* Alert Banner for Prohibited Apps (Visible whenever prohibited software is detected) */}
              {hasProhibitedApps && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-500 flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertOctagon size={24} className="shrink-0 text-rose-500 mt-0.5 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        Prohibited Software Detected
                      </h4>
                      <Badge variant="destructive" className="font-mono text-[10px] uppercase">
                        Exam Entry Blocked
                      </Badge>
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      The integrity monitor detected prohibited applications running on your machine:
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {companionFindings.map((f, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                          <XCircle size={12} className="text-rose-500" />
                          {f.ruleName || f.evidence || f.ruleId || 'Prohibited Process'}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                      Please close these applications completely. This screen will update automatically once closed.
                    </p>
                  </div>
                </div>
              )}

              {/* STAGE 0: Exam Device Companion Audit */}
              {activeStage === 0 ? (
                <div className="space-y-4 mb-6">
                  <DeviceCompanionPanel
                    attemptId={attemptId}
                    isPrecheck={!attemptId}
                    onStatusChange={handleCompanionStatusChange}
                  />
                </div>
              ) : (
                /* STAGES 1, 2, 3: Workstation Layout */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mb-6">
                  {/* Left Column: Video Feed (Stages 1 & 2) OR Full-screen Lock & Terms (Stage 3) */}
                  {activeStage === 3 ? (
                    <div className="space-y-4 flex flex-col justify-between">
                      {/* Viewport Lock Card */}
                      <Card className={`p-4 border transition-all duration-300 ${
                        isFullscreen
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-primary/5 border-primary/30'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isFullscreen ? 'bg-emerald-500/20 text-emerald-500' : 'bg-primary/20 text-primary'
                          }`}>
                            <Lock size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                                {isFullscreen ? 'Full-Screen Lock Active' : 'Full-Screen Lock Required'}
                              </h3>
                              <Badge variant={isFullscreen ? 'default' : 'secondary'} className={`text-[10px] font-mono ${isFullscreen ? 'bg-emerald-500 text-white' : ''}`}>
                                {isFullscreen ? 'LOCKED' : 'READY TO ACTIVATE'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {isFullscreen
                                ? 'Your browser viewport is locked in full-screen assessment mode. Window switching or minimizing will trigger proctoring security flags.'
                                : 'The examination environment requires exclusive full-screen mode to prevent unauthorized window switching and background access.'}
                            </p>
                            {!isFullscreen && (
                              <Button
                                onClick={handleRequestFullscreen}
                                className="mt-3.5 w-full text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-white h-9 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Lock size={13} /> Enter Full Screen Mode
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* Candidate Integrity Agreement */}
                      <Card className="bg-background border-border p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Shield size={16} className="text-primary" />
                            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                              Candidate Integrity Agreement
                            </h4>
                          </div>
                          <ul className="space-y-2 text-xs text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>I will remain in exclusive full-screen mode until my exam is submitted.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>No AI assistants (ChatGPT), messaging, or screen sharing tools are permitted.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>Continuous screen share and companion integrity monitoring remain enforced.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="terms-agree"
                            checked={termsAgreed}
                            onChange={(e) => setTermsAgreed(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                          />
                          <label htmlFor="terms-agree" className="text-[11px] font-mono text-foreground cursor-pointer select-none">
                            I understand and agree to the ProctorNet assessment rules.
                          </label>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl bg-black border border-border/80 overflow-hidden aspect-[4/3] sm:aspect-video flex items-center justify-center shadow-lg group">
                      {/* Video Feed for Stages 1 & 2 */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Biometric Target Reticle & Precision Corner Brackets */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {/* Precision Corner Brackets */}
                        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-primary/60 rounded-tl-sm" />
                        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-primary/60 rounded-tr-sm" />
                        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-primary/60 rounded-bl-sm" />
                        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-primary/60 rounded-br-sm" />

                        {/* Ergonomic Biometric Head Reticle */}
                        <div className={`relative w-40 h-52 sm:w-48 sm:h-60 rounded-[50%] border-2 transition-all duration-300 flex items-center justify-center ${
                          stageStatus.face === 'pass'
                            ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                            : isFaceProcessing
                            ? 'border-primary shadow-[0_0_25px_rgba(99,102,241,0.35)] animate-pulse'
                            : stageStatus.face === 'fail'
                            ? 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                            : 'border-primary/50'
                        }`}>
                          {/* Live Laser Scanline during processing */}
                          {isFaceProcessing && (
                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                          )}

                          {/* Center Reticle Crosshairs */}
                          <div className="w-2.5 h-0.5 bg-primary/40 absolute top-1/2 left-2 -translate-y-1/2" />
                          <div className="w-2.5 h-0.5 bg-primary/40 absolute top-1/2 right-2 -translate-y-1/2" />
                          <div className="h-2.5 w-0.5 bg-primary/40 absolute left-1/2 top-2 -translate-x-1/2" />
                          <div className="h-2.5 w-0.5 bg-primary/40 absolute left-1/2 bottom-2 -translate-x-1/2" />
                        </div>

                        {/* Top Status HUD Pill */}
                        <div className="absolute top-3 inset-x-0 flex justify-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wide flex items-center gap-1.5 shadow-md ${
                            stageStatus.face === 'pass'
                              ? 'bg-emerald-500/95 text-white'
                              : isFaceProcessing
                              ? 'bg-primary/95 text-white animate-pulse'
                              : stageStatus.face === 'fail'
                              ? 'bg-rose-600/95 text-white'
                              : 'bg-black/70 text-white/90 backdrop-blur-xs border border-white/10'
                          }`}>
                            {stageStatus.face === 'pass' ? (
                              <><Check size={11} /> Biometric Identity Verified</>
                            ) : isFaceProcessing ? (
                              <><Loader2 size={11} className="animate-spin" /> Matching Live Stream...</>
                            ) : stageStatus.face === 'fail' ? (
                              <><AlertTriangle size={11} /> Verification Incomplete — Retry Below</>
                            ) : (
                              <><Camera size={11} /> Align Face Inside Guide</>
                            )}
                          </span>
                        </div>
                      </div>

                      {isFaceProcessing && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                          <Loader2 size={32} className="text-primary animate-spin mb-2" />
                          <p className="text-xs font-mono text-white font-semibold">Verifying Biometric Stream...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diagnostics Log Card */}
                  <div className="space-y-4">
                    <Card className="bg-background border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Readiness Check</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">LIVE STATUS</Badge>
                      </div>

                      <div className="p-3 bg-card border border-border rounded-xl text-xs font-mono text-foreground/90">
                        <p className="text-primary font-semibold mb-1">Current Status:</p>
                        <p className="text-foreground">{stageDetails[STAGES[activeStage].id]}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Companion:</span>
                          <p className={`font-semibold mt-0.5 truncate ${
                            hasProhibitedApps
                              ? 'text-rose-500 font-bold'
                              : (companionDetails?.state === 'HEALTHY' || companionDetails?.waiver ? 'text-emerald-500 font-bold' : 'text-foreground/90')
                          }`} title={hasProhibitedApps ? bannedAppNames : ''}>
                            {hasProhibitedApps
                              ? 'DEGRADED'
                              : companionDetails?.waiver
                              ? 'Waived'
                              : companionDetails?.state || 'Not Paired'}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Network:</span>
                          <p className={`font-semibold mt-0.5 ${isHttpsSecure ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {isHttpsSecure && isSocketConnected ? 'Connected (Secure)' : isHttpsSecure ? 'HTTPS Secure' : 'HTTP Local'}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Screen Share:</span>
                          <p className={`font-semibold mt-0.5 ${screenShared ? 'text-emerald-500' : 'text-foreground/90'}`}>
                            {screenShared ? 'Active' : 'Pending'}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Full-Screen Mode:</span>
                          <p className={`font-semibold mt-0.5 ${isFullscreen ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}`}>
                            {isFullscreen ? 'Locked & Enforced' : 'Standard'}
                          </p>
                        </div>
                      </div>

                      {faceStatus !== 'idle' && (
                        <div className={`p-3 rounded-xl text-xs font-mono border ${
                          faceStatus === 'verified'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : faceStatus === 'review'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          <div className="flex justify-between items-center mb-1">
                            <span>Identity Status:</span>
                            <strong className="text-xs uppercase">
                              {faceStatus === 'verified' ? 'Verified' : faceStatus === 'review' ? 'Waiting for Invigilator' : 'Verification Required'}
                            </strong>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {faceStatus === 'verified'
                              ? 'Your live biometric match is confirmed.'
                              : faceStatus === 'review'
                              ? `Waiting for invigilator verification before exam entrance (${formatCountdown(reviewElapsed)} elapsed).`
                              : "We couldn't confirm your identity — retry or call the invigilator."}
                          </p>
                          {faceStatus === 'review' && (
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleAskInvigilator}
                                className="text-[10px] font-mono h-7 px-2.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                              >
                                <PhoneCall size={12} className="mr-1" /> Ask Invigilator
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={runBiometricVerification}
                                className="text-[10px] font-mono h-7 px-2.5"
                              >
                                <RefreshCw size={12} className="mr-1" /> Retry
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Bar Footer */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Shield size={14} className="text-primary" />
              <span>Device Readiness & Secure Exam Mode Enforced</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {activeStage > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => setActiveStage(prev => Math.max(0, prev - 1))}
                  className="w-full sm:w-auto text-xs font-mono font-medium px-4 h-10 rounded-xl cursor-pointer border-border hover:bg-muted/50"
                >
                  ← Back
                </Button>
              )}

              {activeStage === 0 && stage0Passed && (
                <Button 
                  onClick={() => setActiveStage(1)}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md"
                >
                  Continue to Media Feeds →
                </Button>
              )}

              {!streamRef.current && activeStage === 1 && (
                <Button 
                  onClick={startCamera}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary text-white px-6 h-10 rounded-xl cursor-pointer"
                >
                  <Camera size={14} className="mr-2" /> Start Camera
                </Button>
              )}

              {streamRef.current && !screenShared && activeStage === 1 && (
                <Button 
                  onClick={requestScreenShare}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary text-white px-6 h-10 rounded-xl cursor-pointer"
                >
                  <Monitor size={14} className="mr-2" /> Authorize Screen Share
                </Button>
              )}

              {activeStage === 1 && stageStatus.media === 'pass' && (
                <Button 
                  onClick={() => {
                    setActiveStage(2)
                    runBiometricVerification()
                  }}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md"
                >
                  Continue to Biometrics →
                </Button>
              )}

              {stageStatus.face === 'fail' && activeStage === 2 && (
                <Button
                  onClick={runBiometricVerification}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white px-6 h-10 rounded-xl shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  <RefreshCw size={14} className="mr-2" /> Retry Biometric Verification
                </Button>
              )}

              {activeStage === 2 && stageStatus.face === 'pass' && (
                <Button 
                  onClick={() => setActiveStage(3)}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md"
                >
                  Continue to Terms & Lock →
                </Button>
              )}

              {/* Stage 3 (Step 4) Explicit Controls */}
              {activeStage === 3 && (
                <>
                  {!isFullscreen && (
                    <Button
                      onClick={handleRequestFullscreen}
                      variant="outline"
                      className="w-full sm:w-auto text-xs font-mono font-bold border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 px-4 h-10 rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock size={14} /> Enter Full Screen
                    </Button>
                  )}

                  {hasProhibitedApps ? (
                    <Button
                      disabled
                      className="w-full sm:w-auto text-xs font-mono font-bold bg-rose-600/80 text-white px-6 h-10 rounded-xl cursor-not-allowed flex items-center gap-2 shadow-sm opacity-90"
                      title={`Please close prohibited applications (${bannedAppNames}) before entering exam`}
                    >
                      <AlertTriangle size={14} className="animate-pulse" /> Close Prohibited Apps to Enter Exam
                    </Button>
                  ) : !stage0Passed ? (
                    <Button
                      onClick={() => setActiveStage(0)}
                      className="w-full sm:w-auto text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <Cpu size={14} /> Pair Companion on Step 1 →
                    </Button>
                  ) : stageStatus.media !== 'pass' ? (
                    <Button
                      onClick={() => setActiveStage(1)}
                      className="w-full sm:w-auto text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <Camera size={14} /> Authorize Media Feeds on Step 2 →
                    </Button>
                  ) : stageStatus.face !== 'pass' ? (
                    <Button
                      onClick={() => setActiveStage(2)}
                      className="w-full sm:w-auto text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white px-6 h-10 rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <Shield size={14} /> Complete Biometrics on Step 3 →
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLockAndStartExam}
                      disabled={!termsAgreed}
                      className="w-full sm:w-auto text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-8 h-10 rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {timeToExamStart > 0 ? (
                        <>
                          <Lock size={14} /> Enter Secure Full-Screen Mode ({formatCountdown(timeToExamStart)}) →
                        </>
                      ) : (
                        <>
                          <Play size={14} className="fill-current" /> Enter Exam Environment (Live Now) →
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
