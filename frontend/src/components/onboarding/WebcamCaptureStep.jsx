import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoUploadCard } from '@/components/ui/photo-upload-card'
import { uploadVerificationImage } from '@/lib/uploadHelper'
import { Camera, ArrowRight, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'

export default function WebcamCaptureStep({ onNext, onBack, initialPreview }) {
  const [previewUrl, setPreviewUrl] = useState(initialPreview || null)
  const [photoKey, setPhotoKey] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handlePhotoCapture = async (blob, url) => {
    setError('')
    setPreviewUrl(url)
    setUploading(true)
    try {
      const res = await uploadVerificationImage(blob, 'FACE')
      setPhotoKey(res.key)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to process face photo.')
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setPhotoKey(null)
    setError('')
  }

  const handleContinue = () => {
    if (!previewUrl) {
      setError('Please capture your reference photo to continue.')
      return
    }
    onNext(photoKey || previewUrl, previewUrl)
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
        <Camera className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
        <span>Position your face clearly inside the camera frame. This reference photo is used for identity verification during exams.</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-center">
        <PhotoUploadCard
          mode="webcam"
          label="Webcam Face Reference"
          description="Live camera capture for student identity verification"
          value={previewUrl}
          onChange={handlePhotoCapture}
          onClear={handleClear}
          disabled={uploading}
          className="w-full max-w-md"
        />
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-slate-200">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          disabled={uploading}
          className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!previewUrl || uploading}
          className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Uploading Face Photo...
            </>
          ) : (
            <>
              Proceed to College ID Upload <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
