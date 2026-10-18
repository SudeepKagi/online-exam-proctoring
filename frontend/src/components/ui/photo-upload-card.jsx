import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Camera, Upload, RefreshCw, ZoomIn, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'

export function PhotoUploadCard({
  mode = 'file',
  value,
  onChange,
  onClear,
  label,
  description,
  accept = 'image/*',
  disabled = false,
  className = ''
}) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (typeof value === 'string') {
      setPreviewUrl(value)
    } else if (value instanceof Blob || value instanceof File) {
      const url = URL.createObjectURL(value)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [value])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setStreaming(true)
    } catch (_) {
      setStreaming(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }

  useEffect(() => {
    if (mode === 'webcam' && !previewUrl) {
      startCamera()
    }
    return () => stopCamera()
  }, [mode, previewUrl])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        stopCamera()
        onChange?.(blob, url)
      }
    }, 'image/jpeg', 0.9)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onChange?.(file, url)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onChange?.(file, url)
    }
  }

  const handleRetake = () => {
    setPreviewUrl(null)
    onClear?.()
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (mode === 'webcam') startCamera()
  }

  return (
    <Card className={`border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden font-sans ${className}`}>
      {(label || description) && (
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            {label && <h4 className="text-xs font-bold text-slate-900">{label}</h4>}
            {description && <p className="text-[11px] text-slate-500">{description}</p>}
          </div>
          {previewUrl && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready
            </Badge>
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {mode === 'webcam' ? (
          <div className="relative w-full aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Captured preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                {streaming && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-52 border-2 border-dashed border-white/60 rounded-full" />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div>
            <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileChange} disabled={disabled} className="hidden" />
            {previewUrl ? (
              <div className="relative w-full aspect-16/10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                <img src={previewUrl} alt="Uploaded document" className="w-full h-full object-contain p-2" />
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`w-full aspect-16/9 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300 hover:border-blue-500 bg-slate-50/50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800">Click to upload or drag & drop</span>
                <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, or WebP up to 10MB</span>
              </div>
            )}
          </div>
        )}

        {previewUrl ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setZoomOpen(true)} className="h-9 text-xs gap-1.5 rounded-lg border-slate-200">
              <ZoomIn className="w-3.5 h-3.5" /> Inspect Full Size
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleRetake} disabled={disabled} className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" /> Retake / Replace
            </Button>
          </div>
        ) : mode === 'webcam' ? (
          <Button type="button" onClick={capturePhoto} disabled={!streaming || disabled} className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg gap-2 cursor-pointer shadow-xs">
            <Camera className="w-4 h-4" /> Snap Live Photo
          </Button>
        ) : null}
      </CardContent>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">{label || 'Document Inspection'}</DialogTitle>
          </DialogHeader>
          <div className="p-2 max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl">
            {previewUrl && <img src={previewUrl} alt="Enlarged view" className="max-h-[65vh] w-auto object-contain rounded-lg" />}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default PhotoUploadCard
