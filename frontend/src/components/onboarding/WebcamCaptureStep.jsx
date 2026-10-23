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
      <div className="bg-[#edecfb] rounded-xl p-3 text-xs text-[#28253b] flex items-start gap-2.5 border-0">
        <Camera className="w-4 h-4 shrink-0 text-[#5266eb] mt-0.5" />
        <span>Position your face clearly inside the camera frame. This reference photo is used for identity verification during exams.</span>
      </div>

      {error && (
        <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-xl font-[420] flex items-center gap-2 border-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#5266eb]" />
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

      <div className="pt-4 flex items-center justify-between border-t border-[#e9eaf2]">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          disabled={uploading}
          className="h-10 px-4 text-xs font-[420] rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!previewUrl || uploading}
          className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
