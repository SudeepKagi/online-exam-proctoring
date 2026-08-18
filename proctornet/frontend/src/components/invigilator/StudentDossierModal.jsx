import React, { useState, useRef, useEffect } from 'react'
import { X, Send, StopCircle, MessageSquare, AlertTriangle } from 'lucide-react'
import { WebcamFeed, ScreenFeed } from './StudentGrid'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-[#09090B]/85 backdrop-blur-md font-sans">
      <div className="bg-[#141416] border border-[#27272A] w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <header className="px-8 py-5 border-b border-[#27272A] flex justify-between items-center bg-[#09090B]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 font-mono font-bold text-lg">
              {student.name?.[0] || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{student.name}</h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{student.usn} • {student.department || 'Candidate'}</p>
              {student.faceMatchScore !== null && student.faceMatchScore !== undefined && (
                <div className="mt-2 flex items-center gap-2 font-mono">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border ${
                    student.faceMatchScore < 0.6
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    <span>{student.faceMatchScore < 0.6 ? '⚠' : '✓'}</span>
                    <span>Face Match:</span>
                    <span className="tabular-nums font-bold">{(student.faceMatchScore * 100).toFixed(1)}%</span>
                  </div>
                  {student.faceMatchScore < 0.6 && (
                    <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                      Flagged for Review
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-[#09090B] hover:bg-[#18181B] border border-[#27272A] p-2.5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        {/* Main Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Webcam, Screen Feed, Timeline */}
          <div className="w-full md:w-2/3 p-6 md:p-8 overflow-y-auto space-y-6 border-b md:border-b-0 md:border-r border-[#27272A] bg-[#09090B]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Webcam Feed */}
              <div className="aspect-video bg-[#141416] rounded-2xl shadow-xl overflow-hidden border border-[#27272A] relative">
                <WebcamFeed
                  studentId={student.studentId || student.id}
                  initialFrame={student.latestFrame}
                  className="w-full h-full object-cover"
                  fallbackSize={48}
                />
                <div className="absolute bottom-3 right-3 bg-[#09090B]/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider border border-[#27272A]">
                  Webcam Stream
                </div>
              </div>

              {/* Screen Feed */}
              <div className="aspect-video bg-[#141416] rounded-2xl shadow-xl overflow-hidden border border-[#27272A] relative">
                <ScreenFeed
                  studentId={student.studentId || student.id}
                  initialFrame={student.latestScreenFrame}
                  className="w-full h-full object-cover"
                  fallbackSize={48}
                />
                <div className="absolute bottom-3 right-3 bg-[#09090B]/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider border border-[#27272A]">
                  Screen Capture
                </div>
              </div>
            </div>

            {/* Violation Timeline & Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#141416] rounded-2xl p-5 border border-[#27272A]">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Violation Timeline
                </h3>
                <div className="space-y-3 font-mono">
                  {(!student.events || student.events.length === 0) ? (
                    <p className="text-xs text-slate-500 text-center py-6">No recorded violations</p>
                  ) : (
                    student.events.map((ev, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="pb-3 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                              ev.severity === 'HIGH' || ev.severity === 'CRITICAL'
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            }`}>
                              {ev.eventType}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-sans mb-2">
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
                                className="w-20 h-14 object-cover rounded-lg border border-[#27272A] cursor-pointer hover:border-indigo-500 transition"
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
                                className="w-20 h-14 object-cover rounded-lg border border-[#27272A] cursor-pointer hover:border-indigo-500 transition"
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
                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 text-slate-100 font-mono">
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-3">Session Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-bold text-slate-100">
                        {student.progress?.answered || 0}/{student.progress?.total || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Answered</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-rose-400">{student.flagCount || 0}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Total Flags</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onTerminate?.(student.studentId || student.id)}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-mono font-bold text-sm shadow-xl shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <StopCircle size={18} /> Terminate Student Exam
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Warnings & Live Chat */}
          <div className="w-full md:w-1/3 flex flex-col bg-[#141416]">
            {/* Warning dispatch */}
            <div className="p-6 border-b border-[#27272A]">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
                Send Candidate Warning
              </h3>
              <div className="space-y-2 font-mono">
                {['Adjust your camera angle', 'No talking or sound permitted', 'Return to fullscreen immediately', 'Identity verification re-check needed'].map(msg => (
                  <button
                    key={msg}
                    onClick={() => onWarn?.(student.studentId || student.id, msg)}
                    className="w-full text-left px-3.5 py-2.5 bg-[#09090B] border border-[#27272A] rounded-xl text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-indigo-400 transition"
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
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl py-2 pl-3 pr-10 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCustomWarningSend}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 mt-1 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Timeline */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#141416]">
              <div className="px-6 py-3 border-b border-[#27272A] bg-[#09090B]">
                <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={13} className="text-indigo-400" /> Live Chat Support
                </h4>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 font-sans">
                {studentMessages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8 font-mono">No chat messages</p>
                ) : (
                  studentMessages.map((msg, idx) => {
                    const isInv = msg.sender === 'invigilator'
                    return (
                      <div key={idx} className={`flex ${isInv ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs ${
                          isInv ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#09090B] border border-[#27272A] text-slate-200 rounded-bl-none'
                        }`}>
                          <p>{msg.message}</p>
                          <span className={`text-[9px] font-mono block mt-1 text-right ${isInv ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-[#27272A] bg-[#09090B]">
                <div className="relative flex items-center font-mono">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend() }}
                    placeholder="Reply to candidate…"
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl py-2 pl-3 pr-10 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleChatSend}
                    className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
