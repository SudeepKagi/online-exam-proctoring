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
  actionLoading
}) {
  if (!candidate) return null

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto font-sans bg-white">
        <SheetHeader>
          <SheetTitle className="text-sm font-bold">{candidate.studentName}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            USN: {candidate.institutionId} • Realtime telemetry & security audit history
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-3">
          <div className="p-3 bg-muted/40 rounded-lg flex justify-between items-center text-xs">
            <span className="font-medium">Attempt Status:</span>
            <Badge variant="outline">{candidate.attemptStatus}</Badge>
          </div>
          <Button
            onClick={() => onToggleSuspend(candidate)}
            disabled={actionLoading || !candidate.attemptId}
            variant={candidate.attemptStatus === 'SUSPENDED' ? 'default' : 'destructive'}
            className="w-full text-xs h-9 rounded-full"
          >
            {candidate.attemptStatus === 'SUSPENDED' ? 'Resume Attempt Access' : 'Suspend Attempt Access'}
          </Button>
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
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
