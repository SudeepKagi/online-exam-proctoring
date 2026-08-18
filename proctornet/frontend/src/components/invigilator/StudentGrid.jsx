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
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-[#09090B]">
      <Video size={fallbackSize} />
      <span className="text-[7px] font-bold uppercase tracking-tight mt-0.5 text-slate-500">Live Video</span>
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
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#09090B] text-slate-600">
      <Monitor size={fallbackSize} className="mb-1 text-slate-700 animate-pulse" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Screen Standby</span>
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 font-mono text-xs">
        No candidate feeds match the active filter.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
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
            className={`group bg-[#141416] border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl ${
              isCritical
                ? 'border-rose-500/50 hover:border-rose-500 ring-1 ring-rose-500/20'
                : isWarning
                ? 'border-amber-500/40 hover:border-amber-500'
                : 'border-[#27272A] hover:border-indigo-500/50'
            }`}
          >
            {/* Top Video Preview */}
            <div className="relative aspect-video bg-[#09090B] overflow-hidden">
              <WebcamFeed
                studentId={student.id}
                initialFrame={student.latestFrame}
                className="w-full h-full object-cover"
              />

              {/* Status Badges Overlay */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${student.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-[10px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                  {student.usn || student.name}
                </span>
              </div>

              {flagCount > 0 && (
                <div className="absolute top-2 right-2">
                  <span className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${
                    isCritical
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}>
                    <AlertTriangle size={10} /> {flagCount} Flags
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Student Metadata */}
            <div className="p-3 flex items-center justify-between border-t border-[#27272A] bg-[#141416]">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-100 truncate">{student.name}</h4>
                <p className="text-[10px] font-mono text-slate-400 truncate">{student.department || 'Candidate'}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestStream?.(student.id)
                  onSelectStudent?.(student)
                }}
                className="p-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors shrink-0"
              >
                <Eye size={14} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
