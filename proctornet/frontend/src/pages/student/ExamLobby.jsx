import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Clock, Shield, Camera, Wifi, CheckCircle2, AlertTriangle,
  ArrowRight, ArrowLeft, RefreshCw, UserCheck, BookOpen, Monitor
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ExamLobby() {
  const { id: examId } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeToStart, setTimeToStart] = useState(0)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    loadExam()
  }, [examId])

  const loadExam = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/student/exams/${examId}`)
      const e = res.data.exam || res.data
      setExam(e)

      const now = new Date().getTime()
      const start = new Date(e.startTime).getTime()
      const end = new Date(e.endTime).getTime()

      if (now > end) {
        setIsOver(true)
      } else {
        setTimeToStart(Math.max(0, Math.floor((start - now) / 1000)))
      }
    } catch {
      toast.error('Failed to load exam details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (timeToStart <= 0) return
    const timer = setInterval(() => {
      setTimeToStart(t => {
        if (t <= 1) {
          clearInterval(timer)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeToStart])

  const formatCountdown = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <DashboardLayout title="Exam Lobby">
        <div className="max-w-4xl mx-auto py-12 space-y-6">
          <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      </DashboardLayout>
    )
  }

  if (!exam) {
    return (
      <DashboardLayout title="Exam Lobby">
        <div className="max-w-md mx-auto py-20 px-4 text-center">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Examination Not Found</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            The assessment lobby could not be loaded. The exam might be unpublished, concluded, or not assigned to your student profile.
          </p>
          <Link
            to="/student/exams"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <ArrowLeft size={16} /> Return to Examination List
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Exam Lobby">
      <div className="max-w-4xl mx-auto py-6 space-y-6 font-sans">
        {/* Header Hero Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2f80ed] border border-blue-100 uppercase tracking-wider">
                EXAMINATION ENTRY LOBBY
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
                {exam?.title || 'Examination Lobby'}
              </h1>
              <p className="text-xs font-normal text-slate-500 mt-1">
                Subject / Course Code: <span className="text-slate-800 font-medium">{exam?.subject || exam?.courseCode || 'CS301'}</span>
              </p>
            </div>
            <span className="px-4 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#10b981] border border-emerald-200 uppercase tracking-wider w-fit">
              {exam?.status || 'PUBLISHED'}
            </span>
          </div>

          {/* Grid: Live Hero Timer & KPI Overview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Live Countdown Hero Timer */}
            <div className="md:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 bg-[#2f80ed]/20 border border-[#2f80ed]/40 text-[#60a5fa]">
                <Clock size={13} />
                {isOver
                  ? 'Exam Status'
                  : timeToStart === 0
                  ? 'Live Session Open'
                  : timeToStart <= 300
                  ? 'Early Pre-Check Window Open'
                  : 'Countdown to Exam Start'}
              </span>

              {isOver ? (
                <div className="text-2xl font-bold font-mono text-rose-400 my-2">EXAM CONCLUDED</div>
              ) : timeToStart === 0 ? (
                <div className="text-2xl font-bold font-mono text-[#10b981] my-2 animate-pulse">EXAM IS LIVE NOW</div>
              ) : (
                <div className="text-4xl font-bold font-mono text-white tracking-widest my-2 select-none">
                  {formatCountdown(timeToStart)}
                </div>
              )}

              <p className="text-[11px] text-slate-400 font-normal mt-1">
                {isOver
                  ? 'This examination session has ended.'
                  : timeToStart === 0
                  ? 'System security gate is open for student check-in.'
                  : timeToStart <= 300
                  ? 'Early security verification is active. Complete your WireGuard & hardware check now.'
                  : 'Early security check unlocks 5 minutes before scheduled start time.'}
              </p>
            </div>

            {/* 4 Metric KPI Cards */}
            <div className="md:col-span-6 grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 text-left">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Duration</span>
                <p className="text-xl font-bold text-slate-900">{exam?.duration || 90} mins</p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Allocated Time</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 text-left">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Total Marks</span>
                <p className="text-xl font-bold text-[#2f80ed]">{exam?.totalMarks || 100} pts</p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Maximum Score</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 text-left">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Start Time</span>
                <p className="text-xs font-semibold font-mono text-slate-900 truncate mt-1">
                  {exam?.startTime ? new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 AM'}
                </p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Session Unlock</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 text-left">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">End Time</span>
                <p className="text-xs font-semibold font-mono text-slate-900 truncate mt-1">
                  {exam?.endTime ? new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '01:00 AM'}
                </p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Final Deadline</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Protocol Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#2f80ed] flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Automated Security Pre-Check Protocol
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Standard AI invigilation controls enforced for this examination.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 flex items-center gap-3 font-medium text-xs text-slate-800">
              <Camera size={18} className="text-[#2f80ed] shrink-0" />
              <span>Continuous AI Face Proctoring</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 flex items-center gap-3 font-medium text-xs text-slate-800">
              <Monitor size={18} className="text-[#2f80ed] shrink-0" />
              <span>Screen Sharing & Kiosk Lock</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50/75 border border-slate-200 flex items-center gap-3 font-medium text-xs text-slate-800">
              <Wifi size={18} className="text-[#2f80ed] shrink-0" />
              <span>WireGuard System Audit</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-5">
            {/* Optional Pre-check Subordinate Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50/75 border border-slate-200 gap-3">
              <div className="text-xs">
                <span className="font-medium text-slate-900">Optional Device Diagnostic: </span>
                <span className="text-slate-600 font-normal">Pre-test camera, display stream, and local agent before the security check opens.</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/student/device-check/${examId}`)}
                className="px-4 py-2 text-xs font-semibold text-[#2f80ed] hover:bg-blue-50 border border-blue-200 rounded-xl transition-all shrink-0 cursor-pointer"
              >
                Run Device Diagnostic →
              </button>
            </div>

            {/* Primary Guided Action Button */}
            <div className="flex flex-col items-center justify-center pt-2 gap-2.5">
              {exam?.isSubmitted || exam?.studentStatus === 'SUBMITTED' ? (
                <div className="w-full p-6 rounded-2xl bg-[#ecfdf5] border-2 border-[#a7f3d0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#10b981] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Examination Already Submitted</h3>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        You have already attended and finalized this examination. Re-entry is strictly prohibited.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/student/results')}
                    className="w-full sm:w-auto text-xs font-semibold px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl cursor-pointer shadow-xs"
                  >
                    View My Results <ArrowRight size={14} className="inline ml-1.5" />
                  </button>
                </div>
              ) : (
                <>
                  {(() => {
                    const EARLY_CHECK_SECONDS = 300 // 5 minutes prior
                    const canStartSecurityCheck = !isOver && timeToStart <= EARLY_CHECK_SECONDS
                    const secsUntilEarlyCheck = Math.max(0, timeToStart - EARLY_CHECK_SECONDS)

                    return (
                      <>
                        <button
                          disabled={isOver || !canStartSecurityCheck}
                          onClick={() => navigate(`/student/exams/${examId}/security`)}
                          className={`w-full sm:w-96 py-3.5 text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isOver || !canStartSecurityCheck
                              ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-[#2f80ed] hover:bg-[#2563eb] text-white shadow-blue-200 hover:shadow-md'
                          }`}
                        >
                          {isOver
                            ? 'Exam Concluded'
                            : !canStartSecurityCheck
                            ? `Security Check Opens in ${formatCountdown(secsUntilEarlyCheck)}`
                            : timeToStart > 0
                            ? `Proceed to Pre-Exam Security Check (${formatCountdown(timeToStart)} to start)`
                            : 'Start Automated Security Check'}
                          {!isOver && canStartSecurityCheck && <ArrowRight size={16} />}
                        </button>

                        {!isOver && canStartSecurityCheck && timeToStart > 0 && (
                          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Early Checkup Window Open (5 mins prior): Setup WireGuard & complete verification early!
                          </div>
                        )}

                        {!isOver && !canStartSecurityCheck && (
                          <span className="text-xs font-bold text-amber-600 text-center">
                            Security checkup unlocks 5 minutes before exam start time ({formatCountdown(secsUntilEarlyCheck)} remaining)
                          </span>
                        )}

                        {isOver && (
                          <span className="text-xs font-bold text-rose-500 text-center">
                            This examination session has ended and is closed for entry
                          </span>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
