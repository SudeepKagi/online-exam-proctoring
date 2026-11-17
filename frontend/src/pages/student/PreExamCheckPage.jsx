import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { verifySebSession } from '@/lib/sebClient'
import { useCamera } from '@/hooks/useCamera'
import cameraStore from '@/lib/cameraStore'
import { detectOsFamily, detectBrowserFamily } from '@/lib/systemCheck'
import { Maximize, AlertTriangle, ShieldCheck, ArrowRight, Lock, Clock, Eye, CheckCircle2, RotateCcw, Camera } from 'lucide-react'

export default function PreExamCheckPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isWindowLocked, setIsWindowLocked] = useState(false)

  // Student Consent (§Task 9 / Phase 2 A.5)
  const [hasConsented, setHasConsented] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)

  // Phase 2 A.2 & A.3: Capture UX & Blocking Verification
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState(false)
  const [verificationError, setVerificationError] = useState(null)
  const [failedTries, setFailedTries] = useState(0)
  const [serviceErrors, setServiceErrors] = useState(0)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const canvasRef = useRef(null)

  const {
    status: cameraStatus,
    devices,
    selectedDeviceId,
    requestCamera,
    selectDevice,
    retryCamera,
    attachVideoRef,
    videoRef
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

      // Query SEB status for the exam with client verification check
      try {
        const [sebRes, clientSebCheck] = await Promise.all([
          apiClient.get(`/attempts/exams/${id}/seb-status`).catch(() => ({ data: {} })),
          verifySebSession(apiClient).catch(() => ({ verified: false }))
        ])
        const status = sebRes.data || {}
        if (!active) return
        const isVerified = Boolean(status.verified || clientSebCheck?.verified)
        const updatedStatus = { ...status, verified: isVerified }
        setSebStatus(updatedStatus)
        if (updatedStatus.mode === 'enforce' && updatedStatus.required && !updatedStatus.verified) {
          navigate(`/student/exams/${id}/seb-required`, { replace: true })
          return
        }
      } catch (_) {}
    }).catch(() => {})
    return () => { active = false }
  }, [id, navigate])

  // Acquire camera once consent is granted and student is on verification step
  useEffect(() => {
    if (hasConsented && !capturedPhoto && !isWindowLocked) {
      requestCamera().catch(() => {})
    }
  }, [hasConsented, capturedPhoto, isWindowLocked, requestCamera])

  // Polling when awaiting manual invigilator approval
  useEffect(() => {
    if (!awaitingApproval) return
    let active = true
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/attempts/exams/${id}/seb-status`)
        if (res.data?.faceVerified || res.data?.verified) {
          clearInterval(interval)
          if (active) {
            setVerifiedSuccess(true)
            setAwaitingApproval(false)
            setTimeout(() => handleLaunchExam(), 1000)
          }
        }
      } catch (_) {}
    }, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [awaitingApproval, id])

  const handleAgreeConsent = async () => {
    if (!consentAgreed) return
    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/exams/${id}/consent`, {
        consentVersion: 'v2.1',
        consentText: 'I understand and consent to a single still photo being taken for identity verification against my enrolled reference photo, and integrity logs being recorded for this exam session. No continuous camera streaming will occur.'
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

  // Phase 2 A.1 & A.2: Capture photo and stop camera tracks immediately (camera light off)
  const handleCapturePhoto = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      setError('Please wait for the live camera preview to load before capturing.')
      return
    }

    try {
      if (!canvasRef.current && typeof document !== 'undefined') {
        canvasRef.current = document.createElement('canvas')
      }
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Phase 2 A.2: Client checks for brightness / lighting quality
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data
        let sum = 0
        for (let i = 0; i < d.length; i += 4) {
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3
        }
        const avgBrightness = sum / (canvas.width * canvas.height)
        if (avgBrightness < 30) {
          setError('Lighting is too dark. Please ensure your face is well-lit and retake.')
          return
        }
        if (avgBrightness > 245) {
          setError('Lighting is overexposed or too bright. Please reduce glare and retake.')
          return
        }
      } catch (_) {}

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

      setCapturedPhoto(dataUrl)
      setError('')
      setVerificationError(null)

      // Phase 2 A.1: Stop every camera track immediately so the camera LED turns off
      if (video.srcObject && video.srcObject.getTracks) {
        video.srcObject.getTracks().forEach((track) => track.stop())
        video.srcObject = null
      }
      cameraStore.releaseCamera('precheck')
    } catch (err) {
      setError('Failed to capture photo from webcam. Please try again.')
    }
  }

  // Retake photo: reopen camera stream
  const handleRetakePhoto = () => {
    setCapturedPhoto(null)
    setVerificationError(null)
    setError('')
    setVerifiedSuccess(false)
    setAwaitingApproval(false)
    requestCamera().catch(() => {})
  }

  // Phase 2 A.3: Blocking identity verification against institutional reference photo
  const handleConfirmAndVerify = async () => {
    if (!capturedPhoto) {
      setError('Please capture a photo first.')
      return
    }

    setVerifying(true)
    setError('')
    setVerificationError(null)

    try {
      const res = await apiClient.post('/media/verify-face', {
        imageBase64: capturedPhoto,
        examId: id
      })

      const data = res.data || {}

      if (data.verified || data.status === 'MATCH') {
        setVerifiedSuccess(true)
        setAwaitingApproval(false)
        // Advance automatically after short confirmation
        setTimeout(async () => {
          await handleLaunchExam()
        }, 1200)
      } else if (data.status === 'NO_REFERENCE') {
        setVerifiedSuccess(false)
        setAwaitingApproval(true)
        setVerificationError({
          status: 'NO_REFERENCE',
          reason: 'No institutional reference photo on file. Your photo has been submitted to your invigilator for manual approval.'
        })
      } else if (data.status === 'SERVICE_ERROR') {
        setVerifiedSuccess(false)
        const nextErrors = serviceErrors + 1
        setServiceErrors(nextErrors)
        if (nextErrors >= 2) {
          setAwaitingApproval(true)
          setVerificationError({
            status: 'SERVICE_ERROR',
            reason: 'Face verification service unavailable after multiple attempts. Submitted to your invigilator for approval.'
          })
        } else {
          setVerificationError({
            status: 'SERVICE_ERROR',
            reason: 'Face verification service is currently unavailable. Please retry.'
          })
        }
      } else {
        setVerifiedSuccess(false)
        const nextFails = failedTries + 1
        setFailedTries(nextFails)
        if (nextFails >= 3) {
          setAwaitingApproval(true)
          setVerificationError({
            status: 'MAX_TRIES',
            reason: 'Ask your invigilator to verify you. Your photo has been submitted to the live console for manual approval.'
          })
        } else {
          const reason = data.reason || (
            data.status === 'NO_MATCH' ? 'Face did not match institutional reference photo. Please retake.' :
            data.status === 'NO_FACE' ? 'No face detected in the photo. Please ensure your face is well-lit and clearly visible.' :
            data.status === 'MULTIPLE_FACES' ? 'Multiple faces detected in the photo. Please ensure only the candidate is visible.' :
            data.status === 'LOW_QUALITY' ? 'Photo quality is too low or blurry. Please retake in good lighting.' :
            'Identity verification failed. Please retake your photograph.'
          )
          setVerificationError({
            status: data.status || 'VERIFICATION_FAILED',
            reason
          })
        }
      }
    } catch (err) {
      const errData = err.response?.data
      const status = errData?.status || 'SERVICE_ERROR'
      const reason = errData?.reason || errorMessage(err, 'Face verification service unavailable. Please retry.')
      const nextErrors = serviceErrors + 1
      setServiceErrors(nextErrors)
      if (nextErrors >= 2) {
        setAwaitingApproval(true)
        setVerificationError({
          status: 'SERVICE_ERROR',
          reason: 'Face verification service unavailable after multiple attempts. Submitted to your invigilator for approval.'
        })
      } else {
        setVerificationError({ status, reason })
      }
    } finally {
      setVerifying(false)
    }
  }

  const handleLaunchExam = async () => {
    setLoading(true)
    setError('')
    try {
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
            {!hasConsented ? 'Examination Privacy & Proctoring Consent' : 'Pre-Examination Identity Verification'}
          </CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            {!hasConsented
              ? 'Please review how your data is processed and protected during this assessment'
              : (exam?.title ? `${exam.title} — Identity Verification` : 'Confirm your identity before entering the exam')}
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
            /* Stage 0: Privacy & Proctoring Consent (Phase 2 A.5) */
            <div className="space-y-4 font-sans">
              <div className="p-3.5 bg-[#fbfbff] rounded-[14px] border border-[#e9eaf2]/60 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">Single Verification Photo</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      A single still photograph is captured during pre-check for 1:1 facial identity matching against your enrolled reference photo, alongside browser security event logs (e.g., tab switch or fullscreen exit).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">No Video Streaming</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      There is zero continuous video streaming, webcam surveillance, or audio listening during the exam. The camera turns off immediately once your photo is taken.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#edecfb] flex items-center justify-center shrink-0 mt-0.5 text-[#5266eb]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-[480] text-[#28253b]">Strict Retention Policy</h4>
                    <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed mt-0.5">
                      Verification photos and security event records are securely retained solely for institutional grade auditing and automatically purged according to institutional policy.
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
                  I understand and consent to a single photo being taken for identity verification against my enrolled reference photo, and integrity logs being recorded for this exam session. No continuous camera streaming will occur.
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
            /* Stage 1: Capture & Blocking Verification Pipeline (Phase 2 A.2 & A.3) */
            <div className="space-y-4 font-sans">
              <div className="flex justify-between items-center px-4 py-2 bg-[#fbfbff] rounded-[40px] text-xs font-[420]">
                <span className="text-[#5266eb] font-[500]">Identity Verification</span>
                {isSebActive ? (
                  <span className="text-[#5266eb] font-[480] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Secure browser verified
                  </span>
                ) : (
                  <span className="text-[#554e7b] font-[420]">One still photo</span>
                )}
              </div>

              {isWindowLocked ? (
                <div className="pt-2 text-center">
                  <Button onClick={() => navigate('/student/dashboard')} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                    Return to Student Dashboard
                  </Button>
                </div>
              ) : verifiedSuccess ? (
                /* Success State */
                <div className="p-6 bg-[#fbfbff] rounded-[16px] text-center space-y-3">
                  <div className="w-12 h-12 bg-[rgba(82,102,235,0.10)] text-[#5266eb] rounded-full mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-[480] text-[#28253b]">Identity Verified Successfully</h3>
                    <p className="text-xs text-[#554e7b] font-[360] mt-1">
                      Your photo matched the institutional reference record. Camera is now turned off.
                    </p>
                  </div>
                  <Badge className="bg-[rgba(82,102,235,0.10)] text-[#5266eb] border-0 rounded-full px-3 py-1 font-[420]">
                    Launching exam arena...
                  </Badge>
                </div>
              ) : capturedPhoto ? (
                /* Captured Photo Review & Confirmation */
                <div className="space-y-3 text-center">
                  <div className="aspect-video bg-[#fbfbff] rounded-[12px] overflow-hidden relative flex items-center justify-center border border-[#e9eaf2]">
                    <img src={capturedPhoto} alt="Captured candidate portrait" className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[40px] text-[11px] bg-[#edecfb] text-[#28253b] font-[420] shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb]" />
                        Camera turned off
                      </span>
                    </div>
                  </div>

                  {awaitingApproval ? (
                    <div className="p-4 bg-[#fbfbff] border border-[#e9eaf2] rounded-[16px] text-center space-y-3">
                      <div className="w-10 h-10 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center animate-pulse">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-[480] text-[#28253b]">Waiting for Invigilator Approval</h4>
                        <p className="text-[11px] text-[#554e7b] mt-1 leading-relaxed">
                          {verificationError?.reason || 'Ask your invigilator to verify you. Your photograph has been submitted to the live console for manual approval.'}
                        </p>
                      </div>
                      <Badge className="bg-[#edecfb] text-[#5266eb] border-0 rounded-full px-3 py-1 text-[10px] font-[420]">
                        Listening for live approval...
                      </Badge>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRetakePhoto}
                          className="rounded-[40px] h-9 text-xs font-[420] border-0 bg-[rgba(82,102,235,0.08)] text-[#28253b]"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Retake & Retry Match
                        </Button>
                      </div>
                    </div>
                  ) : verificationError ? (
                    <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs text-left space-y-1">
                      <div className="flex items-center gap-1.5 font-[480]">
                        <AlertTriangle className="w-4 h-4 text-[#5266eb] shrink-0" />
                        <span>Verification Failed: {verificationError.status}</span>
                      </div>
                      <p className="text-[11px] text-[#554e7b] pl-5">{verificationError.reason}</p>
                    </div>
                  ) : null}

                  <p className="text-xs text-[#70707d] font-[360]">
                    Verify that your face is clearly visible, centered, and well-lit.
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRetakePhoto}
                      disabled={verifying}
                      className="flex-1 rounded-[40px] h-10 text-xs font-[420] border-transparent bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#5266eb]" /> Retake photo
                    </Button>
                    <Button
                      type="button"
                      onClick={handleConfirmAndVerify}
                      disabled={verifying || awaitingApproval}
                      className="flex-1 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {verifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Identity...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Confirm & Verify</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Live Preview for Still Photo Capture */
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
                    <div className="aspect-video bg-[#28253b] rounded-[12px] overflow-hidden relative flex items-center justify-center">
                      <video ref={attachVideoRef} data-testid="camera-preview-video" autoPlay playsInline muted className="w-full h-full object-cover" />

                      {/* Oval face guide overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-44 h-56 rounded-full border-2 border-dashed border-white/60 shadow-lg flex items-center justify-center">
                          <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full font-[360]">
                            Align face here
                          </span>
                        </div>
                      </div>

                      {/* Guidance banner */}
                      <div className="absolute bottom-2 inset-x-2 pointer-events-none text-center">
                        <span className="inline-block text-[11px] text-white bg-black/60 backdrop-blur-xs px-3 py-1 rounded-full font-[360]">
                          Position your face inside the frame in a well-lit room
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Device selector */}
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

                  <Button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={isCameraBlocked}
                    className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </ExamArenaShell>
  )
}
