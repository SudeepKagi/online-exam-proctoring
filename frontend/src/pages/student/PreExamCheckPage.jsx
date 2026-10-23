import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { setScreenStream, clearScreenStream, setCameraStream } from '@/lib/screenStreamStore'
import { Monitor, Maximize, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react'

export default function PreExamCheckPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isWindowLocked, setIsWindowLocked] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const screenStreamRef = useRef(null)

  useEffect(() => {
    let active = true
    apiClient.get(`/exams/${id}`).then((res) => {
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
    }).catch(() => {})
    return () => { active = false }
  }, [id])

  useEffect(() => {
    let active = true
    if (step === 1 && !isWindowLocked) {
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
      // Do not stop stream if user advanced to step 2/3
      if (step === 1 && streamRef.current && !screenStreamRef.current) {
        // cleanup if component unmounted while still on step 1
      }
    }
  }, [step, isWindowLocked])

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
      }
      setStep(2)
    } catch (_) {
      if (streamRef.current) {
        setCameraStream(streamRef.current)
      }
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
        video: { displaySurface: 'monitor', width: { max: 1280 }, height: { max: 720 }, frameRate: { max: 5 } },
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
      setStep(3)
    } catch (_) {
      setError('Screen share was cancelled or denied. An entire screen share is mandatory.')
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
      clearScreenStream()
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
              System & Identity Check
            </Badge>
          </div>
          <CardTitle className="text-xl font-[480] text-[#28253b]">{exam?.title || 'Pre-Examination Verification'}</CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b]">
            Stage {step} of 3 — Secure integrity verification pipeline
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-between items-center px-4 py-2 bg-[#fbfbff] rounded-[40px] text-xs font-[420]">
            <span className={step >= 1 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>1. Face Match</span>
            <span className={step >= 2 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>2. Entire Screen</span>
            <span className={step === 3 ? 'text-[#5266eb] font-[500]' : 'text-[#70707d]'}>3. Fullscreen Lock</span>
          </div>

          {error && (
            <div className="p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs flex items-center gap-2 font-[420]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#5266eb]" />
              <span>{error}</span>
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
              <div className="aspect-video bg-[#171721] rounded-[12px] overflow-hidden relative flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-[#70707d] font-[360]">Align your face inside the camera view and click verify.</p>
              <Button onClick={handleVerifyFace} disabled={loading} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
                {loading ? 'Verifying Identity...' : 'Capture & Verify Face'}
              </Button>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-[#edecfb] text-[#5266eb] rounded-[16px] mx-auto flex items-center justify-center">
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
          ) : (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-[#edecfb] text-[#5266eb] rounded-[16px] mx-auto flex items-center justify-center">
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
