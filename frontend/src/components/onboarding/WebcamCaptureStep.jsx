import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, RefreshCw, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react'
import { uploadMediaFile } from '@/lib/uploadHelper'

export default function WebcamCaptureStep({ onNext, onBack, initialPreview }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(initialPreview || null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setStreaming(true)
    } catch (err) {
      setError('Unable to access webcam. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }

  useEffect(() => {
    if (!previewUrl) {
      startCamera()
    }
    return () => stopCamera()
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        stopCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  const retakePhoto = () => {
    setCapturedBlob(null)
    setPreviewUrl(null)
    startCamera()
  }

  const handleConfirm = async () => {
    if (!capturedBlob && !initialPreview) {
      setError('Please capture a clear photo of your face before continuing.')
      return
    }

    setUploading(true)
    setError('')
    try {
      let key = null
      if (capturedBlob) {
        key = await uploadMediaFile(capturedBlob, 'REFERENCE_PHOTO')
      }
      onNext(key, previewUrl)
    } catch (err) {
      setError(err.message || 'Failed to upload photo. Please retry.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
        <Camera className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
        <span>Position your face clearly inside the camera frame. This reference photo is used by AWS Rekognition for exam identity verification.</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative w-full max-w-md mx-auto aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured Face" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        )}

        {!previewUrl && streaming && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-56 border-2 border-dashed border-white/60 rounded-full" />
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        {!previewUrl ? (
          <Button
            type="button"
            onClick={capturePhoto}
            disabled={!streaming}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" /> Snap Live Photo
          </Button>
        ) : (
          <Button
            type="button"
            onClick={retakePhoto}
            variant="outline"
            className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retake Photo
          </Button>
        )}
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-slate-200">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!previewUrl || uploading}
          className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Uploading to S3...
            </>
          ) : (
            <>
              Proceed to College ID <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
