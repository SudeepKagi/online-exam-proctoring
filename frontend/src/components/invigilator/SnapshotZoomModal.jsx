import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, X, Maximize2 } from 'lucide-react'

export default function SnapshotZoomModal({ isOpen, onClose, snapshot }) {
  if (!snapshot) return null

  const handleDownload = () => {
    if (!snapshot.snapshotDataUrl) return
    const a = document.createElement('a')
    a.href = snapshot.snapshotDataUrl
    a.download = `violation_${snapshot.studentName || 'candidate'}_${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-zinc-950 text-zinc-100 border-zinc-800 font-sans">
        <DialogHeader className="p-4 bg-zinc-900 border-b border-zinc-800 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DialogTitle className="text-sm font-bold text-zinc-100">
                Screen Snapshot Audit — {snapshot.studentName} ({snapshot.institutionId || '—'})
              </DialogTitle>
              <Badge variant="destructive" className="text-[10px] uppercase font-mono">
                {snapshot.eventType || 'VIOLATION'}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Captured at {new Date(snapshot.createdAt || Date.now()).toLocaleTimeString()} ({new Date(snapshot.createdAt || Date.now()).toLocaleDateString()})
            </DialogDescription>
          </div>
          <div className="flex items-center space-x-2">
            {snapshot.snapshotDataUrl && (
              <Button size="sm" variant="outline" onClick={handleDownload} className="text-xs gap-1 bg-zinc-800 border-zinc-700 text-zinc-200">
                <Download className="w-3.5 h-3.5" /> Download Snapshot
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-4 bg-black flex items-center justify-center min-h-[360px] max-h-[75vh] overflow-auto">
          {snapshot.snapshotDataUrl ? (
            <img
              src={snapshot.snapshotDataUrl}
              alt="Screen Snapshot Evidence"
              className="max-w-full max-h-[70vh] object-contain rounded-md border border-zinc-800 shadow-2xl"
            />
          ) : (
            <div className="text-zinc-500 text-xs text-center py-12">
              No screen image data attached to this violation event.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
