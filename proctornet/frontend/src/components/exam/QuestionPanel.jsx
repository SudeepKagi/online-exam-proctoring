import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Flag, Code, ChevronLeft, ChevronRight, CheckCircle, Send } from 'lucide-react'

/**
 * QuestionPanel Component
 * Handles rendering MCQ option buttons, Monaco code editor, and subjective text inputs,
 * along with question navigation footer.
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
  const [codeLanguage, setCodeLanguage] = useState('python')

  if (!currentQ) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background text-xs font-sans text-muted-foreground">
        No questions loaded for this exam.
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto p-5 lg:p-7">
        {/* Question Header: Number, Difficulty, Marks, Flag Button */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2 font-sans">
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                currentQ.difficulty === 'HARD'
                  ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                  : currentQ.difficulty === 'EASY'
                  ? 'bg-[#ecfdf5] text-[#166534] border-[#bbf7d0]'
                  : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
              }`}>
                {currentQ.difficulty || 'MEDIUM'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{currentQ.marks} marks</span>
            </div>
            <p className="text-base font-bold text-foreground leading-relaxed max-w-3xl font-sans">
              {currentQ.questionText}
            </p>
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

        {/* ── Type 1: MCQ (A, B, C, D) ── */}
        {currentQ.type === 'MCQ' && (
          <div className="space-y-3 max-w-3xl">
            {['A', 'B', 'C', 'D'].map((opt, i) => {
              const optRaw = currentQ[`option${opt}`] || currentQ.options?.[i]
              if (!optRaw) return null

              let text = ''
              if (typeof optRaw === 'object' && optRaw !== null) {
                if (optRaw.text !== undefined && optRaw.text !== null) {
                  text = typeof optRaw.text === 'object' ? (optRaw.text.text || JSON.stringify(optRaw.text)) : String(optRaw.text)
                } else {
                  text = JSON.stringify(optRaw)
                }
              } else {
                text = String(optRaw)
              }

              const selected = answers[currentQ.id]?.selected === opt
              return (
                <button
                  key={opt}
                  onClick={() => setAnswer(currentQ.id, 'selected', opt)}
                  className={`w-full text-left flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#eff6ff] border-primary text-foreground shadow-xs font-semibold dark:bg-neutral-800'
                      : 'bg-card border-border text-foreground hover:border-primary/50 hover:bg-[#eff6ff]/30'
                  }`}
                  aria-pressed={selected}
                >
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    selected ? 'bg-primary text-white' : 'bg-[#f1f5f9] border border-border text-muted-foreground dark:bg-neutral-800'
                  }`}>
                    {opt}
                  </span>
                  <span className="text-sm font-sans">{text}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Type 2: CODE (Monaco Editor) ── */}
        {currentQ.type === 'CODE' && (
          <div className="rounded-2xl overflow-hidden border border-border bg-card max-w-4xl shadow-xs">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8fafc] dark:bg-neutral-900 border-b border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Code size={14} className="text-primary" /> Embedded IDE
              </div>
              <select
                value={codeLanguage}
                onChange={e => setCodeLanguage(e.target.value)}
                className="bg-card text-foreground font-sans text-xs rounded-xl px-3 py-1 border border-border outline-none font-medium cursor-pointer"
                aria-label="Code language"
              >
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript (Node)</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <Editor
              height="360px"
              language={codeLanguage}
              value={answers[currentQ.id]?.code || currentQ.codeTemplate || '# Write your solution here\n'}
              onChange={val => setAnswer(currentQ.id, 'code', val)}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
          </div>
        )}

        {/* ── Type 3: SUBJECTIVE (Textarea) ── */}
        {currentQ.type === 'SUBJECTIVE' && (
          <div className="max-w-3xl space-y-2">
            <textarea
              value={answers[currentQ.id]?.text || ''}
              onChange={e => setAnswer(currentQ.id, 'text', e.target.value)}
              placeholder="Type your explanation or structured answer here…"
              rows={9}
              className="w-full bg-card border border-border rounded-2xl text-foreground text-sm p-4 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 resize-none font-sans leading-relaxed transition-all shadow-xs"
              aria-label="Subjective answer"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1 font-medium">
              <span>Word Limit: {currentQ.wordLimitMin || 0} - {currentQ.wordLimitMax || 500} words</span>
              <span>{(answers[currentQ.id]?.text || '').trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Footer ── */}
      <footer className="flex items-center justify-between px-6 py-3.5 bg-card border-t border-border shrink-0 font-sans shadow-xs">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-neutral-50 dark:hover:bg-neutral-800 text-foreground border border-border text-xs font-bold rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
          <CheckCircle size={15} className="text-[#16a34a]" />
          <span>
            <span className="text-[#16a34a] font-bold">{answeredCount}</span>/{questions.length} Answered
          </span>
        </div>

        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={onSubmitRequest}
            className="flex items-center gap-2 px-5 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all shadow-xs cursor-pointer"
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
