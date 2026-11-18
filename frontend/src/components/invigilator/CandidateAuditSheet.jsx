import React, { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatViolationType } from '@/shared/violationTypes'
import { ShieldCheck, ShieldAlert, CheckCircle, XCircle, Maximize2, X, Image as ImageIcon } from 'lucide-react'

export default function CandidateAuditSheet({
  isOpen,
  onClose,
  candidate,
  auditHistory = [],
  onToggleSuspend,
  onTerminate,
  onApproveIdentity,
  onRejectIdentity,
  actionLoading
}) {
  const [modalImage, setModalImage] = useState(null)
  if (!candidate) return null

  // Phase 2 C.1: Only explicit terminal states finalize an attempt (never violation count)
  const isFinalized = ['SUBMITTED', 'TIMED_OUT', 'TERMINATED'].includes(candidate.attemptStatus)
  const faceStatus = candidate.faceStatus || (candidate.faceVerified ? 'MATCH' : 'NOT_VERIFIED')
  const needsIdentityApproval = faceStatus === 'PENDING_APPROVAL' || (!candidate.faceVerified && faceStatus !== 'MATCH')

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-md overflow-y-auto font-sans bg-white border-0 shadow-xl">
          <SheetHeader>
            <SheetTitle className="text-sm font-[480] text-[#28253b]">{candidate.studentName}</SheetTitle>
            <SheetDescription className="text-xs text-[#554e7b]">
              USN: {candidate.institutionId || '—'} • Telemetry & Security Audit Sheet
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Attempt Status Banner */}
            <div className="p-3.5 bg-[#edecfb]/70 rounded-[14px] flex justify-between items-center text-xs">
              <span className="font-[420] text-[#28253b]">Attempt Status:</span>
              <Badge variant="outline" className="border-0 bg-white text-[#5266eb] font-mono text-[11px] px-2.5 py-0.5 rounded-[20px]">
                {candidate.attemptStatus}
              </Badge>
            </div>

            {/* Identity Check Section */}
            <div className="p-3.5 bg-[#fbfbff] rounded-[14px] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Identity Verification
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono border-0 rounded-[20px] px-2 py-0.5 ${
                    faceStatus === 'MATCH' || candidate.faceVerified || candidate.invigilatorApproved
                      ? 'bg-[#edecfb] text-[#5266eb]'
                      : faceStatus === 'PENDING_APPROVAL' || faceStatus === 'NO_REFERENCE'
                      ? 'bg-[#edecfb] text-[#28253b]'
                      : 'bg-[#edecfb]/80 text-[#554e7b]'
                  }`}
                >
                  {faceStatus === 'MATCH' ? 'VERIFIED MATCH' : faceStatus}
                </Badge>
              </div>

              {candidate.similarityBucket && (
                <p className="text-[11px] text-[#554e7b]">
                  Confidence: <span className="font-mono text-[#28253b]">{candidate.similarityBucket}</span>
                </p>
              )}

              {/* Photo preview if available */}
              {(candidate.facePhotoKey || candidate.photoUrl || candidate.latestSnapshotUrl) && (
                <div className="pt-1 flex items-center gap-3">
                  <div
                    onClick={() => setModalImage({
                      url: candidate.facePhotoKey || candidate.photoUrl || candidate.latestSnapshotUrl,
                      title: `${candidate.studentName} — Verification Still Photo`
                    })}
                    className="w-16 h-16 rounded-[12px] overflow-hidden bg-[#fbfcfd] cursor-pointer hover:opacity-90 relative group shadow-xs"
                  >
                    <img
                      src={candidate.facePhotoKey || candidate.photoUrl || candidate.latestSnapshotUrl}
                      alt="Pre-check identity"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-[420] text-[#28253b] block">Pre-check photograph</span>
                    <span className="text-[10px] text-[#554e7b] font-[360] block">Captured at session verification</span>
                  </div>
                </div>
              )}

              {/* Manual Identity Approval Actions for Invigilators */}
              {needsIdentityApproval && onApproveIdentity && !isFinalized && (
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => onApproveIdentity(candidate)}
                    className="h-8 text-xs font-[420] rounded-[40px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve Identity
                  </Button>
                  {onRejectIdentity && (
                    <Button
                      size="sm"
                      disabled={actionLoading}
                      variant="outline"
                      onClick={() => onRejectIdentity(candidate)}
                      className="h-8 text-xs font-[420] rounded-[40px]"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Suspend / Resume controls */}
            <Button
              onClick={() => onToggleSuspend(candidate)}
              disabled={actionLoading || !candidate.attemptId || isFinalized}
              variant={candidate.attemptStatus === 'SUSPENDED' ? 'primary' : 'secondary'}
              className="w-full text-xs h-9 font-[420] rounded-[40px]"
            >
              {isFinalized
                ? 'Attempt Finalized (Read Only)'
                : candidate.attemptStatus === 'SUSPENDED'
                ? 'Resume Attempt Access'
                : 'Suspend Attempt Access'}
            </Button>

            {!isFinalized && onTerminate && (
              <Button
                onClick={() => onTerminate(candidate)}
                disabled={actionLoading || !candidate.attemptId}
                variant="destructive"
                className="w-full text-xs h-9 font-[420] rounded-[40px] cursor-pointer"
              >
                Terminate Attempt Access
              </Button>
            )}

            {/* Violation Timeline with Screenshots */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-[480] text-[#554e7b] uppercase tracking-wider">
                Violation Timeline ({auditHistory.length})
              </h4>
              {auditHistory.length === 0 ? (
                <p className="text-xs text-[#554e7b] text-center py-4 font-[360]">No violations logged.</p>
              ) : (
                <div className="space-y-2">
                  {auditHistory.map((l, idx) => {
                    const snapUrl = l.metadata?.snapshotDataUrl || (l.evidenceS3Key?.startsWith('data:') ? l.evidenceS3Key : null)
                    const s3Key = l.evidenceS3Key || l.evidenceKey

                    return (
                      <div
                        key={l.id ? `audit-${l.id}` : `audit-idx-${idx}`}
                        className="p-3 rounded-[12px] bg-[#fbfbff] text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center font-[420]">
                          <span className="text-[#28253b]">{formatViolationType(l.eventType)}</span>
                          <Badge
                            variant="outline"
                            className="border-0 bg-[#edecfb] text-[#554e7b] font-mono text-[10px] rounded-[20px]"
                          >
                            {l.severity}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#554e7b] font-mono">
                          <span>{new Date(l.createdAt || Date.now()).toLocaleTimeString()}</span>
                          {snapUrl ? (
                            <Button
                              type="button"
                              variant="link"
                              size="xs"
                              onClick={() => setModalImage({ url: snapUrl, title: `${formatViolationType(l.eventType)} Screenshot` })}
                            >
                              <ImageIcon className="w-3 h-3" /> View Screenshot
                            </Button>
                          ) : s3Key ? (
                            <span className="text-[#554e7b]">Evidence logged</span>
                          ) : (
                            <span className="text-[#70707d]">Metadata only</span>
                          )}
                        </div>

                        {snapUrl && (
                          <div
                            onClick={() => setModalImage({ url: snapUrl, title: `${formatViolationType(l.eventType)} Screenshot` })}
                            className="aspect-video w-full rounded-[10px] overflow-hidden bg-black/5 cursor-pointer hover:opacity-90 relative group mt-1"
                          >
                            <img src={snapUrl} alt="Violation frame" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-[11px] font-[420]">
                              <Maximize2 className="w-3.5 h-3.5 mr-1" /> Expand
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fullscreen Screenshot Modal */}
      {modalImage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] max-w-2xl w-full overflow-hidden shadow-2xl border-0">
            <div className="flex items-center justify-between p-3.5 bg-[#fbfbff] border-b border-[#e9eaf2]">
              <span className="text-xs font-[480] text-[#28253b]">{modalImage.title}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setModalImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-3 bg-[#fbfcfd] flex items-center justify-center max-h-[70vh] overflow-auto">
              <img src={modalImage.url} alt="Full frame" className="max-w-full h-auto rounded-lg shadow-inner" />
            </div>
            <div className="p-3 text-right bg-[#fbfbff] border-t border-[#e9eaf2]">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setModalImage(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
