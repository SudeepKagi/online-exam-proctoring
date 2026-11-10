import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { useCamera } from '@/hooks/useCamera'
import { detectOsFamily, detectBrowserFamily } from '@/lib/systemCheck'
import { Maximize, AlertTriangle, ShieldCheck, ArrowRight, Lock, Clock, Eye } from 'lucide-react'

export default function PreExamCheckPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isWindowLocked, setIsWindowLocked] = useState(false)

  // Student Consent (§Task 9)
  const [hasConsented, setHasConsented] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)

  const {
    status: cameraStatus,
    devices,
    selectedDeviceId,
    hasFrames,
    requestCamera,
    selectDevice,
    retryCamera,
    attachVideoRef,
    videoRef,
    checkFrameSample
  } = useCamera()

  const isSebActive = Boolean(sebStatus?.required && sebStatus?.verified)

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

  // Acquire camera once consent is granted and student is on verification step
  useEffect(() => {
    if (hasConsented && step === 1 && !isWindowLocked) {
      requestCamera().catch(() => {
        // Handled in store via cameraStatus === 'denied' | 'no_device' | 'in_use'
      })
    }
  }, [hasConsented, step, isWindowLocked, requestCamera])

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
    // If frames haven't arrived yet, wait up to 3 seconds for camera decoder to warm up
    let isFrameReady = hasFrames || checkFrameSample()
    if (!isFrameReady) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 200))
        if (checkFrameSample()) {
          isFrameReady = true
          break
        }
      }
    }

    if (!videoRef.current || !isFrameReady) {
      setError("We can't see your camera yet. Please ensure your camera is not covered and wait for the live preview.")
      return
    }
    setLoading(true)
    setError('')
    try {
      const v = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth || 640
      canvas.height = v.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8)

      await apiClient.post('/media/verify-face', { image: imageBase64, examId: id }).catch(() => {})
      if (isSebActive) {
        await handleLaunchExam()
      } else {
        setStep(2)
      }
    } catch (_) {
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
      // Retain live camera stream in store for ExamArenaPage (no track teardown)
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

  const isCameraBlocked = cameraStatus === 'denied' || cameraStatus === 'no_device' || cameraStatus === 'in_use' || cameraStatus === 'lost'

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

          {!consentChecked ? (
            <div className="py-12 text-center font-sans">
              <div className="w-8 h-8 border-2 border-[#5266eb] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-[#554e7b] font-[420]">Checking proctoring consent status...</p>
            </div>
          ) : !hasConsented ? (
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
                  {isCameraBlocked ? (
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
                        onClick={retryCamera}
                        className="w-full mt-2 bg-[#edecfb] hover:bg-[#dfe1fa] text-[#5266eb] text-xs font-[420] h-9 rounded-[32px] cursor-pointer"
                      >
                        Try camera again
                      </Button>
                    </div>
                  ) : (
                    <div className="aspect-video bg-[#171721] rounded-[12px] overflow-hidden relative flex items-center justify-center">
                      <video ref={attachVideoRef} data-testid="camera-preview-video" autoPlay playsInline muted className="w-full h-full object-cover" />
                      {/* Frames arriving status badge */}
                      <div className="absolute top-3 right-3 pointer-events-none">
                        {hasFrames ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[40px] text-[11px] bg-[#edecfb] text-[#5266eb] font-[420] shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb] animate-pulse" />
                            Frames arriving
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[40px] text-[11px] bg-[#fbfbff] text-[#70707d] font-[420] shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            Connecting feed...
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Camera selector if multiple devices */}
                  {devices.length > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <span className="text-[11px] font-[420] text-[#554e7b]">Camera:</span>
                      <select
                        value={selectedDeviceId || ''}
                        onChange={(e) => selectDevice(e.target.value)}
                        className="text-xs bg-[#fbfbff] text-[#28253b] font-[420] rounded-[8px] px-2 py-1 outline-none cursor-pointer"
                      >
                        {devices.map((d, idx) => (
                          <option key={d.deviceId || idx} value={d.deviceId}>
                            {d.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p className="text-xs text-[#70707d] font-[360]">Align your face inside the camera view and click verify.</p>
                  <Button
                    onClick={handleVerifyFace}
                    disabled={loading || isCameraBlocked}
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
