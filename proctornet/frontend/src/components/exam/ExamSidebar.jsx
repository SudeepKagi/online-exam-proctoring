import { Camera, CameraOff, List, Send } from 'lucide-react'

/**
 * ExamSidebar Component
 * Right sidebar with live camera feed, question jump palette, and status legend.
 */
export default function ExamSidebar({
  videoRef,
  cameraOk,
  questions,
  currentIdx,
  setCurrentIdx,
  answers,
  flagged,
  submitting,
  onSubmitRequest
}) {
  return (
    <aside className="w-64 bg-[#141416] border-l border-[#27272A] flex flex-col shrink-0 hidden lg:flex font-mono select-none">
      {/* Live Camera PIP Box */}
      <div className="p-3.5 border-b border-[#27272A]">
        <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wider flex items-center gap-1.5">
          <Camera size={12} className="text-indigo-400" /> Active Video Stream
        </p>
        <div className="relative bg-[#09090B] rounded-xl overflow-hidden aspect-video border border-[#27272A] shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!cameraOk && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#09090B]/90">
              <div className="text-center">
                <CameraOff size={20} className="text-rose-400 mx-auto mb-1 animate-pulse" />
                <p className="text-[10px] text-rose-400">Stream Paused</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question Palette Matrix */}
      <div className="flex-1 overflow-y-auto p-3.5">
        <p className="text-[10px] text-slate-400 font-semibold mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
          <List size={12} className="text-indigo-400" /> Question Palette
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((q, i) => {
            const isAnswered = Boolean(answers[q.id]?.selected || answers[q.id]?.code || answers[q.id]?.text)
            const isFlagged = flagged.has(q.id)
            const isCurrent = i === currentIdx

            return (
              <button
                key={q.id || i}
                onClick={() => setCurrentIdx(i)}
                className={`w-full aspect-square rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md shadow-indigo-600/20'
                    : isFlagged
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : isAnswered
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#09090B] border border-[#27272A] text-slate-400 hover:bg-[#18181B]'
                }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 space-y-2 text-[11px] border-t border-[#27272A] pt-4">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded bg-indigo-600 shrink-0" />
            <span>Current Item</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0" />
            <span>Flagged for Review</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-3 h-3 rounded bg-[#09090B] border border-[#27272A] shrink-0" />
            <span>Unanswered</span>
          </div>
        </div>
      </div>

      {/* Bottom Submit Action Button */}
      <div className="p-3.5 border-t border-[#27272A] bg-[#141416]">
        <button
          disabled={submitting}
          onClick={onSubmitRequest}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all shadow-md shadow-emerald-600/20 font-sans"
        >
          <Send size={14} /> Finish Exam
        </button>
      </div>
    </aside>
  )
}
