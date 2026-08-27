import React, { useEffect, useRef, useState } from 'react'
import { Video, Monitor, AlertTriangle, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react'

export function WebcamFeed({ studentId, initialFrame, className, fallbackSize = 14 }) {
  const [frame, setFrame] = useState(initialFrame)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'camera') {
        setFrame(e.detail.frame)
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'camera') {
        setStream(e.detail.stream)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.camera) {
      setStream(window.activeWebRTCStreams[studentId].camera)
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (stream) {
    return <video ref={videoRef} autoPlay playsInline muted className={className} />
  }

  if (frame) {
    return <img src={frame} className={className} alt="Webcam" />
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-neutral-900">
      <Video size={fallbackSize} />
      <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5 text-muted-foreground">Live Video</span>
    </div>
  )
}

export function ScreenFeed({ studentId, initialFrame, className, fallbackSize = 32 }) {
  const [frame, setFrame] = useState(initialFrame)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'screen') {
        setFrame(e.detail.frame)
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'screen') {
        setStream(e.detail.stream)
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.screen) {
      setStream(window.activeWebRTCStreams[studentId].screen)
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    setFrame(initialFrame)
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (stream) {
    return <video ref={videoRef} autoPlay playsInline muted className={className} />
  }

  if (frame) {
    return <img src={frame} className={className} alt="Screen" />
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-muted-foreground">
      <Monitor size={fallbackSize} className="mb-1 text-muted-foreground/70 animate-pulse" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Screen Standby</span>
    </div>
  )
}

export default function StudentGrid({
  students,
  filter,
  onSelectStudent,
  onRequestStream
}) {
  const filtered = students.filter(s => {
    if (filter === 'flagged') return (s.flagCount || 0) > 0
    if (filter === 'active') return s.status === 'ACTIVE' || s.status === 'IN_PROGRESS'
    if (filter === 'terminated') return s.status === 'TERMINATED'
    return true
  })

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground font-sans text-xs">
        No candidate feeds match the active filter.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-4 font-sans">
      {filtered.map(student => {
        const flagCount = student.flagCount || 0
        const isCritical = flagCount >= 3
        const isWarning = flagCount > 0 && flagCount < 3

        return (
          <div
            key={student.id}
            onClick={() => {
              onRequestStream?.(student.id)
              onSelectStudent?.(student)
            }}
            className={`group bg-card border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shadow-xs hover:shadow-lg ${
              isCritical
                ? 'border-destructive/60 hover:border-destructive ring-2 ring-destructive/20'
                : isWarning
                ? 'border-amber-400 hover:border-amber-500'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {/* Top Video Preview */}
            <div className="relative aspect-video bg-neutral-950 overflow-hidden">
              <WebcamFeed
                studentId={student.id}
                initialFrame={student.latestFrame}
                className="w-full h-full object-cover"
              />

              {/* Status Badges Overlay */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${student.status === 'ACTIVE' ? 'bg-[#16a34a] animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {student.usn || student.name}
                </span>
              </div>

              {flagCount > 0 && (
                <div className="absolute top-2.5 right-2.5">
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-xs ${
                    isCritical
                      ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                      : 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                  }`}>
                    <AlertTriangle size={11} /> {flagCount} Flags
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Student Metadata */}
            <div className="p-3.5 flex items-center justify-between border-t border-border bg-card">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{student.name}</h4>
                <p className="text-[10px] text-muted-foreground truncate font-medium">{student.department || 'Candidate'}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestStream?.(student.id)
                  onSelectStudent?.(student)
                }}
                className="p-1.5 rounded-xl bg-[#eff6ff] border border-[#d5e6fb] text-primary hover:bg-primary hover:text-white transition-colors shrink-0 cursor-pointer dark:bg-neutral-800 dark:border-neutral-700"
                aria-label={`View dossier for ${student.name}`}
              >
                <Eye size={15} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
