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
            <div className="p-3 bg-[#edecfb]/60 rounded-xl flex justify-between items-center text-xs">
              <span className="font-[420] text-[#28253b]">Attempt Status:</span>
              <Badge variant="outline" className="border-0 bg-white text-[#5266eb] font-mono text-[11px]">
                {candidate.attemptStatus}
              </Badge>
            </div>

            {/* Phase 2 A.4: Identity Check Section (Separated from violation stream) */}
            <div className="p-3 bg-[#fbfbff] rounded-xl border border-[#e9eaf2]/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Identity Check
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono border-0 ${
                    faceStatus === 'MATCH' || candidate.faceVerified || candidate.invigilatorApproved
                      ? 'bg-[#edecfb] text-[#5266eb]'
                      : faceStatus === 'PENDING_APPROVAL'
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
              {candidate.facePhotoKey && (
                <div className="pt-1 flex items-center gap-2">
                  <div
                    onClick={() => setModalImage({ url: candidate.facePhotoKey, title: `${candidate.studentName} — Identity Photo` })}
                    className="w-14 h-14 rounded-lg overflow-hidden border border-[#e9eaf2] bg-[#fbfcfd] cursor-pointer hover:opacity-90 relative group"
                  >
                    <img src={candidate.facePhotoKey} alt="Pre-check identity" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>
                  <span className="text-[10px] text-[#554e7b]">Pre-check still photograph</span>
                </div>
              )}

              {/* Manual Identity Approval Actions for Invigilators */}
              {needsIdentityApproval && onApproveIdentity && !isFinalized && (
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => onApproveIdentity(candidate)}
                    className="h-8 text-xs font-[420] rounded-[32px] bg-[#5266eb] hover:bg-[#4353c7] text-white border-0"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve Identity
                  </Button>
                  {onRejectIdentity && (
                    <Button
                      size="sm"
                      disabled={actionLoading}
                      variant="outline"
                      onClick={() => onRejectIdentity(candidate)}
                      className="h-8 text-xs font-[420] rounded-[32px] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-0"
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Suspend / Resume controls */}
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

            {!isFinalized && onTerminate && (
              <Button
                onClick={() => onTerminate(candidate)}
                disabled={actionLoading || !candidate.attemptId}
                className="w-full text-xs h-9 rounded-[32px] bg-[#28253b] hover:bg-[#1f1d2e] text-white border-0 font-[420] shadow-xs cursor-pointer"
              >
                Terminate Attempt Access
              </Button>
            )}

            {/* Phase 2 B.4: Violation Timeline with Screenshots */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-[480] text-[#554e7b] uppercase tracking-wider">
                Violation Timeline ({auditHistory.length})
              </h4>
              {auditHistory.length === 0 ? (
                <p className="text-xs text-[#554e7b] text-center py-4">No violations logged.</p>
              ) : (
                <div className="space-y-2">
                  {auditHistory.map((l, idx) => {
                    const snapUrl = l.metadata?.snapshotDataUrl || (l.evidenceS3Key?.startsWith('data:') ? l.evidenceS3Key : null)
                    const s3Key = l.evidenceS3Key || l.evidenceKey

                    return (
                      <div
                        key={l.id ? `audit-${l.id}` : `audit-idx-${idx}`}
                        className="p-2.5 rounded-lg border border-[#e9eaf2]/70 bg-[#fbfbff] text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center font-[420]">
                          <span className="text-[#28253b]">{formatViolationType(l.eventType)}</span>
                          <Badge
                            variant="outline"
                            className="border-0 bg-[#edecfb] text-[#554e7b] font-mono text-[10px]"
                          >
                            {l.severity}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#554e7b] font-mono">
                          <span>{new Date(l.createdAt || Date.now()).toLocaleTimeString()}</span>
                          {snapUrl ? (
                            <button
                              type="button"
                              onClick={() => setModalImage({ url: snapUrl, title: `${formatViolationType(l.eventType)} Screenshot` })}
                              className="inline-flex items-center gap-1 text-[#5266eb] hover:underline cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3" /> View Screenshot
                            </button>
                          ) : s3Key ? (
                            <span className="text-[#554e7b]">Evidence logged</span>
                          ) : (
                            <span className="text-[#70707d]">Metadata only</span>
                          )}
                        </div>

                        {snapUrl && (
                          <div
                            onClick={() => setModalImage({ url: snapUrl, title: `${formatViolationType(l.eventType)} Screenshot` })}
                            className="aspect-video w-full rounded overflow-hidden border border-[#e9eaf2] bg-[#fbfcfd] cursor-pointer hover:opacity-90 relative group mt-1"
                          >
                            <img src={snapUrl} alt="Violation frame" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-[11px]">
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
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#edecfb] text-[#28253b] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-[#fbfcfd] flex items-center justify-center max-h-[70vh] overflow-auto">
              <img src={modalImage.url} alt="Full frame" className="max-w-full h-auto rounded-lg shadow-inner" />
            </div>
            <div className="p-3 text-right bg-[#fbfbff] border-t border-[#e9eaf2]">
              <Button
                size="sm"
                onClick={() => setModalImage(null)}
                className="h-8 px-4 text-xs font-[420] rounded-[32px] bg-[#5266eb] hover:bg-[#4353c7] text-white border-0"
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
