import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle2, ShieldAlert } from 'lucide-react'

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
        <span className="text-[11px] text-muted-foreground">
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
            if (marked) bgClass = 'bg-amber-500 text-white border-amber-600'
            else if (answered) bgClass = 'bg-emerald-600 text-white border-emerald-700'

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`h-9 rounded-lg text-xs font-[480] transition-all cursor-pointer ${
                  isCurrent ? 'ring-2 ring-[#5266eb] ring-offset-2 font-bold' : ''
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
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Answered
            </span>
            <span className="font-semibold">{answeredCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Bookmarked
            </span>
            <span className="font-semibold">{bookmarkedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fbfbff] border border-[#e9eaf2] inline-block" /> Unanswered
            </span>
            <span className="font-semibold">{questions.length - answeredCount}</span>
          </div>
        </div>

        {/* Live Autosave Status */}
        <div className="pt-2 border-t border-[#e9eaf2] flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Autosave:</span>
          {isDirty ? (
            <span className="text-amber-500 font-medium animate-pulse">Syncing answers...</span>
          ) : (
            <span className="text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" /> All changes saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
