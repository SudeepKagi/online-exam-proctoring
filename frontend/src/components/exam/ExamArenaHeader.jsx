import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, ShieldAlert, MonitorCheck, CheckCircle2, CloudOff } from 'lucide-react'

export function ExamArenaHeader({
  exam,
  violationCount,
  formatTime,
  onSubmitClick,
  syncStatus = 'SAVED'
}) {
  return (
    <header className="h-14 bg-white border-b border-[#e9eaf2] px-3 sm:px-6 flex items-center justify-between shadow-xs shrink-0 text-[#28253b] gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <span className="font-[480] text-[#28253b] text-xs sm:text-sm truncate max-w-[110px] sm:max-w-[240px]" title={exam?.title}>
          {exam?.title || 'Examination'}
        </span>
        <Badge variant="outline" className="text-[10px] sm:text-xs bg-[#edecfb] text-[#5266eb] border-0 font-mono font-[420] shrink-0">
          {exam?.courseCode || 'EXAM'}
        </Badge>
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edecfb] text-[#28253b] border-0 text-xs font-[420] shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-ping inline-block" />
          <MonitorCheck className="w-3.5 h-3.5 ml-0.5 text-[#5266eb]" />
          <span>Screen Monitoring Active</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Autosave Indicator */}
        {syncStatus === 'SAVED' && (
          <div
            data-testid="autosave-status"
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#edecfb] text-[#28253b] text-[11px] sm:text-xs font-[420]"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        )}
        {syncStatus === 'SAVING' && (
          <div
            data-testid="autosave-status"
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#edecfb] text-[#28253b] text-[11px] sm:text-xs font-[420]"
          >
            <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-ping inline-block" />
            <span className="hidden sm:inline">Saving...</span>
          </div>
        )}
        {syncStatus === 'OFFLINE' && (
          <div
            data-testid="autosave-status"
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#fff8e6] border border-[#f5e2b3] text-[#73510d] text-[11px] sm:text-xs font-[420]"
          >
            <CloudOff className="w-3.5 h-3.5 text-[#73510d]" />
            <span>Offline, will sync</span>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-sm font-[480] bg-[#edecfb] px-2 sm:px-3 py-1 rounded-[40px] border-0 text-[#28253b] shrink-0">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5266eb]" />
          <span>{formatTime()}</span>
        </div>
        <Button
          size="sm"
          onClick={onSubmitClick}
          className="px-2.5 sm:px-4 h-8 sm:h-9 text-xs cursor-pointer shrink-0"
        >
          Submit Exam
        </Button>
      </div>
    </header>
  )
}

export default ExamArenaHeader
