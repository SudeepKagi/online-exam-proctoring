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
    <aside className="w-64 bg-card border-l border-border flex flex-col shrink-0 hidden lg:flex font-sans select-none">
      {/* Live Camera PIP Box */}
      <div className="p-3.5 border-b border-border">
        <p className="text-[11px] text-muted-foreground font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5">
          <Camera size={13} className="text-primary" /> Active Video Stream
        </p>
        <div className="relative bg-neutral-900 rounded-xl overflow-hidden aspect-video border border-border shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!cameraOk && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/90">
              <div className="text-center">
                <CameraOff size={20} className="text-destructive mx-auto mb-1 animate-pulse" />
                <p className="text-[11px] text-destructive font-bold">Stream Paused</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question Palette Matrix */}
      <div className="flex-1 overflow-y-auto p-3.5">
        <p className="text-[11px] text-muted-foreground font-bold mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
          <List size={13} className="text-primary" /> Question Palette
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
                className={`w-full aspect-square rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-primary text-white ring-2 ring-primary/40 shadow-xs'
                    : isFlagged
                    ? 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                    : isAnswered
                    ? 'bg-[#ecfdf5] text-[#166534] border border-[#bbf7d0]'
                    : 'bg-card border border-border text-muted-foreground hover:bg-[#eff6ff] hover:text-primary hover:border-primary/40'
                }`}
                aria-label={`Jump to question ${i + 1}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 space-y-2 text-xs border-t border-border pt-4 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary shrink-0" />
            <span className="font-medium">Current Item</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#ecfdf5] border border-[#bbf7d0] text-[#166534] shrink-0" />
            <span className="font-medium">Answered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#fffbeb] border border-[#fde68a] text-[#b45309] shrink-0" />
            <span className="font-medium">Flagged for Review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-card border border-border shrink-0" />
            <span className="font-medium">Unanswered</span>
          </div>
        </div>
      </div>

      {/* Bottom Submit Action Button */}
      <div className="p-3.5 border-t border-border bg-card">
        <button
          disabled={submitting}
          onClick={onSubmitRequest}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all shadow-xs font-sans cursor-pointer"
        >
          <Send size={14} /> Finish Exam
        </button>
      </div>
    </aside>
  )
}
