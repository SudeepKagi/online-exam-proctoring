import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export default function QuestionPalette({
  questions = [],
  currentIndex,
  onSelectIndex,
  answers = {},
  bookmarks = {},
  isDirty = false
}) {
  const answeredCount = Object.keys(answers).length
  const bookmarkedCount = Object.keys(bookmarks).filter(k => bookmarks[k]).length

  return (
    <Card className="flex-1 flex flex-col border-[#e9eaf2] bg-white overflow-hidden shadow-xs rounded-[12px] font-sans">
      <CardHeader className="py-3 px-4 border-b border-[#e9eaf2] bg-[#fbfbff] flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-[500] uppercase text-[#554e7b] tracking-[0.28px]">
          Question Palette
        </CardTitle>
        <span className="text-[11px] text-[#554e7b]">
          {answeredCount} / {questions.length} Done
        </span>
      </CardHeader>

      <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const answered = answers[q.id] !== undefined
            const marked = !!bookmarks[q.id]
            const isCurrent = currentIndex === idx

            let bgClass = 'bg-[#fbfbff] border border-[#e9eaf2] text-[#28253b] hover:bg-[#edecfb]/60'
            if (marked) bgClass = 'bg-[#edecfb] text-[#5266eb] border border-[#5266eb]/30 font-[480]'
            else if (answered) bgClass = 'bg-[#5266eb] text-white border-0 font-[480]'

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`h-9 rounded-lg text-xs font-[480] transition-all cursor-pointer ${
                  isCurrent ? 'ring-2 ring-[#5266eb] ring-offset-1 font-[500]' : ''
                } ${bgClass}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-[#e9eaf2] space-y-1.5 text-[11px] text-[#554e7b]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5266eb] inline-block" /> Answered
            </span>
            <span className="font-[480]">{answeredCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#edecfb] border border-[#5266eb]/40 inline-block" /> Bookmarked
            </span>
            <span className="font-[480]">{bookmarkedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fbfbff] border border-[#e9eaf2] inline-block" /> Unanswered
            </span>
            <span className="font-[480]">{questions.length - answeredCount}</span>
          </div>
        </div>

        {/* Live Autosave Status */}
        <div className="pt-2 border-t border-[#e9eaf2] flex items-center justify-between text-[11px]">
          <span className="text-[#554e7b]">Autosave:</span>
          {isDirty ? (
            <span className="text-[#5266eb] font-[420] animate-pulse">Syncing answers...</span>
          ) : (
            <span className="text-[#554e7b] flex items-center gap-1 font-[420]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> All changes saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
