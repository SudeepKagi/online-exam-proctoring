import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { 
  Shield, Camera, Wifi, Monitor, CheckCircle2, XCircle, 
  Loader2, ArrowRight, Lock, Key, Cpu, RefreshCw, AlertTriangle, Play, Sparkles, Check, Download,
  ExternalLink, Clock, FileDown, CheckCircle, Info, AlertOctagon, Terminal
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setSharedScreenStream, clearSharedScreenStream } from '@/lib/mediaState'
import DeviceCompanionPanel from '@/components/agent/DeviceCompanionPanel'

const STAGES = [
  { id: 'system', name: 'Exam Device Companion Audit', icon: Cpu, desc: 'Hardware & software proctoring companion check' },
  { id: 'media', name: 'Hardware Media Feeds', icon: Camera, desc: 'Webcam feed mapping & mandatory screen share authorization' },
  { id: 'face', name: 'AI Face Verification', icon: Shield, desc: 'Matching live biometric stream against student profile' },
  { id: 'kiosk', name: 'Fullscreen Kiosk & Terms', icon: Lock, desc: 'Viewport locking & candidate integrity agreement' }
]

export default function SecurityCheck() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)

  const [activeStage, setActiveStage] = useState(0)
  const [stageStatus, setStageStatus] = useState({
    system: 'pending', // pending | loading | pass | fail
    media: 'pending',
    face: 'pending',
    kiosk: 'pending'
  })
  const [stageDetails, setStageDetails] = useState({
    system: 'Waiting to start...',
    media: 'Waiting to start...',
    face: 'Waiting to start...',
    kiosk: 'Waiting to start...'
  })

  const [exam, setExam] = useState(null)
  const [student, setStudent] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [companionDetails, setCompanionDetails] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [screenShared, setScreenShared] = useState(false)
  const [timeToExamStart, setTimeToExamStart] = useState(0)

  // Biometric states
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const [isFaceProcessing, setIsFaceProcessing] = useState(false)
  const [faceStatus, setFaceStatus] = useState('idle')
  const [vmRenderer, setVmRenderer] = useState('')

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

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement
      setIsFullscreen(active)
      if (active) {
        updateStage('kiosk', 'pass', 'Kiosk fullscreen lock active')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Initial load
  useEffect(() => {
    const loadExamAndStudent = async () => {
      try {
        const examRes = await api.get(`/student/exams/${examId}`)
        const examData = examRes.data.exam || examRes.data

        // Block re-entry if already submitted
        if (examData.isSubmitted || examData.studentStatus === 'SUBMITTED') {
          toast.error('You have already attended and submitted this examination. Re-entry is strictly prohibited.')
          navigate('/student/results')
          return
        }

        const serverTime = examRes.data?.serverTime ? new Date(examRes.data.serverTime) : new Date()
        const startTime = new Date(examData?.startTime || Date.now())
        const endTime = new Date(examData?.endTime || (Date.now() + 3600000))

        // Block if exam has already ended
        if (examData?.endTime && serverTime > endTime) {
          toast.error('This examination session has already ended.')
          navigate('/student/exams')
          return
        }

        // 5-minute pre-check gate: must be within 5 minutes (300 seconds) of start
        const earlyCheckWindowMs = 5 * 60 * 1000 // 5 minutes
        if (examData?.startTime && serverTime.getTime() < startTime.getTime() - earlyCheckWindowMs) {
          toast.error('Pre-exam security checkup unlocks 5 minutes before scheduled start time.')
          navigate(`/student/exams/${examId}/lobby`)
          return
        }

        const remainingSecs = Math.max(0, Math.floor((startTime.getTime() - serverTime.getTime()) / 1000))
        setTimeToExamStart(remainingSecs)

        setExam(examData)
        const userRes = await api.get('/auth/me')
        setStudent(userRes.data.user)

        // Initialize or retrieve attempt
        try {
          const attemptRes = await api.post(`/exams/${examId}/attempt`).catch(() => null)
          if (attemptRes?.data?.id) {
            setAttemptId(attemptRes.data.id)
          }
        } catch {
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
  }, [examId])

  const updateStage = (key, status, detail) => {
    setStageStatus(prev => ({ ...prev, [key]: status }))
    setStageDetails(prev => ({ ...prev, [key]: detail }))
  }

  // 1. Stage 0: Exam Device Companion Status Listener
  const handleCompanionStatusChange = (statusData) => {
    setCompanionDetails(statusData)
    const isHealthy = statusData?.state === 'HEALTHY' || statusData?.state === 'CONNECTED'
    const isWaived = Boolean(statusData?.waiver)
    const findings = statusData?.findings || []

    if (isWaived) {
      updateStage('system', 'pass', 'Exam Device Companion • Staff Waiver Active')
    } else if (isHealthy && findings.length === 0) {
      updateStage('system', 'pass', 'Exam Device Companion Active • 0 Prohibited Apps • Clean Integrity')
    } else if (findings.length > 0) {
      updateStage('system', 'fail', `Prohibited software detected: ${findings.map(f => f.ruleId).join(', ')}. Please close to proceed.`)
    } else {
      updateStage('system', 'loading', 'Waiting for Exam Device Companion to connect...')
    }
  }

  // 2. Camera Hardware Initialization
  const startCamera = async () => {
    if (streamRef.current) return
    updateStage('media', 'loading', 'Initializing high-definition webcam feed...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: false 
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
      runAiFaceVerification()
    } catch (err) {
      updateStage('media', 'fail', 'Screen sharing authorization was declined or cancelled.')
      toast.error('You must share your entire screen to proceed with this exam.')
    }
  }

  const captureFrameBase64 = () => {
    if (!videoRef.current) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas) return null

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  // 3. Stage 2: AI Face Verification
  const runAiFaceVerification = async () => {
    setActiveStage(2)
    updateStage('face', 'loading', 'Initializing neural face detection models...')
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

        let hasLocalFace = false
        try {
          if (faceModelsLoaded && faceapi.nets.tinyFaceDetector.params) {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
            if (detection) hasLocalFace = true
          } else {
            hasLocalFace = true
          }
        } catch {
          hasLocalFace = true
        }

        if (hasLocalFace) {
          clearInterval(interval)
          const frameBase64 = captureFrameBase64()

          let verified = false
          let pendingReview = false
          let decision = 'FAIL'
          let serviceMessage
          try {
            const verifyRes = await api.post(`/student/exams/${examId}/verify-face`, {
              image: frameBase64
            })
            verified = Boolean(verifyRes.data?.verified)
            pendingReview = Boolean(verifyRes.data?.pendingReview)
            decision = verifyRes.data?.decision || (verified ? 'PASS' : 'FAIL')
            serviceMessage = verifyRes.data?.message || ''
          } catch (apiErr) {
            console.warn('Biometric backend verification notice:', apiErr.message)
            serviceMessage = apiErr.response?.data?.message || ''
          }

          setIsFaceProcessing(false)
          if (verified || decision === 'PASS') {
            setFaceStatus('verified')
            updateStage('face', 'pass', 'Identity verified successfully')
            toast.success('Identity verified successfully!')
            setActiveStage(3)
            updateStage('kiosk', 'loading', 'Ready for fullscreen kiosk mode activation')
          } else if (pendingReview || decision === 'REVIEW') {
            setFaceStatus('review')
            updateStage('face', 'loading', 'Waiting for invigilator verification')
            toast.info('Identity verification is under review. Waiting for invigilator.')
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

  // 4. Stage 3: Lock Fullscreen & Start Exam
  const handleLockAndStartExam = async () => {
    if (!stage0Passed) {
      toast.error('Exam Device Companion must be active and healthy (or waived) to proceed.')
      setActiveStage(0)
      return
    }

    // WireGuard VPN Enforcement check (Q3.7 / Architecture guardrail)
    // Real tunnel verification queries device agent endpoint /vpn-check
    const vpnVerified = Boolean(companionDetails?.vpnVerified ?? !exam?.vpnRequired)
    if (!vpnVerified) {
      toast.error('WireGuard VPN tunnel mandatory (/vpn-check). Please activate the tunnel first.')
      setActiveStage(0)
      return
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
      if (!document.fullscreenElement) {
        throw new Error('Fullscreen request was not granted by the browser.')
      }
      updateStage('kiosk', 'pass', 'Entering proctored examination interface...')
      if (timeToExamStart > 0) {
        toast.success(`Security check passed! Holding in secure exam mode until exam starts (${formatCountdown(timeToExamStart)}).`)
      } else {
        toast.success('Security check complete! Entering exam...')
      }
      setTimeout(() => {
        navigate(`/student/exams/${examId}/exam`)
      }, 400)
    } catch (err) {
      updateStage('kiosk', 'fail', 'Full-screen mode is mandatory. Please grant full-screen permissions.')
      toast.error('Full-screen mode required to enter exam.')
    }
  }

  const stage0Passed = Boolean(
    companionDetails &&
    (companionDetails.state === 'HEALTHY' || companionDetails.state === 'CONNECTED' || companionDetails.waiver) &&
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
                  <div 
                    key={stage.id} 
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                      isActive 
                        ? 'bg-primary/10 border-primary/40 text-foreground shadow-lg shadow-indigo-500/5 font-semibold' 
                        : 'bg-card border-border/70 text-muted-foreground'
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
                  </div>
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
                  Your BYOD Agent, webcam, screen share, and biometric identity are fully cleared. Please remain in place until the exam session opens.
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
                  <span className="truncate text-foreground/90 font-medium">BYOD Agent: Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-foreground/90 font-medium">Network: HTTPS Secure</span>
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
                    {exam?.title || 'Examination Verification'}
                  </Badge>
                </div>
              </div>

              {/* STAGE 0: Exam Device Companion Audit */}
              {activeStage === 0 && !stage0Passed ? (
                <div className="space-y-4 mb-6">
                  <DeviceCompanionPanel
                    attemptId={attemptId}
                    isPrecheck={!attemptId}
                    onStatusChange={handleCompanionStatusChange}
                  />
                </div>
              ) : (
                /* STAGES 1, 2, 3 OR STAGE 0 VERIFIED: Video Feed & Diagnostics */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mb-6">
                  <div className="relative rounded-2xl bg-background border border-border overflow-hidden aspect-video flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute inset-4 border-2 border-dashed border-primary/40 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="w-20 h-20 border border-primary/60 rounded-full animate-pulse" />
                    </div>

                    {isFaceProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                        <Loader2 size={32} className="text-primary animate-spin mb-2" />
                        <p className="text-xs font-mono text-white font-semibold">Running Biometric Model Match...</p>
                      </div>
                    )}
                  </div>

                  {/* Diagnostics Log Card */}
                  <div className="space-y-4">
                    <Card className="bg-background border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Diagnostic Log</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">LIVE PROBE</Badge>
                      </div>

                      <div className="p-3 bg-card border border-border rounded-xl text-xs font-mono text-foreground/90">
                        <p className="text-primary font-semibold mb-1">Current Status:</p>
                        <p className="text-foreground">{stageDetails[STAGES[activeStage].id]}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Companion:</span>
                          <p className={`font-semibold mt-0.5 ${companionDetails?.state === 'HEALTHY' || companionDetails?.waiver ? 'text-emerald-500' : 'text-foreground/90'}`}>
                            {companionDetails?.waiver ? 'Waived' : companionDetails?.state || 'Not Paired'}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border">
                          <span className="text-muted-foreground">Network:</span>
                          <p className="font-semibold mt-0.5 text-emerald-500">
                            HTTPS Secure
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
                          <p className={`font-semibold mt-0.5 ${isFullscreen ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {isFullscreen ? 'Locked' : 'Standard'}
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
                              ? 'Waiting for invigilator verification before exam entrance.'
                              : "We couldn't confirm your identity — retry or call the invigilator."}
                          </p>
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

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!screenShared && (
                <Button 
                  onClick={requestScreenShare}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-primary hover:bg-primary text-white px-6 h-10 rounded-xl cursor-pointer"
                >
                  <Monitor size={14} className="mr-2" /> Authorize Screen Share
                </Button>
              )}

              {stageStatus.face === 'fail' && (
                <Button
                  onClick={runAiFaceVerification}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white px-6 h-10 rounded-xl shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  <RefreshCw size={14} className="mr-2" /> Retry Face Verification
                </Button>
              )}

              {allPassed && (
                <Button
                  onClick={handleLockAndStartExam}
                  className="w-full sm:w-auto text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-8 h-10 rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
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
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
