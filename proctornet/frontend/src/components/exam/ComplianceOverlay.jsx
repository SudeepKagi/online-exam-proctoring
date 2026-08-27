import { Maximize2, ShieldAlert, Clock, Camera, CameraOff, CheckCircle } from 'lucide-react'

export function FullscreenComplianceOverlay({ onReenterFullscreen }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-card border border-[#fecaca] rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5 text-foreground">
        <div className="w-14 h-14 bg-[#fef2f2] border border-[#fecaca] rounded-2xl flex items-center justify-center mx-auto text-[#b91c1c]">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">Fullscreen Lockdown Exited</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Security policy requires exclusive fullscreen mode throughout the examination. A flag has been logged.
          </p>
        </div>
        <button
          onClick={onReenterFullscreen}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
        >
          <Maximize2 size={16} /> Re-enter Fullscreen Mode
        </button>
      </div>
    </div>
  )
}

export function ExamWaitingLobby({ exam, secsToStart, videoRef, cameraOk }) {
  const pad = (n) => String(n).padStart(2, '0')
  const formatTime = (secs) => {
    if (!secs || secs <= 0) return '00:00'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${pad(m)}:${pad(s)}`
  }

  const timerColor = secsToStart < 60 ? 'text-[#b91c1c] animate-pulse' : secsToStart < 300 ? 'text-[#b45309]' : 'text-primary'

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-20 right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#1c4d8e]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-xl p-6 lg:p-8 relative text-center text-foreground">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 bg-[#eff6ff] rounded-xl flex items-center justify-center border border-[#d5e6fb] dark:bg-neutral-800">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
          </div>
          <div className="text-left">
            <h1 className="font-bold text-sm tracking-wide text-foreground">PROCTORNET WAITING LOBBY</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Security Check Complete</p>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-foreground mb-1">{exam?.title}</h2>
        <p className="text-xs text-muted-foreground mb-6 font-medium">{exam?.subject} • Prof. {exam?.faculty?.name || 'Faculty'}</p>

        {/* Countdown timer */}
        <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-2xl p-6 border border-border mb-6 max-w-sm mx-auto shadow-xs">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Exam Starts In</p>
          <div className={`font-mono text-4xl font-extrabold tracking-wider ${timerColor}`}>
            {formatTime(secsToStart)}
          </div>
        </div>

        {/* Proctored preview and status list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 justify-center">
              <Camera size={12} /> Active Feed Preview
            </span>
            <div className="relative bg-neutral-900 rounded-2xl border border-border overflow-hidden aspect-video flex items-center justify-center mx-auto">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-2xl" />
              {!cameraOk && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/90">
                  <div className="text-center">
                    <CameraOff size={24} className="text-[#dc2626] mx-auto mb-1 animate-pulse" />
                    <p className="text-xs text-[#dc2626] font-bold">Camera Inactive</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-left space-y-3 bg-[#f8fafc] dark:bg-neutral-900 border border-border rounded-2xl p-4.5">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              🛡 Active Security Gating
            </h3>
            <ul className="space-y-2.5 text-xs text-muted-foreground font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#16a34a] shrink-0" />
                <span className="text-foreground">Exclusive Fullscreen Gated</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#16a34a] shrink-0" />
                <span className="text-foreground">Tab switch enforcement active</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#16a34a] shrink-0" />
                <span className="text-foreground">Biometric face tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#16a34a] shrink-0" />
                <span className="text-foreground">Display & window integrity enforcement</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-[#16a34a] rounded-full animate-ping" />
          <span>Secure holding state. Do not close or refresh this tab.</span>
        </div>
      </div>
    </div>
  )
}
