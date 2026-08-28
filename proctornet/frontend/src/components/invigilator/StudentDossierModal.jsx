import React, { useState, useRef, useEffect } from 'react'
import { X, Send, StopCircle, MessageSquare, AlertTriangle, ShieldAlert } from 'lucide-react'
import { WebcamFeed, ScreenFeed } from './StudentGrid'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export default function StudentDossierModal({
  student,
  onClose,
  onWarn,
  onTerminate,
  onOpenLightbox,
  chats = {},
  onSendChat
}) {
  const [customWarning, setCustomWarning] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats, student?.studentId])

  if (!student) return null

  const handleCustomWarningSend = () => {
    if (!customWarning.trim()) return
    onWarn?.(student.studentId || student.id, customWarning.trim())
    setCustomWarning('')
  }

  const handleChatSend = () => {
    if (!chatInput.trim()) return
    onSendChat?.(student.studentId || student.id, chatInput.trim())
    setChatInput('')
  }

  const studentMessages = chats[student.studentId || student.id] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-xs font-sans">
      <div className="bg-card border border-border w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <header className="px-8 py-5 border-b border-border flex justify-between items-center bg-[#f8fafc] dark:bg-neutral-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#eff6ff] border border-[#d5e6fb] rounded-2xl flex items-center justify-center text-primary font-bold text-lg shadow-xs dark:bg-neutral-800 dark:border-neutral-700">
              {student.name?.[0] || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{student.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{student.usn} • {student.department || 'Candidate'}</p>
              {student.faceMatchScore !== null && student.faceMatchScore !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                    student.faceMatchScore < 0.6
                      ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                      : 'bg-[#ecfdf5] border-[#bbf7d0] text-[#166534]'
                  }`}>
                    <span>{student.faceMatchScore < 0.6 ? '⚠' : '✓'}</span>
                    <span>Face Match:</span>
                    <span className="tabular-nums font-semibold">{(student.faceMatchScore * 100).toFixed(1)}%</span>
                  </div>
                  {student.faceMatchScore < 0.6 && (
                    <span className="text-[10px] text-[#b91c1c] font-semibold uppercase tracking-wider">
                      Flagged for Review
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-card hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-border p-2.5 rounded-xl transition-all text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </header>

        {/* Main Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Webcam, Screen Feed, Timeline */}
          <div className="w-full md:w-2/3 p-6 md:p-8 overflow-y-auto space-y-6 border-b md:border-b-0 md:border-r border-border bg-background">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Webcam Feed */}
              <div className="aspect-video bg-neutral-950 rounded-2xl shadow-md overflow-hidden border border-border relative">
                <WebcamFeed
                  studentId={student.studentId || student.id}
                  initialFrame={student.latestFrame}
                  className="w-full h-full object-cover"
                  fallbackSize={48}
                />
                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                  Webcam Stream
                </div>
              </div>

              {/* Screen Feed */}
              <div className="aspect-video bg-neutral-950 rounded-2xl shadow-md overflow-hidden border border-border relative">
                <ScreenFeed
                  studentId={student.studentId || student.id}
                  initialFrame={student.latestScreenFrame}
                  className="w-full h-full object-cover"
                  fallbackSize={48}
                />
                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                  Screen Capture
                </div>
              </div>
            </div>

            {/* Violation Timeline & Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card rounded-2xl p-5 border border-border shadow-xs">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  Violation Timeline
                </h3>
                <div className="space-y-3">
                  {(!student.events || student.events.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-6 font-medium">No recorded violations</p>
                  ) : (
                    student.events.map((ev, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="pb-3 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              ev.severity === 'HIGH' || ev.severity === 'CRITICAL'
                                ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                                : 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                            }`}>
                              {ev.eventType}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-foreground font-sans mb-2">
                            {ev.details || 'Integrity check violation flagged'}
                          </p>

                          {/* Evidence Thumbnails */}
                          <div className="flex gap-2 mt-2">
                            {(ev.cameraFrame || ev.cameraFrameUrl) && (
                              <img
                                src={ev.cameraFrame || ev.cameraFrameUrl}
                                onClick={() => onOpenLightbox?.({
                                  url: ev.cameraFrame || ev.cameraFrameUrl,
                                  title: 'Webcam Evidence Snapshot',
                                  subtitle: `${student.name} (${student.usn})`
                                })}
                                className="w-20 h-14 object-cover rounded-lg border border-border cursor-pointer hover:border-primary transition shadow-xs"
                                alt="Cam snap"
                              />
                            )}
                            {(ev.screenshot || ev.screenshotUrl) && (
                              <img
                                src={ev.screenshot || ev.screenshotUrl}
                                onClick={() => onOpenLightbox?.({
                                  url: ev.screenshot || ev.screenshotUrl,
                                  title: 'Screen Share Evidence Snapshot',
                                  subtitle: `${student.name} (${student.usn})`
                                })}
                                className="w-20 h-14 object-cover rounded-lg border border-border cursor-pointer hover:border-primary transition shadow-xs"
                                alt="Screen snap"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Progress & Actions */}
              <div className="space-y-4">
                <div className="bg-[#eff6ff] border border-[#d5e6fb] rounded-2xl p-5 text-foreground dark:bg-neutral-900 dark:border-neutral-800">
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">Session Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        {student.progress?.answered || 0}/{student.progress?.total || 0}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Answered</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-destructive">{student.flagCount || 0}</div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Total Flags</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowTerminateConfirm(true)}
                  className="w-full py-3.5 bg-destructive hover:bg-destructive/90 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <StopCircle size={18} /> Terminate Student Exam
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Warnings & Live Chat */}
          <div className="w-full md:w-1/3 flex flex-col bg-card border-l border-border">
            {/* Warning dispatch */}
            <div className="p-6 border-b border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Send Candidate Warning
              </h3>
              <div className="space-y-2">
                {['Adjust your camera angle', 'No talking or sound permitted', 'Return to fullscreen immediately', 'Identity verification re-check needed'].map(msg => (
                  <button
                    key={msg}
                    onClick={() => onWarn?.(student.studentId || student.id, msg)}
                    className="w-full text-left px-3.5 py-2.5 bg-[#f8fafc] dark:bg-neutral-900 border border-border rounded-xl text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-[#eff6ff] hover:text-primary transition cursor-pointer"
                  >
                    {msg}
                  </button>
                ))}
                <div className="relative pt-2">
                  <input
                    type="text"
                    value={customWarning}
                    onChange={(e) => setCustomWarning(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCustomWarningSend() }}
                    placeholder="Custom warning notice…"
                    className="w-full bg-card border border-border rounded-xl py-2 pl-3.5 pr-10 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    aria-label="Custom warning text"
                  />
                  <button
                    onClick={handleCustomWarningSend}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 mt-1 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer"
                    aria-label="Send warning"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Timeline */}
            <div className="flex-1 flex flex-col min-h-0 bg-card">
              <div className="px-6 py-3 border-b border-border bg-[#f8fafc] dark:bg-neutral-900">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" /> Live Chat Support
                </h4>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 font-sans">
                {studentMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 font-medium">No chat messages</p>
                ) : (
                  studentMessages.map((msg, idx) => {
                    const isInv = msg.sender === 'invigilator'
                    return (
                      <div key={idx} className={`flex ${isInv ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs ${
                          isInv ? 'bg-primary text-white rounded-br-none' : 'bg-[#f1f5f9] dark:bg-neutral-800 border border-border text-foreground rounded-bl-none'
                        }`}>
                          <p>{msg.message}</p>
                          <span className={`text-[9px] block mt-1 text-right font-medium ${isInv ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-border bg-[#f8fafc] dark:bg-neutral-900">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend() }}
                    placeholder="Reply to candidate…"
                    className="w-full bg-card border border-border rounded-xl py-2 pl-3.5 pr-10 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    aria-label="Chat reply message"
                  />
                  <button
                    onClick={handleChatSend}
                    className="absolute right-1.5 p-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer"
                    aria-label="Send reply"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Destructive Candidate Termination */}
      <ConfirmDialog
        isOpen={showTerminateConfirm}
        title={`Terminate Exam for ${student.name || 'Candidate'}?`}
        description={`Are you certain you wish to terminate candidate USN ${student.usn}? Their active exam interface will be immediately locked and misconduct logged.`}
        confirmText="Yes, Terminate Session"
        cancelText="Keep Candidate Active"
        variant="destructive"
        onConfirm={() => {
          const reason = terminateReason.trim() || 'Exam session terminated by proctor for integrity violation.'
          onTerminate?.(student.studentId || student.id, reason)
          setShowTerminateConfirm(false)
          setTerminateReason('')
        }}
        onClose={() => {
          setShowTerminateConfirm(false)
          setTerminateReason('')
        }}
      >
        <div className="space-y-1.5 mt-2">
          <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Termination Reason (Logged to university records)
          </label>
          <input
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="e.g., Unauthorised secondary device, multiple face alerts..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 transition"
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
