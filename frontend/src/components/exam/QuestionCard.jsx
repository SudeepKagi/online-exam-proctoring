import React from 'react'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Bookmark } from 'lucide-react'

export default function QuestionCard({
  currentQ,
  currentIndex,
  totalQuestions,
  currentSelected,
  isBookmarked,
  onSelectOption,
  onToggleBookmark,
  onClearAnswer,
  onPrev,
  onNext
}) {
  const options = Array.isArray(currentQ?.options) ? currentQ.options : []

  return (
    <Card className="flex-1 flex flex-col border-[#e9eaf2] bg-white overflow-hidden shadow-xs rounded-[12px] font-sans">
      <CardHeader className="py-3 px-6 border-b border-[#e9eaf2] bg-[#fbfbff] flex flex-row items-center justify-between">
        <span className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono font-[420] text-[#554e7b] bg-[#edecfb] border-0 rounded-full px-2.5 py-0.5">
            +{Number(currentQ?.marks || 1).toFixed(2)}
          </Badge>
          {Number(currentQ?.negativeMarks) > 0 && (
            <Badge variant="outline" className="text-xs font-mono font-[420] text-[#554e7b] bg-[#edecfb] border-0 rounded-full px-2.5 py-0.5">
              -{Number(currentQ?.negativeMarks).toFixed(2)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6 overflow-y-auto space-y-4">
        <p className="text-base font-[480] text-[#28253b] leading-relaxed">
          {currentQ?.questionText || 'Loading question...'}
        </p>

        <div className="space-y-2.5 pt-2">
          {options.map((opt, idx) => {
            const isSelected = currentSelected === idx
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectOption(idx)}
                className={`w-full p-3.5 rounded-[12px] border text-left text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#5266eb] bg-[rgba(82,102,235,0.08)] text-[#28253b] font-[480]'
                    : 'border-[#e9eaf2] hover:bg-[#fbfbff] text-[#28253b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-[480] shrink-0 ${
                      isSelected ? 'bg-[#5266eb] text-white' : 'bg-[#fbfbff] text-[#554e7b] border border-[#e9eaf2]'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </div>
                <span className="text-[10px] font-mono text-[#70707d] uppercase hidden sm:inline">
                  [{idx + 1}]
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>

      <CardFooter className="py-3 px-6 border-t border-[#e9eaf2] flex items-center justify-between bg-[#fbfbff]">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="gap-1 text-xs font-[420] rounded-[40px] px-3.5 h-8 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.14)] text-[#28253b] border-0 cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <Button
            size="sm"
            onClick={onToggleBookmark}
            className={`text-xs gap-1.5 font-[420] rounded-[40px] px-3.5 h-8 border-0 cursor-pointer ${
              isBookmarked ? 'bg-[rgba(82,102,235,0.18)] text-[#28253b]' : 'bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.14)] text-[#28253b]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#5266eb]" /> Bookmark
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAnswer}
            className="text-xs text-[#554e7b] font-[420] rounded-[40px] px-3 h-8 hover:bg-[rgba(82,102,235,0.08)] hover:text-[#28253b]"
          >
            Clear Answer
          </Button>
        </div>
        <Button
          size="sm"
          onClick={onNext}
          disabled={currentIndex >= totalQuestions - 1}
          className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1 text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer disabled:opacity-40"
        >
          Save & Next <ChevronRight className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
