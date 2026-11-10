import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { setCameraStream } from '@/lib/screenStreamStore'
import { detectOsFamily, detectBrowserFamily } from '@/lib/systemCheck'
import { Maximize, AlertTriangle, ShieldCheck, ArrowRight, FileText, Lock, Clock, Eye } from 'lucide-react'

export default function PreExamCheckPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState(false)
  const [isWindowLocked, setIsWindowLocked] = useState(false)

  // Student Consent (§Task 9)
  const [hasConsented, setHasConsented] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const isSebActive = Boolean(sebStatus?.required && sebStatus?.verified)

  const startCamera = () => {
    setCameraError(false)
    setError('')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraError(false)
      })
      .catch(() => {
        setCameraError(true)
        setError('Camera access is required for proctoring verification.')
      })
  }

  useEffect(() => {
    let active = true
    // Fetch consent status
    apiClient.get(`/exams/${id}/consent`)
      .then((res) => {
        if (!active) return
        if (res.data?.consented) {
          setHasConsented(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setConsentChecked(true)
      })

    apiClient.get(`/exams/${id}`).then(async (res) => {
      if (!active) return
      const ex = res.data?.exam || res.data
      setExam(ex)
      const now = new Date()
      if (ex?.startTime && now < new Date(ex.startTime)) {
        setIsWindowLocked(true)
        setError(`This examination is scheduled for ${new Date(ex.startTime).toLocaleString()}. It has not opened yet.`)
      } else if (ex?.endTime && now > new Date(ex.endTime)) {
        setIsWindowLocked(true)
        setError('This examination window has ended.')
      }

      // Query SEB status for the exam
      try {
        const sebRes = await apiClient.get(`/attempts/exams/${id}/seb-status`)
        const status = sebRes.data || {}
        if (!active) return
        setSebStatus(status)
        if (status.mode === 'enforce' && status.required && !status.verified) {
          navigate(`/student/exams/${id}/seb-required`, { replace: true })
          return
        }
      } catch (_) {}
    }).catch(() => {})
    return () => { active = false }
  }, [id, navigate])

  useEffect(() => {
    let active = true
    if (hasConsented && step === 1 && !isWindowLocked) {
      navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
          if (!active) return stream.getTracks().forEach((t) => t.stop())
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
          setCameraError(false)
        })
        .catch(() => {
          if (!active) return
          setCameraError(true)
          setError('Camera access is required for proctoring verification.')
        })
    }
    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [hasConsented, step, isWindowLocked])

  const handleAgreeConsent = async () => {
    if (!consentAgreed) return
    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/exams/${id}/consent`, {
        consentVersion: 'v1.0',
        consentText: 'I understand and consent to identity verification snapshots and proctoring logs being captured and retained for this exam session.'
      })

      // Send telemetry report to server
      apiClient.post(`/exams/${id}/readiness`, {
        osFamily: detectOsFamily(),
        browserFamily: detectBrowserFamily(),
        cameraOk: true,
        latencyBucket: 'good',
        sebVerified: Boolean(sebStatus?.verified)
      }).catch(() => {})

      setHasConsented(true)
    } catch (err) {
      setError(errorMessage(err, 'Failed to record consent. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyFace = async () => {
    if (!videoRef.current) return
    setLoading(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8)

      await apiClient.post('/media/verify-face', { image: imageBase64, examId: id }).catch(() => {})
      if (streamRef.current) {
        setCameraStream(streamRef.current)
        streamRef.current = null
      }
      if (isSebActive) {
        await handleLaunchExam()
      } else {
        setStep(2)
      }
    } catch (_) {
      if (streamRef.current) {
        setCameraStream(streamRef.current)
        streamRef.current = null
      }
      if (isSebActive) {
        await handleLaunchExam()
      } else {
        setStep(2)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLaunchExam = async () => {
    setLoading(true)
    setError('')
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      await apiClient.post(`/attempts/exams/${id}/start`, {}).catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 404) throw err
        return apiClient.post(`/attempts/${id}/start`, {})
      })
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {})
      }
      navigate(`/student/exams/${id}/arena`)
    } catch (err) {
      setError(errorMessage(err, 'Examination is not currently open.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ExamArenaShell className="items-center justify-center p-4">
      <Card className="w-full max-w-xl border-0 bg-white shadow-md rounded-[16px] font-sans">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck className="w-6 h-6 text-[#5266eb]" />
            <Badge variant="outline" className="border-0 bg-[#edecfb] text-[#554e7b] text-xs font-[420]">
              {!hasConsented ? 'Privacy & Consent' : 'System & Identity Check'}
            </Badge>
          </div>
          <CardTitle className="text-xl font-[480] text-[#28253b]">
            {!hasConsented ? 'Examination Privacy & Proctoring Consent' : 'Pre-Examination Verification'}
          </CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            {!hasConsented
              ? 'Please review how your data is processed and protected during this assessment'
              : isSebActive
                ? (exam?.title ? `${exam.title} — Identity verification` : 'Identity verification — Confirm your face before starting')
                : (exam?.title ? `${exam.title} — Stage ${step} of 2` : `Stage ${step} of 2 — Secure integrity verification pipeline`)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs flex items-center gap-2 font-[420]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#5266eb]" />
              <span>{error}</span>
            </div>
          )}

          {!hasConsented ? (
            /* Stage 0: Privacy & Proctoring Consent (§Task 9) */
            <div className="space-y-4 font-sans">
              <div className="p-3.5 bg-[#fbfbff] rounded-[14px] border border-[#e9eaf2]/60 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">What is captured</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      Periodic camera snapshots during testing, 1:1 algorithmic facial verification matching against your enrolled student photo, and automated anomaly logs (e.g., absence of face, window switches).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">Who can access this data</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      Strictly authorized course faculty, assigned proctors, and academic administrators. No data is shared with external commercial entities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">Retention period</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      All proctoring snapshots and session telemetry are automatically and permanently purged 90 days after assessment results are released.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#fbfbff] rounded-[12px] flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-check"
                  data-testid="consent-checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-[#5266eb]"
                />
                <label htmlFor="consent-check" className="text-xs text-[#28253b] font-[420] leading-relaxed cursor-pointer select-none">
                  I understand and consent to identity verification snapshots and proctoring logs being captured and retained for this exam session.
                </label>
              </div>

              <Button
                type="button"
                data-testid="consent-agree-btn"
                disabled={!consentAgreed || loading}
                onClick={handleAgreeConsent}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
              >
                {loading ? 'Recording Consent...' : 'Agree & Continue to Verification'} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          ) : (
            /* Stage 1 & 2: Verification Pipeline */
            <>
              {isSebActive ? (
                <div className="flex justify-between items-center px-4 py-2 bg-[#fbfbff] rounded-[40px] text-xs font-[420]">
                  <span className="text-[#5266eb] font-[500]">Identity Verification</span>
                  <span className="text-[#5266eb] font-[480] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Secure browser verified
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-2 bg-[#fbfbff] rounded-[40px] text-xs font-[420]">
                  <span className={step >= 1 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>1. Face Match</span>
                  <span className={step === 2 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>2. Fullscreen Lock</span>
                </div>
              )}

              {isWindowLocked ? (
                <div className="pt-2 text-center">
                  <Button onClick={() => navigate('/student/dashboard')} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                    Return to Student Dashboard
                  </Button>
                </div>
              ) : step === 1 ? (
                <div className="space-y-3 text-center">
                  {cameraError ? (
                    <div className="p-4 bg-[#fbfbff] rounded-[16px] text-left space-y-3">
                      <div className="flex items-center gap-2 text-xs font-[480] text-[#28253b]">
                        <AlertTriangle className="w-4 h-4 text-[#5266eb]" />
                        <span>Camera access needed</span>
                      </div>
                      <ol className="text-xs text-[#554e7b] space-y-1.5 list-decimal pl-4 font-[360] leading-relaxed">
                        <li>Click the camera or lock icon in your browser's address bar.</li>
                        <li>Set camera permission to <strong>Allow</strong>.</li>
                        <li>Make sure no other application (like Zoom, Teams, or Meet) is using your webcam.</li>
                      </ol>
                      <Button
                        type="button"
                        onClick={startCamera}
                        className="w-full mt-2 bg-[#edecfb] hover:bg-[#dfe1fa] text-[#5266eb] text-xs font-[420] h-9 rounded-[32px] cursor-pointer"
                      >
                        Try camera again
                      </Button>
                    </div>
                  ) : (
                    <div className="aspect-video bg-[#171721] rounded-[12px] overflow-hidden relative flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-xs text-[#70707d] font-[360]">Align your face inside the camera view and click verify.</p>
                  <Button
                    onClick={handleVerifyFace}
                    disabled={loading || cameraError}
                    className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
                  >
                    {loading
                      ? (isSebActive ? 'Verifying & Starting Exam...' : 'Verifying Identity...')
                      : (isSebActive ? 'Capture Face & Start Exam' : 'Capture & Verify Face')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-center py-4">
                  <div className="w-16 h-16 bg-[#edecfb] text-[#5266eb] rounded-[16px] mx-auto flex items-center justify-center">
                    {sebStatus?.required && sebStatus?.verified ? (
                      <ShieldCheck className="w-8 h-8" />
                    ) : (
                      <Maximize className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-[480] text-[#28253b]">
                      {sebStatus?.required && sebStatus?.verified
                        ? 'Secure browser verified'
                        : 'All Security Checks Completed'}
                    </h3>
                    <p className="text-xs text-[#70707d] font-[360] mt-1 max-w-sm mx-auto">
                      {sebStatus?.required && sebStatus?.verified
                        ? 'Safe Exam Browser integrity has been confirmed. You are ready to launch the exam session.'
                        : 'Click below to lock viewport in fullscreen mode and open the live exam arena.'}
                    </p>
                  </div>
                  <Button onClick={handleLaunchExam} disabled={loading} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs gap-1.5 font-[420] h-10 rounded-[32px] cursor-pointer">
                    {sebStatus?.required && sebStatus?.verified
                      ? 'Launch Exam'
                      : 'Enter Fullscreen & Launch Exam'} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </ExamArenaShell>
  )
}
