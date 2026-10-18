import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, RefreshCw, CheckCircle2, ArrowLeft, ShieldCheck, AlertCircle, FileText } from 'lucide-react'
import { uploadMediaFile } from '@/lib/uploadHelper'

export default function IdCardUploadStep({ onBack, onSubmit, submitting }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, or WEBP).')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file size must be less than 8 MB.')
      return
    }

    setError('')
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select or upload your College ID Card image.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const key = await uploadMediaFile(selectedFile, 'ID_CARD')
      await onSubmit(key)
    } catch (err) {
      setError(err.message || 'Failed to upload ID card photo. Please retry.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
        <span>Upload a clear photo of your official College / Institutional ID card. Administrators will verify your identity against this document before approving your account.</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!previewUrl ? (
        <label className="flex flex-col items-center justify-center w-full max-w-md mx-auto h-52 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl bg-slate-50 hover:bg-blue-50/20 cursor-pointer transition p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-slate-800">Click to upload College ID Card Photo</span>
          <span className="text-[11px] text-slate-500 mt-1">Supports JPG, PNG, or WEBP (Max 8MB)</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="relative w-full max-w-md mx-auto h-52 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-2">
            <img src={previewUrl} alt="College ID Preview" className="w-full h-full object-contain" />
          </div>

          <div className="flex justify-center">
            <label className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Select different image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      <div className="pt-4 flex items-center justify-between border-t border-slate-200">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          disabled={uploading || submitting}
          className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedFile || uploading || submitting}
          className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {(uploading || submitting) ? (
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
