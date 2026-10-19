import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, ZoomIn, ShieldAlert } from 'lucide-react'

export default function ViolationStream({ violations = [], onZoomSnapshot }) {
  const getBadgeVariant = (type) => {
    if (type?.includes('TAB') || type?.includes('FULLSCREEN')) return 'destructive'
    if (type?.includes('BLUR')) return 'warning'
    return 'outline'
  }

  return (
    <Card className="flex flex-col h-full border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden font-sans">
      <CardHeader className="py-3 px-4 border-b border-[#e9eaf2] bg-[#fbfbff] flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
          <CardTitle className="text-xs font-[500] uppercase text-[#554e7b] tracking-[0.28px]">
            Live Violation Stream
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono text-rose-600 bg-rose-50 border-rose-200">
          {violations.length} Alerts
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
        {violations.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#70707d] font-[360]">
            No live violation alerts recorded. Examination running with clean integrity.
          </div>
        ) : (
          violations.map((v, i) => (
            <div
              key={v.id || i}
              className="p-3 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 transition space-y-2"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <p className="text-xs font-semibold text-foreground truncate">{v.studentName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">USN: {v.institutionId || '—'}</p>
                </div>
                <Badge variant={getBadgeVariant(v.eventType)} className="text-[9px] uppercase font-mono shrink-0">
                  {v.eventType}
                </Badge>
              </div>

              {/* Screen Snapshot Thumbnail */}
              {v.snapshotDataUrl && (
                <div
                  onClick={() => onZoomSnapshot(v)}
                  className="aspect-video w-full rounded-lg overflow-hidden border border-rose-200 bg-black relative group cursor-pointer shadow-xs"
                >
                  <img
                    src={v.snapshotDataUrl}
                    alt={`${v.studentName} violation capture`}
                    className="w-full h-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-medium gap-1">
                    <ZoomIn className="w-3.5 h-3.5" /> Zoom Snapshot
                  </div>
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-mono px-1 py-0.5 rounded">
                    Evidence Capture
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(v.createdAt || Date.now()).toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                  {v.severity || 'HIGH'}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
