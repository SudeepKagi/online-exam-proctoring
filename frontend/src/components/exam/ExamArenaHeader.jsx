import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, ShieldAlert, MonitorCheck } from 'lucide-react'

export function ExamArenaHeader({
  exam,
  violationCount,
  formatTime,
  onSubmitClick
}) {
  return (
    <header className="h-14 bg-white border-b border-[#e9eaf2] px-6 flex items-center justify-between shadow-xs shrink-0 text-[#28253b]">
      <div className="flex items-center gap-3">
        <span className="font-[480] text-[#28253b] text-sm">{exam?.title || 'Examination'}</span>
        <Badge variant="outline" className="text-xs bg-[#edecfb] text-[#5266eb] border-0 font-mono font-[420]">
          {exam?.courseCode || 'ASSESSMENT'}
        </Badge>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edecfb] text-[#28253b] border-0 text-xs font-[420]">
          <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-ping inline-block" />
          <MonitorCheck className="w-3.5 h-3.5 ml-0.5 text-[#5266eb]" />
          <span>Screen Monitoring Active</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 gap-1 bg-[#edecfb] text-[#28253b] border-0 rounded-full">
          <ShieldAlert className="w-3.5 h-3.5 text-[#5266eb]" />
          <span>Violations: {violationCount} / 3</span>
        </Badge>
        <div className="flex items-center gap-1.5 font-mono text-sm font-[480] bg-[#edecfb] px-3 py-1 rounded-[40px] border-0 text-[#28253b]">
          <Clock className="w-4 h-4 text-[#5266eb]" />
          <span>{formatTime()}</span>
        </div>
        <Button
          size="sm"
          onClick={onSubmitClick}
          className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer"
        >
          Submit Exam
        </Button>
      </div>
    </header>
  )
}

export default ExamArenaHeader
