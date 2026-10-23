import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function CandidateAuditSheet({
  isOpen,
  onClose,
  candidate,
  auditHistory = [],
  onToggleSuspend,
  onTerminate,
  actionLoading
}) {
  if (!candidate) return null

  const isFinalized = ['SUBMITTED', 'TIMED_OUT', 'TERMINATED'].includes(candidate.attemptStatus) || candidate.violationCount >= 3

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto font-sans bg-white border-0 shadow-xl">
        <SheetHeader>
          <SheetTitle className="text-sm font-[480] text-[#28253b]">{candidate.studentName}</SheetTitle>
          <SheetDescription className="text-xs text-[#554e7b]">
            USN: {candidate.institutionId} • Realtime telemetry & security audit history
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-3">
          <div className="p-3 bg-[#edecfb]/60 rounded-xl flex justify-between items-center text-xs">
            <span className="font-[420] text-[#28253b]">Attempt Status:</span>
            <Badge variant="outline" className="border-0 bg-white text-[#5266eb] font-mono text-[11px]">
              {candidate.attemptStatus}
            </Badge>
          </div>
          <Button
            onClick={() => onToggleSuspend(candidate)}
            disabled={actionLoading || !candidate.attemptId || isFinalized}
            variant="outline"
            className={`w-full text-xs h-9 rounded-[32px] font-[420] border-0 ${
              isFinalized
                ? 'bg-[#f4f4f7] text-[#70707d] cursor-not-allowed'
                : candidate.attemptStatus === 'SUSPENDED'
                ? 'bg-[#5266eb] text-white hover:bg-[#4353c7]'
                : 'bg-[rgba(82,102,235,0.08)] text-[#28253b] hover:bg-[rgba(82,102,235,0.14)]'
            }`}
          >
            {isFinalized
              ? 'Attempt Finalized (Read Only)'
              : candidate.attemptStatus === 'SUSPENDED'
              ? 'Resume Attempt Access'
              : 'Suspend Attempt Access'}
          </Button>
          {!isFinalized && (
            <Button
              onClick={() => onTerminate && onTerminate(candidate)}
              disabled={actionLoading || !candidate.attemptId}
              className="w-full text-xs h-9 rounded-[32px] bg-[#28253b] hover:bg-[#1f1d2e] text-white border-0 font-[420] shadow-xs cursor-pointer"
            >
              Terminate Attempt Access
            </Button>
          )}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-[480] text-muted-foreground uppercase">
              Violation History ({auditHistory.length})
            </h4>
            {auditHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No violations logged.</p>
            ) : (
              auditHistory.map((l, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border bg-card text-xs space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>{l.eventType}</span>
                    <span className="text-destructive font-mono text-[10px]">{l.severity}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(l.createdAt || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
