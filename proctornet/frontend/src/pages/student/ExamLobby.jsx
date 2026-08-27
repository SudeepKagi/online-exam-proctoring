import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Clock, Shield, Camera, Wifi, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, UserCheck, BookOpen, Monitor
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
        <div className="p-12 text-center text-xs font-mono text-slate-500">Loading examination lobby environment…</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Exam Lobby">
      <div className="max-w-4xl mx-auto py-6 space-y-6 font-sans">
        {/* Header Hero Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#2f80ed] border border-blue-100 uppercase tracking-wider">
                EXAMINATION ENTRY LOBBY
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
                {exam?.title || 'Examination Lobby'}
              </h1>
              <p className="text-xs font-bold font-mono text-slate-500 mt-1">
                Subject / Course Code: <span className="text-slate-800 font-extrabold">{exam?.subject || exam?.courseCode || 'CS301'}</span>
              </p>
            </div>
            <span className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-50 text-[#10b981] border border-emerald-200 uppercase tracking-wider w-fit">
              {exam?.status || 'PUBLISHED'}
            </span>
          </div>

          {/* Grid: Live Hero Timer & KPI Overview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Live Countdown Hero Timer */}
            <div className="md:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center justify-center shadow-md">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1.5 bg-[#2f80ed]/20 border border-[#2f80ed]/40 text-[#60a5fa]">
                <Clock size={13} />
                {isOver ? 'Exam Status' : timeToStart === 0 ? 'Live Session Open' : 'Countdown to Exam Start'}
              </span>

              {isOver ? (
                <div className="text-2xl font-extrabold font-mono text-rose-400 my-2">EXAM CONCLUDED</div>
              ) : timeToStart === 0 ? (
                <div className="text-3xl font-extrabold font-mono text-[#10b981] my-2 animate-pulse">EXAM IS LIVE NOW</div>
              ) : (
                <div className="text-4xl font-extrabold font-mono text-white tracking-widest my-2 select-none">
                  {formatCountdown(timeToStart)}
                </div>
              )}

              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {isOver
                  ? 'This examination session has ended.'
                  : timeToStart === 0
                  ? 'System security gate is open for student check-in.'
                  : 'Automatic unlock when timer reaches 00:00:00'}
              </p>
            </div>

            {/* 4 Metric KPI Cards */}
            <div className="md:col-span-6 grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Duration</span>
                <p className="text-xl font-extrabold text-slate-900">{exam?.duration || 90} mins</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Allocated Time</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Total Marks</span>
                <p className="text-xl font-extrabold text-[#2f80ed]">{exam?.totalMarks || 100} pts</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Maximum Score</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Start Time</span>
                <p className="text-xs font-extrabold font-mono text-slate-900 truncate mt-1">
                  {exam?.startTime ? new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 AM'}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Session Unlock</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 text-left">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">End Time</span>
                <p className="text-xs font-extrabold font-mono text-slate-900 truncate mt-1">
                  {exam?.endTime ? new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '01:00 AM'}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Final Deadline</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Protocol Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#2f80ed] flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Automated Security Pre-Check Protocol
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Standard AI invigilation controls enforced for this examination.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 flex items-center gap-3 font-bold text-xs text-slate-800">
              <Camera size={18} className="text-[#2f80ed] shrink-0" />
              <span>Continuous AI Face Proctoring</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 flex items-center gap-3 font-bold text-xs text-slate-800">
              <Monitor size={18} className="text-[#2f80ed] shrink-0" />
              <span>Screen Sharing & Kiosk Lock</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 flex items-center gap-3 font-bold text-xs text-slate-800">
              <Wifi size={18} className="text-[#2f80ed] shrink-0" />
              <span>WireGuard System Audit</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-5">
            {/* Optional Pre-check Subordinate Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 gap-3">
              <div className="text-xs">
                <span className="font-extrabold text-slate-900">Optional Device Check: </span>
                <span className="text-slate-600 font-medium">Test camera, display stream, and local device readiness before entering the exam.</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/student/device-check/${examId}`)}
                className="px-4 py-2 text-xs font-extrabold text-[#2f80ed] hover:bg-blue-50 border border-blue-200 rounded-xl transition-all shrink-0 cursor-pointer"
              >
                Run Device Diagnostic →
              </button>
            </div>

            {/* Primary Guided Action Button */}
            <div className="flex flex-col items-center justify-center pt-2 gap-2.5">
              {exam?.isSubmitted || exam?.studentStatus === 'SUBMITTED' ? (
                <div className="w-full p-6 rounded-2xl bg-[#ecfdf5] border-2 border-[#a7f3d0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#10b981] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Examination Already Submitted</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        You have already attended and finalized this examination. Re-entry is strictly prohibited.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/student/results')}
                    className="w-full sm:w-auto text-xs font-extrabold px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl cursor-pointer shadow-xs"
                  >
                    View My Results <ArrowRight size={14} className="inline ml-1.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    disabled={isOver || timeToStart > 0}
                    onClick={() => navigate(`/student/exams/${examId}/security`)}
                    className={`w-full sm:w-96 py-4 text-xs font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isOver || timeToStart > 0
                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-[#2f80ed] hover:bg-[#2563eb] text-white shadow-blue-200 hover:shadow-lg'
                    }`}
                  >
                    {isOver
                      ? 'Exam Concluded'
                      : timeToStart > 0
                      ? `Waiting for Start Window (${formatCountdown(timeToStart)})`
                      : 'Start Automated Security Check'}
                    {!isOver && timeToStart === 0 && <ArrowRight size={16} />}
                  </button>
                  {timeToStart > 0 && !isOver && (
                    <span className="text-xs font-bold text-amber-600 text-center">
                      Security check unlocks automatically when countdown reaches zero
                    </span>
                  )}
                  {isOver && (
                    <span className="text-xs font-bold text-rose-500 text-center">
                      This examination session has ended and is closed for entry
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
