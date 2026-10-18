import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { setScreenStream } from '@/lib/screenStreamStore'
import { Camera, Monitor, Maximize, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react'

export default function PreExamCheckPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [faceVerified, setFaceVerified] = useState(false)
  const [screenVerified, setScreenVerified] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const screenStreamRef = useRef(null)

  useEffect(() => {
    let active = true
    if (step === 1) {
      navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
          if (!active) return stream.getTracks().forEach((t) => t.stop())
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
        })
        .catch(() => setError('Webcam access was denied. Please allow camera permissions.'))
    }
    return () => {
      active = false
      if (step !== 1 && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [step])

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

      await apiClient.post('/media/verify-face', { image: imageBase64, examId: id })
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setFaceVerified(true)
      setStep(2)
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setFaceVerified(true)
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const handleShareScreen = async () => {
    setError('')
    setLoading(true)
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })
      const videoTrack = screenStream.getVideoTracks()[0]
      const surface = videoTrack?.getSettings()?.displaySurface

      if (surface && surface !== 'monitor') {
        videoTrack.stop()
        setError('Proctoring requires sharing your Entire Screen, not a window or browser tab.')
        setLoading(false)
        return
      }

      screenStreamRef.current = screenStream
      setScreenStream(screenStream)
      setScreenVerified(true)
      setStep(3)
    } catch (err) {
      setError('Screen share was cancelled or denied. An entire screen share is mandatory.')
    } finally {
      setLoading(false)
    }
  }

  const handleLaunchExam = async () => {
    setLoading(true)
    setError('')
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {})
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      await apiClient.post('/attempts/start', { examId: id }).catch(() => {})
      navigate(`/student/exams/${id}/arena`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to launch examination environment.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ExamArenaShell className="items-center justify-center p-4">
      <Card className="w-full max-w-xl border-[#e9eaf2] bg-white shadow-md rounded-[12px] font-sans">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck className="w-6 h-6 text-[#5266eb]" />
            <Badge variant="outline" className="border-[#c3c3cc]/60 bg-[#fbfbff] text-[#554e7b] text-xs font-[420]">
              System & Identity Check
            </Badge>
          </div>
          <CardTitle className="text-xl font-[480] text-[#28253b]">Pre-Examination Verification</CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            Stage {step} of 3 — Secure integrity verification pipeline
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-between items-center px-4 py-2 bg-[#fbfbff] rounded-[40px] border border-[#e9eaf2] text-xs font-[420]">
            <span className={step >= 1 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>1. Face Match</span>
            <span className={step >= 2 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>2. Entire Screen</span>
            <span className={step === 3 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>3. Fullscreen Lock</span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[12px] text-xs text-red-700 flex items-center gap-2 font-[420]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 text-center">
              <div className="aspect-video bg-[#171721] rounded-[12px] overflow-hidden relative flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-[#70707d] font-[360]">Align your face inside the camera view and click verify.</p>
              <Button onClick={handleVerifyFace} disabled={loading} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                {loading ? 'Verifying Identity...' : 'Capture & Verify Face'}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-[#edecfb] text-[#5266eb] rounded-[16px] mx-auto flex items-center justify-center border border-[#e9eaf2]">
                <Monitor className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-[480] text-[#28253b]">Entire Screen Broadcasting</h3>
                <p className="text-xs text-[#70707d] font-[360] mt-1 max-w-sm mx-auto">
                  Select "Entire Screen" in the browser prompt. Single windows or individual browser tabs will be rejected.
                </p>
              </div>
              <Button onClick={handleShareScreen} disabled={loading} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                {loading ? 'Broadcasting...' : 'Grant Entire Screen Access'}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-[#ecfdf5] text-emerald-600 rounded-[16px] mx-auto flex items-center justify-center border border-[#bbf7d0]">
                <Maximize className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-[480] text-[#28253b]">All Security Checks Completed</h3>
                <p className="text-xs text-[#70707d] font-[360] mt-1">
                  Click below to lock viewport in fullscreen mode and open the live exam arena.
                </p>
              </div>
              <Button onClick={handleLaunchExam} disabled={loading} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs gap-1.5 font-[420] h-10 rounded-[32px] cursor-pointer">
                Enter Fullscreen & Launch Exam <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ExamArenaShell>
  )
}
