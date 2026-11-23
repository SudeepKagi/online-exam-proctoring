import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/apiClient'
import { verifySebSession, isSebBrowser } from '@/lib/sebClient'
import { useCamera } from '@/hooks/useCamera'
import cameraStore from '@/lib/cameraStore'
import {
  evaluateClockSkew,
  evaluateLatency,
  evaluateOperatingSystem,
  detectOsFamily,
  detectBrowserFamily
} from '@/lib/systemCheck'
import { mapStudentError, getSupportUrl } from '@/lib/studentErrors'
import {
  Camera,
  Wifi,
  Laptop,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  AlertCircle,
  RotateCcw,
  Download
} from 'lucide-react'

export default function StudentExamStartPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [isSebActive, setIsSebActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [globalError, setGlobalError] = useState(null)

  // Step 1: Photo Verification State
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [verifyingPhoto, setVerifyingPhoto] = useState(false)
  const [identityVerified, setIdentityVerified] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [failedTries, setFailedTries] = useState(0)
  const [serviceErrors, setServiceErrors] = useState(0)
  const [awaitingApproval, setAwaitingApproval] = useState(false)

  // Step 2 & 3: Internet & Computer States
  const [internetState, setInternetState] = useState({ status: 'checking', latencyMs: 0, rating: '', message: 'Measuring connection...' })
  const [clockState, setClockState] = useState({ status: 'checking', warning: false, message: 'Checking system clock...' })
  const [computerState, setComputerState] = useState({ status: 'checking', compatible: true, message: 'Checking computer compatibility...' })

  // SEB Launch & Live Token State
  const [launchingSeb, setLaunchingSeb] = useState(false)
  const [sebLaunchData, setSebLaunchData] = useState(null)
  const [sebLiveState, setSebLiveState] = useState('IDLE') // 'IDLE' | 'OPENING' | 'WAITING' | 'OPEN' | 'EXPIRED'
  const [launchError, setLaunchError] = useState(null)
  const [sebCountdown, setSebCountdown] = useState(300)
  const [showSebHelp, setShowSebHelp] = useState(false)
  const sebTimerRef = useRef(null)
  const sebHelpTimerRef = useRef(null)
  const sebPollRef = useRef(null)

  const {
    status: cameraStatus,
    devices,
    selectedDeviceId,
    selectDevice,
    requestCamera,
    retryCamera,
    attachVideoRef,
    videoRef
  } = useCamera()

  const supportUrl = getSupportUrl()
  const sebDownloadUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEB_DOWNLOAD_URL) || 'https://safeexambrowser.org/download_en.html'

  // 1. Initial Data Fetch: Exam, Config/ServerTime, and SEB status
  const loadExamAndConfig = useCallback(async () => {
    try {
      const pingStart = performance.now()
      const [examRes, configRes, sebRes, clientSebCheck] = await Promise.all([
        apiClient.get(`/exams/${id}`).catch((err) => { throw err }),
        apiClient.get('/config').catch(() => ({ data: { serverTime: new Date().toISOString() } })),
        apiClient.get(`/attempts/exams/${id}/seb-status`).catch(() => ({ data: { required: false, verified: false, mode: 'off' } })),
        verifySebSession(apiClient).catch(() => ({ verified: false }))
      ])

      const pingDuration = performance.now() - pingStart
      const ex = examRes.data?.exam || examRes.data
      setExam(ex)

      // Internet Latency Check
      const latencyEval = evaluateLatency(pingDuration)
      setInternetState({
        status: latencyEval.passed ? 'ready' : 'warning',
        latencyMs: latencyEval.latencyMs,
        rating: latencyEval.rating,
        message: latencyEval.message
      })

      // Server Clock Skew Check
      const serverTimeStr = configRes.data?.serverTime || new Date().toISOString()
      const serverEpoch = new Date(serverTimeStr).getTime()
      const clientEpoch = Date.now()
      const offset = serverEpoch - clientEpoch
      setServerTimeOffset(offset)

      const clockEval = evaluateClockSkew(clientEpoch, serverEpoch)
      setClockState({
        status: 'ready',
        warning: clockEval.warning,
        message: clockEval.message
      })

      // SEB Status & Verification Check
      const rawSeb = sebRes.data || { required: false, verified: false, mode: 'off' }
      const sebActive = Boolean(rawSeb.verified || clientSebCheck?.verified || isSebBrowser())
      setIsSebActive(sebActive)

      const seb = { ...rawSeb, verified: sebActive }
      setSebStatus(seb)

      // If exam does not require webcam/camera proctoring or attempt was already face-verified, reflect it
      const requiresCamera = Boolean(ex?.proctoringConfig?.cameraRequired ?? ex?.proctoringConfig?.webcam ?? false)
      if (!requiresCamera || rawSeb.faceVerified) {
        setIdentityVerified(true)
      }

      // Computer Compatibility Check
      const osEval = evaluateOperatingSystem(seb.required)
      setComputerState({
        status: osEval.compatible ? 'ready' : 'incompatible',
        compatible: osEval.compatible,
        message: osEval.message,
        supportContact: osEval.supportContact
      })

      setLoading(false)
    } catch (err) {
      setGlobalError(mapStudentError(err))
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadExamAndConfig()
  }, [loadExamAndConfig])

  // 2. Camera lifecycle: only request camera if in normal browser and not yet verified
  useEffect(() => {
    if (!loading && !globalError && !isSebActive && !identityVerified && !capturedPhoto) {
      requestCamera().catch(() => { })
    }
  }, [loading, globalError, isSebActive, identityVerified, capturedPhoto, requestCamera])

  // 3. Keep current time counting every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 4. Polling when awaiting manual invigilator approval
  useEffect(() => {
    if (!awaitingApproval) return
    let active = true
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/attempts/exams/${id}/seb-status`)
        if (res.data?.faceVerified || res.data?.invigilatorApproved) {
          clearInterval(interval)
          if (active) {
            setIdentityVerified(true)
            setAwaitingApproval(false)
            setPhotoError(null)
          }
        }
      } catch (_) { }
    }, 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [awaitingApproval, id])

  // Calculate synchronized server time and countdown
  const serverNow = currentTime + serverTimeOffset
  const examStartMs = exam?.startTime ? new Date(exam.startTime).getTime() : 0
  const examEndMs = exam?.endTime ? new Date(exam.endTime).getTime() : Infinity

  const isExamNotOpen = examStartMs > 0 && serverNow < examStartMs
  const isExamEnded = examEndMs > 0 && serverNow > examEndMs
  const msUntilStart = Math.max(0, examStartMs - serverNow)

  const formatCountdown = (ms) => {
    const totalSec = Math.ceil(ms / 1000)
    const hours = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Still photo capture with immediate track release
  const handleCapturePhoto = async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      setPhotoError('Please wait for the camera preview to initialize.')
      return
    }

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Lighting brightness check
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data
        let sum = 0
        for (let i = 0; i < d.length; i += 4) {
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3
        }
        const avg = sum / (canvas.width * canvas.height)
        if (avg < 30) {
          setPhotoError('Lighting is too dark. Please ensure your face is well-lit and retake.')
          return
        }
        if (avg > 245) {
          setPhotoError('Lighting is overexposed or too bright. Please reduce glare and retake.')
          return
        }
      } catch (_) { }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedPhoto(dataUrl)
      setPhotoError(null)

      // STOP TRACKS IMMEDIATELY (camera light turns off)
      if (video.srcObject && video.srcObject.getTracks) {
        video.srcObject.getTracks().forEach((track) => track.stop())
        video.srcObject = null
      }
      cameraStore.releaseCamera('precheck')

      // Trigger server-side face verification
      await verifyCapturedPhoto(dataUrl)
    } catch (_) {
      setPhotoError('Failed to capture photo from webcam. Please try again.')
    }
  }

  const verifyCapturedPhoto = async (dataUrl) => {
    setVerifyingPhoto(true)
    setPhotoError(null)
    try {
      const res = await apiClient.post('/media/verify-face', {
        imageBase64: dataUrl,
        examId: id
      })
      const data = res.data || {}
      if (data.verified || data.status === 'MATCH') {
        setIdentityVerified(true)
        setAwaitingApproval(false)
        setPhotoError(null)
      } else if (data.status === 'NO_REFERENCE') {
        setIdentityVerified(false)
        setAwaitingApproval(true)
        setPhotoError('No institutional reference photo on file. Your photo has been submitted to your invigilator for manual approval.')
      } else if (data.status === 'SERVICE_ERROR') {
        setIdentityVerified(false)
        const nextErrors = serviceErrors + 1
        setServiceErrors(nextErrors)
        if (nextErrors >= 2) {
          setAwaitingApproval(true)
          setPhotoError('Face verification service unavailable after multiple attempts. Submitted to your invigilator for approval.')
        } else {
          setPhotoError('Face verification service temporarily unavailable. Please click retake to try again.')
        }
      } else {
        setIdentityVerified(false)
        const nextFails = failedTries + 1
        setFailedTries(nextFails)
        if (nextFails >= 3) {
          setAwaitingApproval(true)
          setPhotoError('Ask your invigilator to verify you. Your photo has been submitted to the live console.')
        } else {
          const reason = data.reason || (
            data.status === 'NO_MATCH' ? 'Face did not match institutional reference photo. Please retake.' :
              data.status === 'NO_FACE' ? 'No face detected in the photo. Please ensure face is centered and clearly visible.' :
                data.status === 'MULTIPLE_FACES' ? 'Multiple faces detected. Please ensure only you are visible.' :
                  data.status === 'LOW_QUALITY' ? 'Photo quality is too low or blurry. Please retake in good lighting.' :
                    'Identity verification failed. Please retake your photograph.'
          )
          setPhotoError(reason)
        }
      }
    } catch (_) {
      setIdentityVerified(false)
      const nextErrors = serviceErrors + 1
      setServiceErrors(nextErrors)
      if (nextErrors >= 2) {
        setAwaitingApproval(true)
        setPhotoError('Verification service unavailable after multiple attempts. Submitted to invigilator for approval.')
      } else {
        setPhotoError('Verification service temporarily unavailable. Please retry.')
      }
    } finally {
      setVerifyingPhoto(false)
    }
  }

  const handleRetakePhoto = () => {
    setCapturedPhoto(null)
    setIdentityVerified(false)
    setPhotoError(null)
    setAwaitingApproval(false)
    requestCamera().catch(() => { })
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (sebTimerRef.current) clearInterval(sebTimerRef.current)
      if (sebHelpTimerRef.current) clearTimeout(sebHelpTimerRef.current)
      if (sebPollRef.current) clearInterval(sebPollRef.current)
    }
  }, [])

  const triggerProtocolLaunch = (url) => {
    if (url) {
      window.location.href = url
    }
  }

  // Launch Safe Exam Browser handler
  const handleLaunchSeb = async () => {
    setLaunchingSeb(true)
    setLaunchError(null)
    setShowSebHelp(false)
    setSebLiveState('OPENING')
    try {
      const res = await apiClient.post('/seb/launch-link', { examId: id })
      const launchUrl = res.data?.url
      const token = res.data?.exchangeToken || res.data?.launchToken || res.data?.token
      if (!launchUrl) throw new Error('No launch link returned by server')

      setSebLaunchData({ url: launchUrl, token })
      setSebCountdown(300)
      setSebLiveState('WAITING')

      triggerProtocolLaunch(launchUrl)

      if (sebTimerRef.current) clearInterval(sebTimerRef.current)
      sebTimerRef.current = setInterval(() => {
        setSebCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(sebTimerRef.current)
            setSebLiveState('EXPIRED')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      if (sebHelpTimerRef.current) clearTimeout(sebHelpTimerRef.current)
      sebHelpTimerRef.current = setTimeout(() => {
        setShowSebHelp(true)
      }, 5000)

      if (sebPollRef.current) clearInterval(sebPollRef.current)
      if (token) {
        sebPollRef.current = setInterval(async () => {
          try {
            const statusRes = await apiClient.get(`/seb/token-status/${token}`)
            if (statusRes.data?.consumed || statusRes.data?.status === 'CONSUMED') {
              setSebLiveState('OPEN')
              if (sebPollRef.current) clearInterval(sebPollRef.current)
              if (sebTimerRef.current) clearInterval(sebTimerRef.current)
            } else if (statusRes.data?.status === 'EXPIRED') {
              setSebLiveState('EXPIRED')
              if (sebPollRef.current) clearInterval(sebPollRef.current)
            }
          } catch (_) {}
        }, 2000)
      }
    } catch (err) {
      setLaunchError(mapStudentError(err)?.message || 'Failed to generate secure browser launch link.')
      setSebLiveState('IDLE')
    } finally {
      setLaunchingSeb(false)
    }
  }

  // Start Exam directly (for standard browsers or when inside verified SEB)
  const handleStartExam = async () => {
    if (starting) return
    setStarting(true)
    try {
      // Telemetry report
      await apiClient.post(`/exams/${id}/readiness`, {
        osFamily: detectOsFamily(),
        browserFamily: detectBrowserFamily(),
        cameraOk: identityVerified,
        latencyBucket: (internetState.rating || 'good').toLowerCase(),
        sebVerified: Boolean(isSebActive)
      }).catch(() => { })

      await apiClient.post(`/attempts/exams/${id}/start`, {}).catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 404) throw err
        return apiClient.post(`/attempts/${id}/start`, {})
      })

      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => { })
      }

      navigate(`/student/exams/${id}/arena`)
    } catch (err) {
      setGlobalError(mapStudentError(err))
    } finally {
      setStarting(false)
    }
  }

  const isCameraBlocked = cameraStatus === 'denied' || cameraStatus === 'no_device' || cameraStatus === 'in_use' || cameraStatus === 'lost'

  if (loading) {
    return (
      <ExamArenaShell className="items-center justify-center p-4">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-[#5266eb] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#554e7b] font-[420]">Checking system and exam schedule...</p>
        </div>
      </ExamArenaShell>
    )
  }

  if (globalError) {
    return (
      <ExamArenaShell className="items-center justify-center p-4">
        <Card className="w-full max-w-lg border-0 bg-white shadow-[0_4px_20px_rgba(40,37,59,0.04)] rounded-[20px] font-sans p-6 text-center space-y-4" data-testid="seb-error-resilience-card">
          <div className="w-12 h-12 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-[480] text-[#28253b]">{globalError.title}</CardTitle>
            <CardDescription className="text-xs font-[360] text-[#554e7b] leading-relaxed mt-1">
              {globalError.message}
            </CardDescription>
            {globalError.referenceId && (
              <p className="text-[11px] text-[#70707d] font-mono mt-1" data-testid="error-reference-id">
                Ref: #{globalError.referenceId}
              </p>
            )}
          </div>

          {/* Fallback actions: never a dead end */}
          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/login?manual=1')}
              className="w-full"
              data-testid="error-signin-password-fallback"
            >
              Sign in with password instead
            </Button>
            <div className="flex items-center justify-between px-1 text-xs pt-1">
              <Link
                to="/seb/diagnostics"
                className="inline-flex items-center gap-1 text-[#5266eb] hover:underline font-[420]"
                data-testid="error-diagnostics-link"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Diagnostics & system check
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/student/dashboard')}
                className="text-xs text-[#554e7b] hover:text-[#28253b] p-0 h-auto font-[420]"
              >
                Return to Dashboard
              </Button>
            </div>
            <a
              href={supportUrl}
              className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#70707d] hover:text-[#5266eb] pt-2 font-[360]"
            >
              Contact technical support
            </a>
          </div>
        </Card>
      </ExamArenaShell>
    )
  }

  // =========================================================================
  // VIEW A: INSIDE SAFE EXAM BROWSER (Secure Browser Mode)
  // =========================================================================
  if (isSebActive) {
    return (
      <ExamArenaShell className="items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg"
        >
          <Card className="w-full border-0 bg-white shadow-xs rounded-[16px] font-sans overflow-hidden">
          <CardHeader className="text-center pb-3 pt-6 bg-[#fbfbff] border-b border-[#edecfb]">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <ShieldCheck className="w-5 h-5 text-[#5266eb]" />
              <Badge variant="outline" className="border-0 bg-[#edecfb] text-[#5266eb] text-xs font-[420]">
                Safe Exam Browser Active
              </Badge>
            </div>
            <CardTitle className="text-lg font-[480] text-[#28253b]">
              {exam?.title || 'Examination Ready'}
            </CardTitle>
            <CardDescription className="text-xs font-[360] text-[#554e7b]">
              {exam?.courseCode ? `${exam.courseCode} • Duration: ${exam.durationMinutes} minutes` : 'Session verified by institutional configuration'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            {!identityVerified ? (
              <div className="p-4 bg-[#fbfbff] rounded-[14px] text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-[#5266eb] mx-auto" />
                <h4 className="text-xs font-[480] text-[#28253b]">Photo Check Required in Normal Browser</h4>
                <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed">
                  Your identity photograph must be verified in Chrome or Edge before beginning in Safe Exam Browser.
                  Please quit Safe Exam Browser, complete the photo verification on this exam page in your regular browser, and click "Open exam in secure browser".
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => { window.location.href = '/seb/done' }}
                    className="w-full"
                  >
                    Quit Safe Exam Browser
                  </Button>
                </div>
              </div>
            ) : isExamEnded ? (
              <div className="p-4 bg-[#fbfbff] rounded-[14px] text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-[#5266eb] mx-auto" />
                <p className="text-xs text-[#28253b] font-[420]">This examination window closed at {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
                <Button
                  variant="primary"
                  onClick={() => { window.location.href = '/seb/done' }}
                  className="w-full mt-2"
                >
                  Quit Safe Exam Browser
                </Button>
              </div>
            ) : isExamNotOpen ? (
              <div className="p-4 bg-[#fbfbff] rounded-[14px] text-center space-y-3">
                <p className="text-xs text-[#28253b] font-[420]">Exam opens at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <Button
                  disabled
                  variant="secondary"
                  className="w-full opacity-80"
                >
                  Starts in {formatCountdown(msUntilStart)}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-[#fbfbff] rounded-[12px] text-xs text-[#554e7b] font-[360] leading-relaxed">
                  Your identity has been verified and your Safe Exam Browser session is locked to institutional parameters. Click below to enter the exam arena.
                </div>
                {/* Single Primary Action Button */}
                <Button
                  onClick={handleStartExam}
                  disabled={starting}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  {starting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Entering arena...
                    </>
                  ) : (
                    <>
                      Start exam <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </ExamArenaShell>
  )
}

  // =========================================================================
  // VIEW B: IN NORMAL BROWSER (Chrome, Edge, etc.)
  // 1 Photo -> 2 Internet -> 3 Computer -> Exactly ONE primary button
  // =========================================================================
  const isSebRequired = Boolean(sebStatus?.required)
  const canProceed = identityVerified && !isExamNotOpen && !isExamEnded

  return (
    <ExamArenaShell className="items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl"
      >
        <Card className="w-full border-0 bg-white shadow-xs rounded-[16px] font-sans overflow-hidden">
        {/* Header */}
        <CardHeader className="text-center pb-3 pt-6 bg-[#fbfbff] border-b border-[#edecfb]">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <ShieldCheck className="w-5 h-5 text-[#5266eb]" />
            <Badge variant="outline" className="border-0 bg-[#edecfb] text-[#5266eb] text-xs font-[420]">
              System Readiness Check
            </Badge>
          </div>
          <CardTitle className="text-lg font-[480] text-[#28253b]">
            {exam?.title || 'Exam Readiness Check'}
          </CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            {exam?.courseCode ? `${exam.courseCode} • Duration: ${exam.durationMinutes} minutes` : 'Complete photo verification and system checks before beginning'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Checklist: 1. Photo, 2. Internet, 3. Computer */}
          <div className="space-y-3" role="region" aria-label="Readiness Checklist">

            {/* ITEM 1: Photo Verification (One still photo, camera turned off after capture) */}
            <div className="p-3.5 bg-[#fbfbff] rounded-[14px] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-[480] text-[#28253b]">
                  <Camera className="w-4 h-4 text-[#5266eb]" />
                  <span>1. Photo Verification</span>
                </div>
                {identityVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#5266eb]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                ) : verifyingPhoto ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[420] text-[#554e7b]">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#5266eb]" /> Verifying...
                  </span>
                ) : awaitingApproval ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#8a6a26]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pending approval
                  </span>
                ) : capturedPhoto ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#c04b4b]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Needs retake
                  </span>
                ) : (
                  <span className="text-[11px] text-[#554e7b] font-[420]">Photo required</span>
                )}
              </div>

              {/* State A: Photo is verified */}
              {identityVerified ? (
                <div className="flex items-center gap-3 pt-1">
                  {capturedPhoto && (
                    <img
                      src={capturedPhoto}
                      alt="Verified identity portrait"
                      className="w-16 h-12 object-cover rounded-[8px] border border-[#edecfb]"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-[#28253b] font-[420] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Identity verified
                    </p>
                    <p className="text-[10px] text-[#554e7b] font-[360] mt-0.5">
                      Camera released and turned off. Zero video streaming during assessment.
                    </p>
                  </div>
                  <span className="text-[10px] bg-[#edecfb] text-[#5266eb] px-2.5 py-1 rounded-[40px] font-[420]">
                    Camera off
                  </span>
                </div>
              ) : capturedPhoto ? (
                /* State B: Photo captured, either verifying or error */
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start gap-3">
                    <img
                      src={capturedPhoto}
                      alt="Captured portrait"
                      className="w-20 h-16 object-cover rounded-[8px] border border-[#edecfb]"
                    />
                    <div className="flex-1 space-y-1">
                      {verifyingPhoto ? (
                        <p className="text-xs text-[#5266eb] font-[420] flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Matching against reference photo...
                        </p>
                      ) : photoError ? (
                        <div className="space-y-1">
                          <p className="text-xs text-[#c04b4b] font-[480] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Verification notice
                          </p>
                          <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed">
                            {photoError}
                          </p>
                        </div>
                      ) : null}
                      <p className="text-[10px] text-[#554e7b] font-[360]">
                        Camera is turned off.
                      </p>
                    </div>
                  </div>
                  {/* Secondary Retake Button (translucent capsule pill) */}
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRetakePhoto}
                      disabled={verifyingPhoto}
                      className="inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3 text-[#5266eb]" /> Retake photo
                    </Button>
                  </div>
                </div>
              ) : (
                /* State C: Live preview for capturing still photo */
                <div className="space-y-2 pt-1">
                  {isCameraBlocked ? (
                    <div className="p-3 bg-white rounded-[10px] space-y-2 text-left">
                      <p className="text-xs font-[480] text-[#c04b4b] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Camera access needed
                      </p>
                      <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed">
                        Please click the camera/lock icon in your address bar, set Camera to <strong>Allow</strong>, and ensure no other application (Zoom, Teams) is using your webcam.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={retryCamera}
                      >
                        Try camera again
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-full aspect-video max-h-48 bg-[#28253b] rounded-[10px] overflow-hidden relative mx-auto flex items-center justify-center">
                        <video ref={attachVideoRef} data-testid="camera-preview-video" autoPlay playsInline muted className="w-full h-full object-cover" />
                        {/* Oval face guide */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-36 h-44 rounded-full border-2 border-dashed border-white/70 shadow-sm flex items-center justify-center">
                            <span className="text-[9px] text-white/90 bg-black/40 px-2 py-0.5 rounded-full font-[360]">
                              Align face here
                            </span>
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 inset-x-2 pointer-events-none text-center">
                          <span className="inline-block text-[10px] text-white bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-full font-[360]">
                            Single still photo • Camera turns off right after capture
                          </span>
                        </div>
                      </div>

                      {/* Device selector if multiple */}
                      {devices.length > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-0.5">
                          <span className="text-[11px] font-[420] text-[#554e7b]">Camera:</span>
                          <select
                            value={selectedDeviceId || ''}
                            onChange={(e) => selectDevice(e.target.value)}
                            className="text-xs bg-white text-[#28253b] font-[420] rounded-[8px] px-2 py-1 outline-none cursor-pointer border-0"
                          >
                            {devices.map((d, idx) => (
                              <option key={d.deviceId || idx} value={d.deviceId}>
                                {d.label || `Camera ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Capture Photo Button (Secondary translucent capsule) */}
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCapturePhoto}
                          disabled={cameraStatus !== 'live'}
                          className="w-full flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-[#5266eb]" /> Capture Photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ITEM 2: Internet Connection */}
            <div className="p-3 bg-[#fbfbff] rounded-[14px] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-[480] text-[#28253b]">
                <Wifi className="w-4 h-4 text-[#5266eb]" />
                <span>2. Internet Connection</span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#5266eb]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {internetState.rating || 'Verified'}
                </span>
                <p className="text-[10px] text-[#554e7b] font-[360]">{internetState.message}</p>
              </div>
            </div>

            {/* ITEM 3: Computer & Operating System */}
            <div className="p-3 bg-[#fbfbff] rounded-[14px] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-[480] text-[#28253b]">
                <Laptop className="w-4 h-4 text-[#5266eb]" />
                <span>3. Computer & Operating System</span>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 text-[11px] font-[480] ${computerState.compatible ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                  {computerState.compatible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {computerState.compatible ? 'Compatible' : 'Incompatible'}
                </span>
                <p className="text-[10px] text-[#554e7b] font-[360]">{computerState.message}</p>
              </div>
            </div>

          </div>

          {/* Exam Schedule Banners */}
          {isExamEnded ? (
            <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs font-[420] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#5266eb] shrink-0" />
              <span>This exam window closed at {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
            </div>
          ) : isExamNotOpen ? (
            <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs font-[420] flex items-center justify-between" aria-live="polite">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#5266eb] shrink-0" />
                <span>Exam opens at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <span className="font-mono font-[480] text-[#5266eb] bg-white px-2.5 py-0.5 rounded-full text-[11px]">
                Starts in {formatCountdown(msUntilStart)}
              </span>
            </div>
          ) : null}

          {/* SEB Live Launch Status Panel */}
          {sebLaunchData && (
            <div className="p-5 bg-[#ffffff] rounded-[16px] text-xs text-[#28253b] space-y-4 shadow-[0_4px_20px_rgba(40,37,59,0.04)] font-sans" data-testid="seb-launch-active-panel">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-[480] text-[#28253b] text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#5266eb]" /> Safe Exam Browser Handoff
                  </h4>
                  <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">
                    Connecting your verified exam session into Safe Exam Browser.
                  </p>
                </div>
                {sebLiveState === 'WAITING' && (
                  <div className="text-right">
                    <span className="font-mono text-xs font-[480] text-[#5266eb] bg-[#edecfb] px-2.5 py-1 rounded-full">
                      {formatCountdown(sebCountdown * 1000)} remaining
                    </span>
                  </div>
                )}
              </div>

              {/* State 1: OPENING */}
              {sebLiveState === 'OPENING' && (
                <div className="p-4 bg-[#fbfbff] rounded-[12px] flex items-center gap-3 text-[#28253b]">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#5266eb] shrink-0" />
                  <div>
                    <p className="font-[480] text-xs">Opening the secure browser…</p>
                    <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">Preparing one-click configuration handoff.</p>
                  </div>
                </div>
              )}

              {/* State 2: WAITING FOR SECURE BROWSER */}
              {sebLiveState === 'WAITING' && (
                <div className="p-4 bg-[#fbfbff] rounded-[12px] space-y-3">
                  <div className="flex items-center gap-3 text-[#28253b]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#5266eb] border-t-transparent animate-spin shrink-0" />
                    <div>
                      <p className="font-[480] text-xs">Waiting for the secure browser…</p>
                      <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">
                        If prompted by your browser, click <strong>Open Safe Exam Browser</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => triggerProtocolLaunch(sebLaunchData.url)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <span>Relaunch Safe Exam Browser</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* State 3: EXAM OPEN IN SECURE BROWSER */}
              {sebLiveState === 'OPEN' && (
                <div className="p-4 bg-[#edecfb] rounded-[12px] space-y-2 border-l-2 border-[#5266eb]" data-testid="seb-open-confirmation">
                  <div className="flex items-center gap-2 text-[#5266eb] font-[480]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Your exam is open in the secure browser, you can close this tab.</span>
                  </div>
                  <p className="text-[11px] text-[#554e7b] font-[360] pl-6">
                    Your authenticated session is active inside Safe Exam Browser. Good luck with your examination!
                  </p>
                </div>
              )}

              {/* State 4: EXPIRED */}
              {sebLiveState === 'EXPIRED' && (
                <div className="p-4 bg-[#fbfbff] rounded-[12px] space-y-2">
                  <p className="text-xs text-[#c04b4b] font-[480]">Launch link has expired.</p>
                  <p className="text-[11px] text-[#554e7b] font-[360]">Please generate a new launch link to proceed.</p>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleLaunchSeb}
                    disabled={launchingSeb}
                    className="w-full"
                  >
                    Generate New Launch Link
                  </Button>
                </div>
              )}

              {/* Help & Relaunch / Download Banner */}
              {showSebHelp && sebLiveState === 'WAITING' && (
                <div className="p-3.5 bg-[#edecfb]/60 rounded-[10px] space-y-2 border-l-2 border-[#5266eb]">
                  <p className="text-[11px] text-[#28253b] font-[420] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#5266eb] shrink-0" /> Safe Exam Browser not opening?
                  </p>
                  <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed">
                    Make sure Safe Exam Browser 3.x is installed on your computer. If it didn&apos;t launch automatically, click Relaunch or download the installer below.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <a
                      href={sebDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#5266eb] hover:underline font-[480] inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download Safe Exam Browser
                    </a>
                    <span className="text-[#c3c3cc]">•</span>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => triggerProtocolLaunch(sebLaunchData.url)}
                      className="text-[11px] text-[#5266eb] hover:underline font-[480] cursor-pointer bg-transparent border-0 inline-flex items-center gap-1 h-auto p-0"
                    >
                      <RefreshCw className="w-3 h-3" /> Relaunch SEB
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {launchError && (
            <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs font-[420] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#5266eb] shrink-0" />
              <span>{launchError}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* EXACTLY ONE SOLID PRIMARY ACTION BUTTON PER SPEC (§Phase 2) */}
          {/* ================================================================= */}
          <div className="pt-2 space-y-2">
            {isExamEnded ? (
              <Button
                variant="primary"
                onClick={() => navigate('/student/dashboard')}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            ) : isExamNotOpen ? (
              <Button
                disabled
                variant="secondary"
                className="w-full opacity-80"
              >
                Starts in {formatCountdown(msUntilStart)}
              </Button>
            ) : (isSebRequired && !isSebActive) ? (
              /* SEB Exam: Action button */
              !sebLaunchData ? (
                <div className="space-y-1">
                  <Button
                    variant="primary"
                    onClick={handleLaunchSeb}
                    disabled={!identityVerified || launchingSeb}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {launchingSeb ? 'Preparing Secure Browser...' : 'Open exam in secure browser'}
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  {!identityVerified && (
                    <p className="text-[10px] text-[#554e7b] text-center font-[360]">
                      Complete photo verification in Step 1 to unlock secure browser launch.
                    </p>
                  )}
                  <div className="text-center pt-1">
                    <Link
                      to="/student/secure-browser"
                      className="text-[11px] text-[#5266eb] hover:underline inline-flex items-center gap-1 font-[420]"
                    >
                      <span>Trouble opening SEB? Open Setup & Diagnostics</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : null
            ) : (
              /* Non-SEB Exam: Exactly ONE Primary Button: "Continue to exam" */
              <div className="space-y-1">
                <Button
                  variant="primary"
                  onClick={handleStartExam}
                  disabled={!canProceed || starting}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  {starting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Entering arena...
                    </>
                  ) : (
                    <>
                      Continue to exam <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
                {!identityVerified && (
                  <p className="text-[10px] text-[#554e7b] text-center font-[360]">
                    Complete photo verification in Step 1 to continue to your exam.
                  </p>
                )}
              </div>
            )}

            {/* Persistent Need Help Link */}
            <div className="text-center pt-2">
              <a
                href={supportUrl}
                className="inline-flex items-center gap-1.5 text-xs text-[#554e7b] hover:text-[#5266eb] transition-colors font-[420]"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Need help? Contact technical support
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </ExamArenaShell>
  )
}
