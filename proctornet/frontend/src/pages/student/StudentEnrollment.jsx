import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
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
    setLivenessStatus('Checking anti-spoofing liveness...')
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
      const res = await api.post('/enrollment/face', { image: capturedSelfie })
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ProctorNet Security Portal
            </h1>
            <p className="text-xs text-slate-400">Mandatory Student Biometric Verification</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
        >
          Sign Out
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full my-8 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/20">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/80">
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
              <div key={s.id} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive ? 'text-indigo-400 font-semibold' : isDone ? 'text-emerald-400' : 'text-slate-500'
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
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">Mandatory Profile Completion Required</h3>
                <p className="text-xs text-amber-200/80 mt-1">
                  Per institutional proctoring policies, you must complete your biometric reference enrollment before you are permitted to enter scheduled exams.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Biometric Processing & Data Consent Disclosure</h2>
              <div className="text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed bg-slate-950/60 p-4 sm:p-6 rounded-xl border border-slate-800">
                <p>
                  <strong>What Data is Collected:</strong> A live webcam selfie image, extracted face vector embeddings, and an uploaded institutional/government ID card photo.
                </p>
                <p>
                  <strong>How it is Used:</strong> Face embeddings are processed locally via self-hosted Exadel CompreFace (Apache 2.0 open-source AI) to verify your identity during exam check-in and prevent impersonation.
                </p>
                <p>
                  <strong>Privacy & Security:</strong> No data is transmitted to third-party commercial cloud AI APIs. All embeddings are stored on secure local infrastructure with restricted administrative access.
                </p>
                <p>
                  <strong>Data Retention:</strong> Biometric references are automatically purged N months after graduation/departure in accordance with institutional data retention schedules.
                </p>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 cursor-pointer hover:bg-slate-800/60 transition">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs sm:text-sm text-slate-200">
                  I explicitly consent to the collection, processing, and self-hosted vector storage of my biometric face vector and ID document for automated exam proctoring identity verification.
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleConsentSubmit}
                disabled={!consentGiven || isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Agree & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LIVE SELFIE ENROLLMENT */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Step A: Live Face Reference Enrollment</h2>
              <p className="text-xs text-slate-400 mt-1">
                Center your face in the camera frame in a well-lit environment without hats or sunglasses.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 shadow-inner flex items-center justify-center">
                {!capturedSelfie ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <div className="absolute inset-0 border-2 border-indigo-400/30 rounded-full m-8 pointer-events-none border-dashed animate-pulse" />
                  </>
                ) : (
                  <img src={capturedSelfie} alt="Captured Selfie" className="w-full h-full object-cover" />
                )}
              </div>

              {livenessStatus && (
                <p className="text-xs text-indigo-300 mt-3 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  {livenessStatus}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="text-xs px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Back
              </button>

              {!capturedSelfie ? (
                <button
                  onClick={handleCaptureSelfie}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 transition shadow-lg shadow-indigo-600/30"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Live Selfie</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRetakeSelfie}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake Photo</span>
                  </button>
                  <button
                    onClick={handleFaceSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-emerald-600/30"
                  >
                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Confirm & Register Face</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: ID DOCUMENT UPLOAD */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Step B: Institutional / Government ID Verification</h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload a clear image of your ID card. Open-source PaddleOCR and MTCNN face-crop engines will parse details automatically.
              </p>
            </div>

            <div className="space-y-4">
              {!idPreview ? (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl bg-slate-950/60 cursor-pointer transition p-6">
                  <Upload className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-200">Click to upload ID Card Image</span>
                  <span className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WEBP</span>
                  <input type="file" accept="image/*" onChange={handleIdFileSelect} className="hidden" />
                </label>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-md h-52 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                    <img src={idPreview} alt="ID Document Preview" className="w-full h-full object-contain p-2" />
                  </div>
                  <button
                    onClick={() => {
                      setIdImage(null)
                      setIdPreview(null)
                    }}
                    className="text-xs text-slate-400 hover:text-amber-400 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Select a different file
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="text-xs px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Back
              </button>

              <button
                onClick={handleIdSubmit}
                disabled={!idImage || isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Submit Profile for Review</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUBMITTED / VERIFIED STATUS */}
        {step === 4 && (
          <div className="text-center py-6 space-y-6">
            {user?.profileStatus === 'VERIFIED' || user?.profileStatus === 'LOCKED' ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-emerald-400">Biometric Profile Verified & Locked</h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                  Your reference face embedding and ID document have been verified by system administration. You are eligible to enter scheduled exams.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => navigate('/student/dashboard')}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-lg shadow-indigo-600/30"
                  >
                    Go to Student Dashboard
                  </button>
                </div>
              </div>
            ) : user?.profileStatus === 'REJECTED' ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-rose-400">Biometric Verification Rejected</h2>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs sm:text-sm text-rose-200 max-w-lg mx-auto">
                  <strong>Reason:</strong> {user?.rejectionReason || 'Please re-capture clear photos of yourself and your ID card.'}
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition shadow-lg shadow-amber-600/30"
                  >
                    Re-attempt Profile Enrollment
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-indigo-300">Biometric Enrollment Under Review</h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                  Your reference face embedding and ID document have been submitted and are pending administrative verification review.
                </p>
                {ocrResult && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-left max-w-md mx-auto space-y-1">
                    <p className="text-indigo-400 font-semibold mb-2">PaddleOCR Automated Extraction Summary:</p>
                    <p><strong className="text-slate-400">Extracted Name:</strong> {ocrResult.extractedName || 'N/A'}</p>
                    <p><strong className="text-slate-400">Extracted USN:</strong> {ocrResult.extractedUsn || 'N/A'}</p>
                    <p><strong className="text-slate-400">Match Confidence:</strong> {Math.round((ocrResult.confidenceScore || 0.8) * 100)}%</p>
                  </div>
                )}
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={async () => {
                      await refreshUser()
                      toast.success('Status updated.')
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Check Review Status
                  </button>
                  <button
                    onClick={() => navigate('/student/dashboard')}
                    className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 py-2">
        Powered by Self-Hosted Exadel CompreFace (ArcFace) & PaddleOCR • ProctorNet Platform
      </div>
    </div>
  )
}
