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
      <main className="flex-1 flex items-center justify-center bg-[#09090B] text-xs font-mono text-slate-500">
        No questions loaded for this exam.
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-[#09090B]">
      <div className="flex-1 overflow-y-auto p-5 lg:p-6">
        {/* Question Header: Number, Difficulty, Marks, Flag Button */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5 font-mono">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                currentQ.difficulty === 'HARD'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : currentQ.difficulty === 'EASY'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {currentQ.difficulty || 'MEDIUM'}
              </span>
              <span className="text-xs text-slate-500">{currentQ.marks} marks</span>
            </div>
            <p className="text-base font-medium text-slate-100 leading-relaxed max-w-3xl font-sans">
              {currentQ.questionText}
            </p>
          </div>

          <button
            onClick={() => toggleFlag(currentQ.id)}
            title={flagged.has(currentQ.id) ? 'Remove Flag' : 'Flag Question for Review'}
            className={`p-2.5 rounded-xl border transition-colors ${
              flagged.has(currentQ.id)
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-[#141416] border-[#27272A] hover:bg-[#18181B] text-slate-400'
            }`}
          >
            <Flag size={16} />
          </button>
        </div>

        {/* ── Type 1: MCQ (A, B, C, D) ── */}
        {currentQ.type === 'MCQ' && (
          <div className="space-y-2.5 max-w-3xl">
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
                  className={`w-full text-left flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm shadow-indigo-600/10'
                      : 'bg-[#141416] border-[#27272A] text-slate-300 hover:border-[#3F3F46] hover:bg-[#18181B]'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 font-mono ${
                    selected ? 'bg-indigo-600 text-white' : 'bg-[#18181B] border border-[#27272A] text-slate-400'
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
          <div className="rounded-2xl overflow-hidden border border-[#27272A] bg-[#141416] max-w-4xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#141416] border-b border-[#27272A]">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Code size={13} className="text-indigo-400" /> Embedded IDE
              </div>
              <select
                value={codeLanguage}
                onChange={e => setCodeLanguage(e.target.value)}
                className="bg-[#09090B] text-slate-300 font-mono text-xs rounded-lg px-2.5 py-1 border border-[#27272A] outline-none"
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
              className="w-full bg-[#141416] border border-[#27272A] rounded-2xl text-slate-100 text-sm p-4 focus:outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-500 px-1">
              <span>Word Limit: {currentQ.wordLimitMin || 0} - {currentQ.wordLimitMax || 500} words</span>
              <span>{(answers[currentQ.id]?.text || '').trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Footer ── */}
      <footer className="flex items-center justify-between px-6 py-3 bg-[#141416] border-t border-[#27272A] shrink-0 font-mono">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          className="flex items-center gap-2 px-4 py-2 bg-[#09090B] hover:bg-[#18181B] text-slate-300 border border-[#27272A] text-xs font-medium rounded-xl disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CheckCircle size={14} className="text-emerald-400" />
          <span>
            <span className="text-emerald-400 font-semibold">{answeredCount}</span>/{questions.length} Answered
          </span>
        </div>

        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={onSubmitRequest}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all shadow-md shadow-emerald-600/20"
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
