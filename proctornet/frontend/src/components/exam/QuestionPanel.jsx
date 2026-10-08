import { Flag, ChevronLeft, ChevronRight, CheckCircle, Send } from 'lucide-react'

/**
 * QuestionPanel Component
 * Renders Single-Choice MCQ options and question navigation footer.
 */
export default function QuestionPanel({
  questions,
  currentIdx,
  setCurrentIdx,
  answers,
  setAnswer,
  flagged,
  toggleFlag,
  answeredCount,
  submitting,
  onSubmitRequest
}) {
  const currentQ = questions[currentIdx]

  if (!currentQ) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background text-xs font-sans text-muted-foreground">
        No questions loaded for this exam.
      </main>
    )
  }

  // Extract and normalize options
  let optionsList = []
  let rawOpts = currentQ.options

  if (typeof rawOpts === 'string') {
    try { rawOpts = JSON.parse(rawOpts) } catch { rawOpts = [] }
  }

  if (Array.isArray(rawOpts) && rawOpts.length > 0) {
    optionsList = rawOpts.map((opt, i) => {
      const letter = String.fromCharCode(65 + i)
      const text = (typeof opt === 'object' && opt !== null)
        ? (opt.text || opt.optionText || opt.label || opt.value || JSON.stringify(opt))
        : String(opt)
      return { letter, text: String(text).trim(), id: opt?.id }
    }).filter(o => o.text)
  } else if (typeof rawOpts === 'object' && rawOpts !== null) {
    const keys = Object.keys(rawOpts)
    optionsList = keys.map((k, i) => {
      const letter = k.length === 1 ? k.toUpperCase() : String.fromCharCode(65 + i)
      const val = rawOpts[k]
      const text = typeof val === 'object' ? (val.text || JSON.stringify(val)) : String(val)
      return { letter, text: String(text).trim() }
    }).filter(o => o.text)
  }

  if (optionsList.length === 0) {
    ;['A', 'B', 'C', 'D', 'E', 'F'].forEach((letter, i) => {
      const val = currentQ[`option${letter}`] || currentQ[`option${i + 1}`]
      if (val !== undefined && val !== null) {
        const text = typeof val === 'object' ? (val.text || JSON.stringify(val)) : String(val)
        if (text && text.trim()) {
          optionsList.push({ letter, text: String(text).trim() })
        }
      }
    })
  }

  const currentAnswer = answers[currentQ.id]?.selected

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto p-5 lg:p-7">
        {/* Question Header: Number, Difficulty, Marks, Flag Button */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2 font-sans">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                currentQ.difficulty === 'HARD'
                  ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                  : currentQ.difficulty === 'EASY'
                  ? 'bg-[#ecfdf5] text-[#166534] border-[#bbf7d0]'
                  : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
              }`}>
                {currentQ.difficulty || 'MEDIUM'}
              </span>
              <span className="text-xs text-muted-foreground font-normal">{currentQ.marks} marks</span>
              {currentQ.negativeMarks > 0 && (
                <span className="text-xs text-[#b91c1c] font-normal">(-{currentQ.negativeMarks} penalty)</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground leading-relaxed max-w-3xl font-sans">
              {currentQ.questionText}
            </h2>
            {currentQ.imageUrl && (
              <div className="mt-4 max-w-xl rounded-xl overflow-hidden border border-border">
                <img src={currentQ.imageUrl} alt="Question Diagram" className="w-full object-contain max-h-72" />
              </div>
            )}
          </div>

          <button
            onClick={() => toggleFlag(currentQ.id)}
            title={flagged.has(currentQ.id) ? 'Remove Flag' : 'Flag Question for Review'}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              flagged.has(currentQ.id)
                ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                : 'bg-card border-border hover:bg-[#eff6ff] text-muted-foreground hover:text-primary'
            }`}
            aria-label="Flag question"
          >
            <Flag size={16} />
          </button>
        </div>

        {/* MCQ Options List */}
        <div className="space-y-3 max-w-3xl">
          {optionsList.map((opt) => {
            const selected = currentAnswer === opt.letter || currentAnswer === opt.text || (opt.id && currentAnswer === opt.id)
            return (
              <button
                key={opt.letter}
                onClick={() => setAnswer(currentQ.id, 'selected', opt.letter)}
                className={`w-full text-left flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selected
                    ? 'bg-[#eff6ff] border-[#2f80ed] text-slate-900 shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-[#2f80ed]/50 hover:bg-[#eff6ff]/30'
                }`}
                aria-pressed={selected}
              >
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  selected ? 'bg-[#2f80ed] text-white shadow-xs' : 'bg-slate-100 border border-slate-200 text-slate-600'
                }`}>
                  {opt.letter}
                </span>
                <span className="text-sm font-sans font-medium text-slate-900">{opt.text}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation Footer */}
      <footer className="flex items-center justify-between px-6 py-3.5 bg-card border-t border-border shrink-0 font-sans shadow-xs">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-neutral-50 dark:hover:bg-neutral-800 text-foreground border border-border text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <CheckCircle size={15} className="text-[#16a34a]" />
          <span>
            <span className="text-[#16a34a] font-semibold">{answeredCount}</span>/{questions.length} Answered
          </span>
        </div>

        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={onSubmitRequest}
            className="flex items-center gap-2 px-5 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl disabled:opacity-60 transition-all shadow-xs cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Finish & Submit
          </button>
        )}
      </footer>
    </main>
  )
}
