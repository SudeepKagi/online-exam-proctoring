import React, { useState, useEffect } from 'react'
import { User, Upload, AlertCircle, RefreshCw } from 'lucide-react'

/**
 * SignedImage (Prompt 12 / S-1)
 * Handles presigned S3 images with automatic refresh on error.
 * If URL is missing, broken, or refetch fails:
 * displays a neutral placeholder and surfaces a "Re-upload" action.
 */
export default function SignedImage({
  src,
  alt = 'Image',
  className = '',
  onRefresh,
  onReupload,
  fallbackIcon: FallbackIcon = User,
  fallbackText = 'No photo captured',
  reuploadText = 'Re-upload'
}) {
  const [retried, setRetried] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [loadingRefresh, setLoadingRefresh] = useState(false)

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false)
    setRetried(false)
  }, [src])

  const handleError = async () => {
    if (!retried && typeof onRefresh === 'function') {
      setRetried(true)
      setLoadingRefresh(true)
      try {
        await onRefresh()
      } catch (err) {
        setHasError(true)
      } finally {
        setLoadingRefresh(false)
      }
    } else {
      setHasError(true)
    }
  }

  if (loadingRefresh) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 p-4 ${className}`}>
        <RefreshCw size={24} className="animate-spin text-[#2f80ed]" />
        <span className="text-xs font-medium mt-2 text-slate-500">Refreshing photo...</span>
      </div>
    )
  }

  if (!src || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50/80 border border-dashed border-slate-300 rounded-xl text-slate-400 p-4 text-center ${className}`}>
        {hasError ? (
          <AlertCircle size={28} className="text-[#5266eb] mb-1" />
        ) : (
          <FallbackIcon size={28} className="text-[#554e7b] mb-1" />
        )}
        <span className="text-xs font-[420] text-[#28253b]">
          {hasError ? 'Photo not available — upload it again' : fallbackText}
        </span>
        {onReupload && (
          <button
            type="button"
            onClick={onReupload}
            className="mt-2 text-[11px] font-[420] text-[#5266eb] hover:text-[#4353c7] underline cursor-pointer"
          >
            {reuploadText}
          </button>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={className}
    />
  )
}
