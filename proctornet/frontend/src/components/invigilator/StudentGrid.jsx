import React, { useEffect, useRef, useState } from 'react'
import { Video, Monitor, AlertTriangle, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react'

export function WebcamFeed({ studentId, initialFrame, className, fallbackSize = 14 }) {
  const [frame, setFrame] = useState(initialFrame || window.latestStudentFrames?.[studentId]?.camera || null)
  const [stream, setStream] = useState(null)
  const [lastSeen, setLastSeen] = useState(Date.now())
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'camera') {
        setFrame(e.detail.frame)
        setLastSeen(Date.now())
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'camera') {
        setStream(e.detail.stream)
        setLastSeen(Date.now())
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.camera) {
      setStream(window.activeWebRTCStreams[studentId].camera)
      setLastSeen(Date.now())
    } else if (window.latestStudentFrames?.[studentId]?.camera) {
      setFrame(window.latestStudentFrames[studentId].camera)
      setLastSeen(Date.now())
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    if (initialFrame) {
      setFrame(initialFrame)
      setLastSeen(Date.now())
    }
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})

      const tracks = stream.getTracks()
      const handleEnded = () => {
        setStream(null)
      }
      tracks.forEach(t => t.addEventListener('ended', handleEnded))
      return () => {
        tracks.forEach(t => t.removeEventListener('ended', handleEnded))
      }
    }
  }, [stream])

  if (stream && stream.active) {
    return (
      <div className="relative w-full h-full">
        <video ref={videoRef} autoPlay playsInline muted className={className} />
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[8px] font-bold text-emerald-400 uppercase tracking-tight">
          Live WebRTC
        </span>
      </div>
    )
  }

  if (frame) {
    return (
      <div className="relative w-full h-full">
        <img src={frame} className={className} alt="Webcam" />
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-[8px] font-bold text-white/80 uppercase tracking-tight">
          Adaptive Feed
        </span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-neutral-900">
      <Video size={fallbackSize} />
      <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5 text-muted-foreground">Video Standby</span>
    </div>
  )
}

export function ScreenFeed({ studentId, initialFrame, className, fallbackSize = 32 }) {
  const [frame, setFrame] = useState(initialFrame || window.latestStudentFrames?.[studentId]?.screen || null)
  const [stream, setStream] = useState(null)
  const [lastSeen, setLastSeen] = useState(Date.now())
  const videoRef = useRef(null)

  useEffect(() => {
    const handleFrameUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'screen') {
        setFrame(e.detail.frame)
        setLastSeen(Date.now())
      }
    }
    const handleStreamUpdate = (e) => {
      if (e.detail?.studentId === studentId && e.detail?.type === 'screen') {
        setStream(e.detail.stream)
        setLastSeen(Date.now())
      }
    }
    window.addEventListener('student-frame-update', handleFrameUpdate)
    window.addEventListener('student-stream-update', handleStreamUpdate)

    if (window.activeWebRTCStreams && window.activeWebRTCStreams[studentId]?.screen) {
      setStream(window.activeWebRTCStreams[studentId].screen)
      setLastSeen(Date.now())
    } else if (window.latestStudentFrames?.[studentId]?.screen) {
      setFrame(window.latestStudentFrames[studentId].screen)
      setLastSeen(Date.now())
    }

    return () => {
      window.removeEventListener('student-frame-update', handleFrameUpdate)
      window.removeEventListener('student-stream-update', handleStreamUpdate)
    }
  }, [studentId])

  useEffect(() => {
    if (initialFrame) {
      setFrame(initialFrame)
      setLastSeen(Date.now())
    }
  }, [initialFrame])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})

      const tracks = stream.getTracks()
      const handleEnded = () => {
        setStream(null)
      }
      tracks.forEach(t => t.addEventListener('ended', handleEnded))
      return () => {
        tracks.forEach(t => t.removeEventListener('ended', handleEnded))
      }
    }
  }, [stream])

  if (stream && stream.active) {
    return (
      <div className="relative w-full h-full">
        <video ref={videoRef} autoPlay playsInline muted className={className} />
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[8px] font-bold text-emerald-400 uppercase tracking-tight">
          Live Screen
        </span>
      </div>
    )
  }

  if (frame) {
    return (
      <div className="relative w-full h-full">
        <img src={frame} className={className} alt="Screen" />
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-[8px] font-bold text-white/80 uppercase tracking-tight">
          Adaptive Screen
        </span>
      </div>
    )
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

  if (students.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-3xl shadow-xs space-y-3 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Users size={24} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Waiting for Candidates to Connect</h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1 font-medium leading-relaxed">
            No candidates have entered this examination room yet. Live webcam tiles will stream here as students complete the pre-exam verification.
          </p>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-3xl shadow-xs space-y-3 font-sans">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">No Candidates Matching "{filter}" Filter</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 font-medium">
            There are currently no candidate streams flagged under this category.
          </p>
        </div>
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
                {student.status === 'TERMINATED' ? (
                  <span className="text-[10px] font-semibold text-white bg-destructive/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    TERMINATED
                  </span>
                ) : student.status === 'SUSPENDED' ? (
                  <span className="text-[10px] font-semibold text-white bg-amber-600/90 px-2 py-0.5 rounded-md backdrop-blur-xs animate-pulse">
                    SUSPENDED
                  </span>
                ) : student.status === 'SUBMITTED' ? (
                  <span className="text-[10px] font-semibold text-white bg-emerald-600/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    SUBMITTED
                  </span>
                ) : student.isOffline ? (
                  <span className="text-[10px] font-semibold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    OFFLINE
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-300">
                      LIVE
                    </span>
                  </div>
                )}

                <span className="text-[10px] font-semibold text-white bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {student.usn || student.name}
                </span>
              </div>

              {flagCount > 0 && (
                <div className="absolute top-2.5 right-2.5">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-xs ${
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
                <h4 className="text-xs font-semibold text-foreground truncate">{student.name}</h4>
                <p className="text-[11px] text-muted-foreground truncate font-normal">{student.department || 'Candidate'}</p>
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
