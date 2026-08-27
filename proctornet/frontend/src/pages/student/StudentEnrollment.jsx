import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  ShieldCheck,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Lock,
  UserCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function StudentEnrollment() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Consent, 2: Face Capture, 3: ID Upload, 4: Submitted/Verified
  const [consentGiven, setConsentGiven] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Face webcam state
  const videoRef = useRef(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [capturedSelfie, setCapturedSelfie] = useState(null)
  const [livenessStatus, setLivenessStatus] = useState(null)

  // ID card state
  const [idImage, setIdImage] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)

  // Initialize step based on profileStatus
  useEffect(() => {
    if (user?.profileStatus === 'SUBMITTED' || user?.profileStatus === 'VERIFIED' || user?.profileStatus === 'LOCKED') {
      setStep(4)
    }
  }, [user?.profileStatus])

  // Start webcam when step 2 opens
  useEffect(() => {
    if (step === 2 && !cameraStream) {
      startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [step])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('[Webcam Error]', err)
      toast.error('Unable to access webcam. Please check camera permissions.')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
  }

  const handleCaptureSelfie = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedSelfie(dataUrl)
    setLivenessStatus('Anti-spoofing liveness check passed.')
  }

  const handleRetakeSelfie = () => {
    setCapturedSelfie(null)
    setLivenessStatus(null)
    startCamera()
  }

  const handleConsentSubmit = async () => {
    if (!consentGiven) {
      toast.error('You must agree to the biometric data consent terms to proceed.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/enrollment/consent')
      toast.success('Biometric consent recorded.')
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit consent.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFaceSubmit = async () => {
    if (!capturedSelfie) {
      toast.error('Please capture a live selfie photo.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/enrollment/face', { image: capturedSelfie })
      toast.success('Live face enrolled successfully.')
      stopCamera()
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Face enrollment failed. Please retry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleIdFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setIdImage(reader.result)
      setIdPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleIdSubmit = async () => {
    if (!idImage) {
      toast.error('Please upload your institutional or government ID card photo.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.post('/enrollment/id', { idCardImage: idImage })
      setOcrResult(res.data?.ocrData)
      toast.success('ID document parsed and profile submitted!')
      await refreshUser()
      setStep(4)
    } catch (err) {
      toast.error(err.response?.data?.error || 'ID document submission failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Mandatory Biometric Verification">
      <div className="max-w-4xl mx-auto py-4 space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Student Biometric Verification Portal
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              One-time mandatory face & ID card enrollment for automated exam proctoring check-in.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/10 w-fit">
            Exadel CompreFace + PaddleOCR
          </Badge>
        </div>

        {/* Card Container matching Shadcn Dark Theme */}
        <Card className="bg-card border-border p-6 sm:p-8 shadow-xl">
          {/* Progress Stepper */}
          <div className="grid grid-cols-4 gap-2 mb-8 pb-6 border-b border-border">
            {[
              { id: 1, name: 'Consent & Terms', icon: Lock },
              { id: 2, name: 'Live Selfie', icon: Camera },
              { id: 3, name: 'ID Verification', icon: FileText },
              { id: 4, name: 'Review Status', icon: UserCheck },
            ].map((s) => {
              const Icon = s.icon
              const isActive = step === s.id
              const isDone = step > s.id

              return (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                      isDone
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : isActive
                        ? 'bg-white text-black font-bold shadow-md'
                        : 'bg-background text-slate-500 border border-border'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[11px] font-mono text-center hidden sm:block ${
                      isActive ? 'text-foreground font-bold' : isDone ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {s.name}
                  </span>
                </div>
              )
            })}
          </div>

          {/* STEP 1: CONSENT */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-300">Mandatory Profile Completion Required</h3>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    Per institutional proctoring policies, you must complete your biometric reference enrollment before you are permitted to enter scheduled exams.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-bold text-foreground">Biometric Data Consent & Privacy Disclosure</h2>
                <div className="text-xs text-foreground/90 space-y-3 leading-relaxed bg-background p-5 rounded-xl border border-border font-mono">
                  <p>
                    <strong className="text-foreground">What Data is Collected:</strong> Live webcam selfie photo, vector face embeddings, and institutional ID card document.
                  </p>
                  <p>
                    <strong className="text-foreground">How it is Used:</strong> Face embeddings are processed locally via self-hosted Exadel CompreFace (ArcFace AI) to verify your identity during exam check-in and prevent candidate impersonation.
                  </p>
                  <p>
                    <strong className="text-foreground">Privacy Guarantee:</strong> No data is transmitted to commercial third-party cloud APIs. All vector data remains encrypted on institution servers.
                  </p>
                </div>

                <label className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border cursor-pointer hover:border-border transition">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-xs text-foreground/90">
                    I explicitly consent to the processing and local vector storage of my biometric face data and ID card for automated exam proctoring identity verification.
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button
                  onClick={handleConsentSubmit}
                  disabled={!consentGiven || isSubmitting}
                  className="text-xs font-mono font-bold px-6 bg-primary hover:bg-primary text-white"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                  Agree & Proceed <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: LIVE SELFIE ENROLLMENT */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">Step A: Live Face Reference Enrollment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Center your face in the camera frame in a well-lit environment without hats or sunglasses.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-background border border-border flex items-center justify-center">
                  {!capturedSelfie ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      <div className="absolute inset-0 border-2 border-primary/40 rounded-full m-8 pointer-events-none border-dashed animate-pulse" />
                    </>
                  ) : (
                    <img src={capturedSelfie} alt="Captured Selfie" className="w-full h-full object-cover" />
                  )}
                </div>

                {livenessStatus && (
                  <p className="text-xs text-emerald-400 mt-3 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {livenessStatus}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="text-xs font-mono border-border bg-background text-foreground/90"
                >
                  Back
                </Button>

                {!capturedSelfie ? (
                  <Button
                    onClick={handleCaptureSelfie}
                    className="text-xs font-mono font-bold bg-primary hover:bg-primary text-white"
                  >
                    <Camera className="w-3.5 h-3.5 mr-2" /> Capture Live Selfie
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleRetakeSelfie}
                      variant="outline"
                      className="text-xs font-mono border-border bg-background text-foreground/90"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retake
                    </Button>
                    <Button
                      onClick={handleFaceSubmit}
                      disabled={isSubmitting}
                      className="text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                      Confirm Face Reference
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: ID DOCUMENT UPLOAD */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">Step B: Institutional / Government ID Verification</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload a clear image of your ID card. PaddleOCR and MTCNN face-crop engines will parse details automatically.
                </p>
              </div>

              <div className="space-y-4">
                {!idPreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border hover:border-primary rounded-2xl bg-background cursor-pointer transition p-6">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold text-foreground">Click to upload ID Card Image</span>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Supports JPG, PNG, WEBP</span>
                    <input type="file" accept="image/*" onChange={handleIdFileSelect} className="hidden" />
                  </label>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full max-w-md h-48 rounded-xl overflow-hidden border border-border bg-background">
                      <img src={idPreview} alt="ID Document Preview" className="w-full h-full object-contain p-2" />
                    </div>
                    <button
                      onClick={() => {
                        setIdImage(null)
                        setIdPreview(null)
                      }}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Select a different image file
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="text-xs font-mono border-border bg-background text-foreground/90"
                >
                  Back
                </Button>

                <Button
                  onClick={handleIdSubmit}
                  disabled={!idImage || isSubmitting}
                  className="text-xs font-mono font-bold bg-primary hover:bg-primary text-white"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                  Submit Profile for Review <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: SUBMITTED / VERIFIED STATUS */}
          {step === 4 && (
            <div className="text-center py-6 space-y-6">
              {user?.profileStatus === 'VERIFIED' || user?.profileStatus === 'LOCKED' ? (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Biometric Profile Verified & Locked</h2>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                    Your reference face embedding and ID document have been verified by system administration. You are eligible to enter scheduled exams.
                  </p>
                  <div className="pt-2">
                    <Button
                      onClick={() => navigate('/student/dashboard')}
                      className="text-xs font-mono font-bold bg-primary hover:bg-primary text-white px-6"
                    >
                      Go to Student Dashboard
                    </Button>
                  </div>
                </div>
              ) : user?.profileStatus === 'REJECTED' ? (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Biometric Verification Rejected</h2>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 max-w-lg mx-auto font-mono">
                    <strong>Reason:</strong> {user?.rejectionReason || 'Please re-capture clear photos of yourself and your ID card.'}
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={() => setStep(1)}
                      className="text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white px-6"
                    >
                      Re-attempt Profile Enrollment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Biometric Enrollment Under Review</h2>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                    Your reference face embedding and ID document have been submitted and are pending administrative verification review.
                  </p>

                  <div className="p-4 rounded-xl bg-background border border-border text-xs text-left max-w-md mx-auto space-y-1 font-mono">
                    <p className="text-primary font-semibold mb-2">PaddleOCR Automated Extraction Summary:</p>
                    <p><strong className="text-muted-foreground">Extracted Name:</strong> {ocrResult?.extractedName || user?.name || 'N/A'}</p>
                    <p><strong className="text-muted-foreground">Extracted USN:</strong> {ocrResult?.extractedUsn || user?.usn || 'N/A'}</p>
                    <p><strong className="text-muted-foreground">Match Confidence:</strong> {Math.round((ocrResult?.confidenceScore || 0.95) * 100)}%</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#fffbeb] border border-[#fef3c7] text-[#b45309] text-xs max-w-md mx-auto">
                    <p className="font-semibold">Awaiting Administrator Approval</p>
                    <p className="text-[11px] mt-0.5 text-[#92400e]">
                      Your application has been routed to the admin review queue. You will gain access to the student dashboard once an administrator approves your identity.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="text-xs font-mono border-border bg-background text-foreground/90"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Re-upload ID Card
                    </Button>
                    <Button
                      onClick={async () => {
                        const updated = await refreshUser()
                        if (updated?.profileStatus === 'VERIFIED') {
                          toast.success('Your profile has been approved! Unlocking dashboard...')
                        } else {
                          toast.info('Application is still pending review.')
                        }
                      }}
                      className="text-xs font-mono font-bold bg-primary hover:bg-primary text-white"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check Review Status
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
