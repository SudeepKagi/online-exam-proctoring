import { Clock, ShieldCheck, ShieldAlert } from 'lucide-react'

function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
      ok
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
      {label}
    </span>
  )
}

export default function ExamHeader({
  exam,
  user,
  formattedTime,
  isUrgent,
  isCritical,
  cameraOk,
  faceOk,
  socketConnected,
  violations
}) {
  return (
    <header className="h-16 border-b border-[#27272A] bg-[#141416] px-6 flex items-center justify-between shrink-0 font-sans shadow-md">
      {/* Left: Exam title & Student info */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            {exam?.title || 'Exam in Progress'}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {exam?.subject || 'PROCTOR'}
            </span>
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Candidate: <span className="text-slate-200">{user?.name}</span> • USN: <span className="text-slate-200">{user?.usn || 'N/A'}</span>
          </p>
        </div>
      </div>

      {/* Center: Proctoring Status Pills */}
      <div className="hidden md:flex items-center gap-2.5">
        <StatusPill ok={cameraOk && faceOk} label={cameraOk && faceOk ? 'Face Verified' : 'Face Alert'} />

        {/* Violations count */}
        {violations > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
            <ShieldAlert size={12} /> {violations} Flags
          </span>
        )}
      </div>

      {/* Right: Timer Countdown */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm ${
          isCritical
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
            : isUrgent
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-[#09090B] border-[#27272A] text-slate-100'
        }`}>
          <Clock size={16} className={isCritical ? 'text-rose-400 animate-spin' : isUrgent ? 'text-amber-400' : 'text-indigo-400'} />
          <span>{formattedTime}</span>
        </div>
      </div>
    </header>
  )
}
