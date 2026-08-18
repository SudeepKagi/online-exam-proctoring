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
      <div className="max-w-4xl mx-auto py-4 space-y-5 font-sans">
        {/* Header Card */}
        <Card className="bg-[#141416] border-[#27272A] p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-100">{exam?.title || 'Examination Lobby'}</h1>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Subject / Course: {exam?.subject || exam?.courseCode || 'CS301'}</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-indigo-400 border-indigo-500/30 bg-indigo-500/10 w-fit">
              {exam?.status || 'SCHEDULED'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timer Block */}
            <div className="p-5 bg-[#09090B] border border-[#27272A] rounded-2xl text-center flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-400" /> {isOver ? 'Exam Status' : timeToStart === 0 ? 'Exam is Live' : 'Countdown to Exam Start'}
              </span>
              {isOver ? (
                <div className="text-2xl font-mono font-bold text-rose-500">EXAM CONCLUDED</div>
              ) : timeToStart === 0 ? (
                <div className="text-2xl font-mono font-bold text-emerald-400">EXAM IS LIVE</div>
              ) : (
                <div className="text-3xl font-mono font-bold text-slate-100">{formatCountdown(timeToStart)}</div>
              )}
            </div>

            {/* Overview Details */}
            <div className="p-4 bg-[#09090B] border border-[#27272A] rounded-2xl grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500">Duration:</span>
                <p className="font-bold text-slate-200 mt-0.5">{exam?.duration || 90} mins</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Total Marks:</span>
                <p className="font-bold text-slate-200 mt-0.5">{exam?.totalMarks || 100} pts</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Start Time:</span>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{new Date(exam?.startTime).toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">End Time:</span>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{new Date(exam?.endTime).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Security Protocol Section */}
        <Card className="bg-[#141416] border-[#27272A] p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" /> Automated Security Pre-Check Protocol
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center gap-2.5">
              <Camera size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">Continuous AI Face Proctoring</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center gap-2.5">
              <Monitor size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">Screen Sharing & Fullscreen Kiosk</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center gap-2.5">
              <Wifi size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">System & Network Audit</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/student/device-check/${examId}`)}
              className="w-full sm:w-auto text-xs font-mono border-[#27272A] bg-[#09090B] text-slate-300 hover:bg-[#18181B]"
            >
              Run Pre-Exam Device Diagnostic (Recommended)
            </Button>
            <div className="flex flex-col sm:items-end w-full sm:w-auto gap-1">
              <Button
                disabled={isOver || timeToStart > 0}
                onClick={() => navigate(`/student/exams/${examId}/security`)}
                className={`w-full sm:w-auto text-xs font-mono font-bold px-7 h-10 rounded-xl shadow-lg transition-all ${
                  isOver || timeToStart > 0
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                {isOver
                  ? 'Exam Concluded'
                  : timeToStart > 0
                  ? `Waiting for Start Window (${formatCountdown(timeToStart)})`
                  : 'Start Automated Security Check'}
                {!isOver && timeToStart === 0 && <ArrowRight size={14} className="ml-2" />}
              </Button>
              {timeToStart > 0 && !isOver && (
                <span className="text-[10px] font-mono text-amber-400/80 text-center sm:text-right">
                  Security check unlocks when countdown reaches zero
                </span>
              )}
              {isOver && (
                <span className="text-[10px] font-mono text-rose-400 text-center sm:text-right">
                  This examination session has ended and is closed for entry
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
