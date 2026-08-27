import { Clock, ShieldCheck, ShieldAlert } from 'lucide-react'

function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
      ok
        ? 'bg-[#ecfdf5] border-[#bbf7d0] text-[#166534]'
        : 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
    }`}>
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-[#16a34a] animate-pulse' : 'bg-[#dc2626]'}`} />
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
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0 font-sans shadow-xs">
      {/* Left: Exam title & Student info */}
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="ProctorNet Logo" className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs" />
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            {exam?.title || 'Exam in Progress'}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#eff6ff] border border-[#d5e6fb] text-primary">
              {exam?.subject || 'PROCTOR'}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Candidate: <span className="font-semibold text-foreground">{user?.name}</span> • USN: <span className="font-semibold text-foreground">{user?.usn || 'N/A'}</span>
          </p>
        </div>
      </div>

      {/* Center: Proctoring Status Pills */}
      <div className="hidden md:flex items-center gap-2.5">
        <StatusPill ok={cameraOk && faceOk} label={cameraOk && faceOk ? 'Face Verified' : 'Face Alert'} />

        {/* Violations count */}
        {violations > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c]">
            <ShieldAlert size={14} /> {violations} Flags
          </span>
        )}
      </div>

      {/* Right: Timer Countdown */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-bold text-sm ${
          isCritical
            ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c] animate-pulse'
            : isUrgent
            ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
            : 'bg-card border-border text-foreground shadow-xs'
        }`}>
          <Clock size={16} className={isCritical ? 'text-[#b91c1c] animate-spin' : isUrgent ? 'text-[#b45309]' : 'text-primary'} />
          <span>{formattedTime}</span>
        </div>
      </div>
    </header>
  )
}
