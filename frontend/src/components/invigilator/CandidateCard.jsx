import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Monitor, AlertTriangle, PauseCircle, PlayCircle, Clock, ZoomIn } from 'lucide-react'

export default function CandidateCard({
  candidate,
  onInspectHistory,
  onToggleSuspend,
  onZoomSnapshot,
  actionLoading
}) {
  const isSuspended = candidate.attemptStatus === 'SUSPENDED'
  const isSubmitted = candidate.attemptStatus === 'SUBMITTED'
  const hasSnapshot = !!candidate.latestScreenSnapshotUrl

  return (
    <Card
      data-slot="card"
      onClick={(e) => {
        if (!e.target.closest('button')) onInspectHistory(candidate)
      }}
      className="border-[#e9eaf2] bg-white hover:border-[#5266eb]/50 transition shadow-xs hover:shadow-md rounded-[12px] overflow-hidden flex flex-col justify-between font-sans cursor-pointer"
    >
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between bg-[#fbfbff] border-b border-[#e9eaf2]">
        <div className="min-w-0 pr-2">
          <CardTitle className="text-xs font-[480] text-[#28253b] truncate" title={candidate.studentName}>
            {candidate.studentName}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            USN: {candidate.institutionId || '—'}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 font-[420] ${
            isSuspended ? 'bg-rose-50 text-rose-700 border-rose-200' :
            isSubmitted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            candidate.attemptStatus === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {candidate.attemptStatus}
        </Badge>
      </CardHeader>

      <CardContent className="p-3 pt-3 space-y-2">
        {/* Live Screen Preview Thumbnail */}
        <div
          onClick={() => hasSnapshot && onZoomSnapshot({
            studentName: candidate.studentName,
            institutionId: candidate.institutionId,
            snapshotDataUrl: candidate.latestScreenSnapshotUrl,
            eventType: 'LIVE_SCREEN_FEED',
            createdAt: candidate.lastActiveAt
          })}
          className={`aspect-video rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-xs group transition ${
            hasSnapshot ? 'cursor-pointer border border-zinc-200 shadow-inner' : 'bg-[#171721] text-[#c3c3cc]'
          }`}
        >
          {hasSnapshot ? (
            <>
              <img
                src={candidate.latestScreenSnapshotUrl}
                alt={`${candidate.studentName} Live Screen`}
                className="w-full h-full object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-1 text-[11px] font-medium">
                <ZoomIn className="w-3.5 h-3.5" /> Inspect Screen
              </div>
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                Live Frame
              </div>
            </>
          ) : (
            <>
              <Monitor className="w-5 h-5 text-[#5266eb] animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400 mt-1">Awaiting Feed</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center space-x-1 text-[#554e7b]">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {candidate.lastActiveAt ? new Date(candidate.lastActiveAt).toLocaleTimeString() : 'Not active'}
            </span>
          </div>
          <Badge
            variant={candidate.violationCount > 0 ? 'destructive' : 'secondary'}
            className="text-[10px] font-mono"
          >
            {candidate.violationCount} Violations
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="p-2.5 pt-0 grid grid-cols-2 gap-2 border-t border-[#e9eaf2]/60 mt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onInspectHistory(candidate)}
          className="text-[11px] h-7 px-2 font-normal text-foreground"
        >
          Audit History
        </Button>
        <Button
          size="sm"
          disabled={actionLoading || !candidate.attemptId || isSubmitted}
          variant={isSuspended ? 'default' : 'destructive'}
          onClick={() => onToggleSuspend(candidate)}
          className="text-[11px] h-7 px-2 font-normal"
        >
          {isSuspended ? <PlayCircle className="w-3 h-3 mr-1" /> : <PauseCircle className="w-3 h-3 mr-1" />}
          {isSuspended ? 'Resume' : 'Suspend'}
        </Button>
      </CardFooter>
    </Card>
  )
}
