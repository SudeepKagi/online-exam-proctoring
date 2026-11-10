import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/apiClient'
import { setCameraStream } from '@/lib/screenStreamStore'
import { useCamera } from '@/hooks/useCamera'
import {
  evaluateClockSkew,
  evaluateLatency,
  evaluateOperatingSystem,
  saveReadinessResult,
  detectOsFamily,
  detectBrowserFamily
} from '@/lib/systemCheck'
import { mapStudentError, getSupportUrl } from '@/lib/studentErrors'
import {
  Camera,
  Wifi,
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  AlertCircle
} from 'lucide-react'

export default function StudentExamStartPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [globalError, setGlobalError] = useState(null)

  // System checklist states
  const {
    status: cameraStatus,
    error: cameraErrorMsg,
    requestCamera,
    retryCamera,
    attachVideoRef
  } = useCamera()

  const cameraState = {
    status: cameraStatus === 'live' ? 'ready' : (cameraStatus === 'requesting' || cameraStatus === 'idle') ? 'checking' : 'failed',
    message: cameraStatus === 'live'
      ? 'Camera ready and preview active'
      : cameraStatus === 'denied'
        ? 'Camera access was blocked. Please click the camera icon in your address bar and select "Always allow".'
        : cameraStatus === 'in_use'
          ? 'Unable to access webcam. Check if another program (Zoom, Teams) is using it.'
          : (cameraErrorMsg || 'Requesting camera permissions...')
  }
  const [internetState, setInternetState] = useState({ status: 'checking', latencyMs: 0, rating: '', message: 'Measuring connection...' })
  const [clockState, setClockState] = useState({ status: 'checking', warning: false, message: 'Checking system clock...' })
  const [computerState, setComputerState] = useState({ status: 'checking', compatible: true, message: 'Checking computer compatibility...' })

  // SEB launch link and fallback state
  const [launchingSeb, setLaunchingSeb] = useState(false)
  const [showNothingOpened, setShowNothingOpened] = useState(false)
  const lostFocusRef = useRef(false)
  const fallbackTimerRef = useRef(null)

  const supportUrl = getSupportUrl()
  const sebDownloadUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEB_DOWNLOAD_URL) || 'https://safeexambrowser.org/download_en.html'

  // 1. Initial Data Fetch: Exam, Config/ServerTime, and SEB status
  const loadExamAndConfig = useCallback(async () => {
    try {
      const pingStart = performance.now()
      const [examRes, configRes, sebRes] = await Promise.all([
        apiClient.get(`/exams/${id}`).catch((err) => { throw err }),
        apiClient.get('/config').catch(() => ({ data: { serverTime: new Date().toISOString() } })),
        apiClient.get(`/attempts/exams/${id}/seb-status`).catch(() => ({ data: { required: false, verified: false, mode: 'off' } }))
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

      // SEB Status & Computer Compatibility Check
      const seb = sebRes.data || { required: false, verified: false, mode: 'off' }
      setSebStatus(seb)

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

  // 2. Camera Permission & Live Preview Check via unified store
  const startCameraCheck = useCallback(async () => {
    try {
      await requestCamera()
    } catch (_) {}
  }, [requestCamera])

  useEffect(() => {
    if (!loading && !globalError) {
      startCameraCheck()
    }
  }, [loading, globalError, startCameraCheck])

  // 3. Keep current time counting every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 4. Save readiness state to localStorage whenever checks finish
  useEffect(() => {
    if (cameraState.status === 'ready' && internetState.status !== 'checking' && clockState.status === 'ready') {
      saveReadinessResult({
        camera: cameraState.status === 'ready',
        internet: internetState.status === 'ready' || internetState.status === 'warning',
        clock: clockState.status === 'ready',
        computer: computerState.status === 'ready'
      })
    }
  }, [cameraState.status, internetState.status, clockState.status, computerState.status])

  // 5. Cleanup fallback timers on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [])

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

  // 6. Launch Safe Exam Browser handler with 4s focus loss detection
  const handleLaunchSeb = async () => {
    setLaunchingSeb(true)
    setShowNothingOpened(false)
    lostFocusRef.current = false

    const handleWindowBlur = () => {
      lostFocusRef.current = true
    }
    const handleVisibilityChange = () => {
      if (document.hidden) lostFocusRef.current = true
    }

    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    try {
      const res = await apiClient.post('/seb/launch-link', { examId: id })
      const launchUrl = res.data?.url
      if (!launchUrl) throw new Error('No launch URL returned from server')

      // Trigger OS protocol launch
      window.location.href = launchUrl

      // 4-second visibility detection
      fallbackTimerRef.current = setTimeout(() => {
        if (!lostFocusRef.current) {
          setShowNothingOpened(true)
        }
        setLaunchingSeb(false)
        window.removeEventListener('blur', handleWindowBlur)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }, 4000)
    } catch (err) {
      setLaunchingSeb(false)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      const mapped = mapStudentError(err)
      setGlobalError(mapped)
    }
  }

  // 7. Proceed to Pre-Exam Check (or direct exam arena)
  const handleStartExam = () => {
    // Report telemetry (§Task 8)
    apiClient.post(`/exams/${id}/readiness`, {
      osFamily: detectOsFamily(),
      browserFamily: detectBrowserFamily(),
      cameraOk: cameraState.status === 'ready',
      latencyBucket: (internetState.rating || 'good').toLowerCase(),
      sebVerified: Boolean(sebStatus?.verified)
    }).catch(() => {})

    navigate(`/student/exams/${id}/pre-check`)
  }

  const isSebLockedOut = sebStatus?.required && !sebStatus?.verified
  const allChecksReady = cameraState.status === 'ready' && computerState.compatible

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
        <Card className="w-full max-w-lg border-0 bg-white shadow-md rounded-[16px] font-sans p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-[480] text-[#28253b]">{globalError.title}</CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b] leading-relaxed">
            {globalError.message}
          </CardDescription>
          <div className="pt-2 flex flex-col gap-2">
            {globalError.actionType === 'dashboard' ? (
              <Button onClick={() => navigate('/student/dashboard')} className="w-full bg-[#5266eb] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                Return to Dashboard
              </Button>
            ) : globalError.actionType === 'seb' ? (
              <Button onClick={handleLaunchSeb} className="w-full bg-[#5266eb] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                Open Secure Exam Browser
              </Button>
            ) : (
              <Button onClick={() => { setGlobalError(null); loadExamAndConfig() }} className="w-full bg-[#5266eb] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                Try Again
              </Button>
            )}
            <a href={supportUrl} className="inline-flex items-center justify-center gap-1.5 text-xs text-[#554e7b] hover:text-[#5266eb] pt-1">
              <HelpCircle className="w-3.5 h-3.5" /> Need help? Contact technical support
            </a>
          </div>
        </Card>
      </ExamArenaShell>
    )
  }

  return (
    <ExamArenaShell className="items-center justify-center p-4">
      <Card className="w-full max-w-xl border-0 bg-white shadow-md rounded-[16px] font-sans overflow-hidden">
        {/* Header */}
        <CardHeader className="text-center pb-3 pt-6 bg-gradient-to-b from-[#fbfbff] to-white border-b border-[#edecfb]">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <ShieldCheck className="w-5 h-5 text-[#5266eb]" />
            <Badge variant="outline" className="border-0 bg-[#edecfb] text-[#5266eb] text-xs font-[420]">
              {sebStatus?.required && sebStatus?.verified ? 'Secure Browser Active' : 'System Readiness Check'}
            </Badge>
          </div>
          <CardTitle className="text-lg font-[480] text-[#28253b]">
            {exam?.title || 'Exam Readiness Check'}
          </CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            {exam?.courseCode ? `${exam.courseCode} • Duration: ${exam.durationMinutes} minutes` : 'Verify your camera, internet, and computer before beginning'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Live System Checklist Grid */}
          <div className="space-y-2.5" role="region" aria-label="System Readiness Checklist">
            {/* 1. Camera Item */}
            <div className="p-3 bg-[#fbfbff] rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-[420] text-[#28253b]">
                  <Camera className="w-4 h-4 text-[#5266eb]" />
                  <span>1. Camera Preview & Permissions</span>
                </div>
                {cameraState.status === 'ready' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#5266eb]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                ) : cameraState.status === 'checking' ? (
                  <span className="text-[11px] text-[#70707d] font-[360] animate-pulse">Checking...</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#c04b4b]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Blocked
                  </span>
                )}
              </div>

              {cameraState.status === 'ready' ? (
                <div className="w-full aspect-video max-h-40 bg-[#171721] rounded-[8px] overflow-hidden relative mx-auto mt-1">
                  <video ref={attachVideoRef} data-testid="camera-preview-video" autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="text-[11px] text-[#554e7b] font-[360] flex items-center justify-between pt-1">
                  <span>{cameraState.message}</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={retryCamera}
                    className="text-[11px] h-7 px-3 rounded-[32px] border-[#5266eb]/30 text-[#5266eb] hover:bg-[#edecfb] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                  </Button>
                </div>
              )}
            </div>

            {/* 2. Internet Item */}
            <div className="p-3 bg-[#fbfbff] rounded-[12px] border border-[#edecfb]/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-[420] text-[#28253b]">
                <Wifi className="w-4 h-4 text-[#5266eb]" />
                <span>2. Internet Connection</span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-[480] text-[#5266eb]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {internetState.rating || 'Verified'}
                </span>
                <p className="text-[10px] text-[#70707d] font-[360]">{internetState.message}</p>
              </div>
            </div>

            {/* 3. System Clock Item */}
            <div className="p-3 bg-[#fbfbff] rounded-[12px] border border-[#edecfb]/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-[420] text-[#28253b]">
                <Clock className="w-4 h-4 text-[#5266eb]" />
                <span>3. System Clock Synchronization</span>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 text-[11px] font-[480] ${clockState.warning ? 'text-[#8a6a26]' : 'text-[#5266eb]'}`}>
                  {clockState.warning ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {clockState.warning ? 'Notice' : 'In Sync'}
                </span>
                <p className="text-[10px] text-[#70707d] font-[360]">{clockState.message}</p>
              </div>
            </div>

            {/* 4. Computer & Operating System Item */}
            <div className="p-3 bg-[#fbfbff] rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-[420] text-[#28253b]">
                  <Laptop className="w-4 h-4 text-[#5266eb]" />
                  <span>4. Computer & Operating System</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-[480] ${computerState.compatible ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                  {computerState.compatible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {computerState.compatible ? 'Compatible' : 'Incompatible'}
                </span>
              </div>
              <p className="text-[10px] text-[#70707d] font-[360] pl-6">{computerState.message}</p>
              {!computerState.compatible && computerState.supportContact && (
                <p className="text-[10px] text-[#554e7b] pl-6 font-[420]">
                  Support: <a href={`mailto:${computerState.supportContact}`} className="underline text-[#5266eb]">{computerState.supportContact}</a>
                </p>
              )}
            </div>
          </div>

          {/* Exam Window Notices */}
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
              <span className="font-mono font-[480] text-[#5266eb] bg-white px-2 py-0.5 rounded-full text-[11px] shadow-xs">
                Starts in {formatCountdown(msUntilStart)}
              </span>
            </div>
          ) : null}

          {/* SEB "Nothing opened?" Fallback Help Panel */}
          {showNothingOpened && (
            <div className="p-4 bg-[#fbfbff] border border-[#edecfb] rounded-[12px] text-xs text-[#28253b] space-y-3 font-sans">
              <div className="flex items-start justify-between">
                <h4 className="font-[480] text-[#28253b] flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#5266eb]" /> Nothing opened?
                </h4>
                <a
                  href={sebDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#5266eb] hover:underline flex items-center gap-1"
                >
                  Download Safe Exam Browser <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#554e7b] text-[11px] font-[360] pl-1">
                <li>Make sure Safe Exam Browser is installed on your Windows computer.</li>
                <li>If prompted by your browser, click <strong>"Open Safe Exam Browser"</strong>.</li>
                <li>If the prompt didn't show, click <strong>Try again</strong> below.</li>
              </ol>
              <div className="pt-1 flex gap-2">
                <Button
                  type="button"
                  onClick={handleLaunchSeb}
                  disabled={launchingSeb}
                  className="h-8 px-4 text-xs font-[420] rounded-[32px] bg-[#5266eb] hover:bg-[#4353c7] text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${launchingSeb ? 'animate-spin' : ''}`} /> Try again
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            {isExamEnded ? (
              <Button
                onClick={() => navigate('/student/dashboard')}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
              >
                Return to Dashboard
              </Button>
            ) : isSebLockedOut ? (
              <Button
                onClick={handleLaunchSeb}
                disabled={launchingSeb || !allChecksReady}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer flex items-center justify-center gap-2"
              >
                {launchingSeb ? 'Opening Secure Browser...' : 'Open secure exam browser'}
                <ExternalLink className="w-4 h-4" />
              </Button>
            ) : isExamNotOpen ? (
              <Button
                disabled
                className="w-full bg-[#edecfb] text-[#554e7b] text-xs font-[420] h-10 rounded-[32px] cursor-not-allowed opacity-80"
              >
                Starts in {formatCountdown(msUntilStart)}
              </Button>
            ) : (
              <Button
                onClick={handleStartExam}
                disabled={!allChecksReady}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer flex items-center justify-center gap-1.5"
              >
                Start exam <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {/* Persistent Need Help Link */}
            <div className="text-center pt-2">
              <a
                href={supportUrl}
                className="inline-flex items-center gap-1.5 text-xs text-[#554e7b] hover:text-[#5266eb] transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Need help? Contact technical support
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </ExamArenaShell>
  )
}

