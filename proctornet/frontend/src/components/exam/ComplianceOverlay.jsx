import { Maximize2, ShieldAlert, Clock, Camera, CameraOff, CheckCircle } from 'lucide-react'

export function FullscreenComplianceOverlay({ onReenterFullscreen }) {
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-[#141416] border border-rose-500/40 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5">
        <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Fullscreen Lockdown Exited</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">
            Security policy requires exclusive fullscreen mode throughout the examination. A flag has been logged.
          </p>
        </div>
        <button
          onClick={onReenterFullscreen}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-indigo-600/25 font-mono"
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

  const timerColor = secsToStart < 60 ? 'text-rose-400 animate-pulse' : secsToStart < 300 ? 'text-amber-400' : 'text-indigo-400'

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-200 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-20 right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-[#141416] border border-[#27272A] rounded-3xl shadow-2xl p-6 lg:p-8 relative text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
          </div>
          <div className="text-left">
            <h1 className="font-bold text-sm tracking-wide text-white">PROCTORNET WAITING LOBBY</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-semibold">Security Check Complete</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-1">{exam?.title}</h2>
        <p className="text-xs font-mono text-slate-400 mb-6">{exam?.subject} • Prof. {exam?.faculty?.name || 'Faculty'}</p>

        {/* Countdown timer */}
        <div className="bg-[#09090B] rounded-2xl p-6 border border-[#27272A] mb-6 max-w-sm mx-auto">
          <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mb-2">Exam Starts In</p>
          <div className={`font-mono text-4xl font-extrabold tracking-wider ${timerColor}`}>
            {formatTime(secsToStart)}
          </div>
        </div>

        {/* Proctored preview and status list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1.5 justify-center">
              <Camera size={12} /> Active Feed Preview
            </span>
            <div className="relative bg-[#09090B] rounded-2xl border border-[#27272A] overflow-hidden aspect-video flex items-center justify-center mx-auto">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-2xl" />
              {!cameraOk && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#09090B]/90">
                  <div className="text-center">
                    <CameraOff size={24} className="text-rose-400 mx-auto mb-1 animate-pulse" />
                    <p className="text-xs text-rose-400 font-mono">Camera Inactive</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-left space-y-3 bg-[#09090B] border border-[#27272A] rounded-2xl p-4">
            <h3 className="text-xs font-bold text-slate-100 uppercase font-mono tracking-wider flex items-center gap-1.5">
              🛡 Active Security Gating
            </h3>
            <ul className="space-y-2 text-xs font-mono text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                <span>Exclusive Fullscreen Gated</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                <span>Tab switch enforcement active</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                <span>Biometric face tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                <span>Display & window integrity enforcement</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-[#27272A] text-xs font-mono text-slate-500 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <span>Secure holding state. Do not close or refresh this tab.</span>
        </div>
      </div>
    </div>
  )
}
