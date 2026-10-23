import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoUploadCard } from '@/components/ui/photo-upload-card'
import { uploadVerificationImage } from '@/lib/uploadHelper'
import { ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'

export default function IdCardUploadStep({ onBack, onSubmit, submitting }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [idCardKey, setIdCardKey] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (file, url) => {
    setError('')
    setPreviewUrl(url)
    setUploading(true)
    try {
      const res = await uploadVerificationImage(file, 'ID_CARD')
      setIdCardKey(res.key)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to process ID card image.')
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setIdCardKey(null)
    setError('')
  }

  const handleSubmit = async () => {
    if (!previewUrl) {
      setError('Please upload your official College / Institutional ID card.')
      return
    }
    await onSubmit(idCardKey || previewUrl)
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-[#edecfb] rounded-xl p-3 text-xs text-[#28253b] flex items-start gap-2.5 border-0">
        <ShieldCheck className="w-4 h-4 shrink-0 text-[#5266eb] mt-0.5" />
        <span>Upload a crisp photo of your official College / Institutional ID card. Administrators inspect and verify this credential before activating your examination account.</span>
      </div>

      {error && (
        <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-xl font-[420] flex items-center gap-2 border-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#5266eb]" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-center">
        <PhotoUploadCard
          mode="file"
          label="College ID Card Document"
          description="Upload PNG, JPG, or WEBP photo of your student/faculty ID"
          value={previewUrl}
          onChange={handleFileChange}
          onClear={handleClear}
          disabled={uploading || submitting}
          className="w-full max-w-md"
        />
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-[#e9eaf2]">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          disabled={uploading || submitting}
          className="h-10 px-4 text-xs font-[420] rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!previewUrl || uploading || submitting}
          className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {uploading || submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Submitting for Review...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Submit Profile for Approval
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
