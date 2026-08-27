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
        <Card className="bg-card border-border p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">{exam?.title || 'Examination Lobby'}</h1>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Subject / Course: {exam?.subject || exam?.courseCode || 'CS301'}</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/10 w-fit">
              {exam?.status || 'SCHEDULED'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timer Block */}
            <div className="p-5 bg-background border border-border rounded-2xl text-center flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock size={13} className="text-primary" /> {isOver ? 'Exam Status' : timeToStart === 0 ? 'Exam is Live' : 'Countdown to Exam Start'}
              </span>
              {isOver ? (
                <div className="text-2xl font-mono font-bold text-rose-500">EXAM CONCLUDED</div>
              ) : timeToStart === 0 ? (
                <div className="text-2xl font-mono font-bold text-emerald-400">EXAM IS LIVE</div>
              ) : (
                <div className="text-3xl font-mono font-bold text-foreground">{formatCountdown(timeToStart)}</div>
              )}
            </div>

            {/* Overview Details */}
            <div className="p-4 bg-background border border-border rounded-2xl grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500">Duration:</span>
                <p className="font-bold text-foreground mt-0.5">{exam?.duration || 90} mins</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Total Marks:</span>
                <p className="font-bold text-foreground mt-0.5">{exam?.totalMarks || 100} pts</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Start Time:</span>
                <p className="text-[11px] text-foreground/90 truncate mt-0.5">{new Date(exam?.startTime).toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">End Time:</span>
                <p className="text-[11px] text-foreground/90 truncate mt-0.5">{new Date(exam?.endTime).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Security Protocol Section */}
        <Card className="bg-card border-border p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Automated Security Pre-Check Protocol
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-background border border-border flex items-center gap-2.5">
              <Camera size={16} className="text-primary shrink-0" />
              <span className="text-foreground/90">Continuous AI Face Proctoring</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-background border border-border flex items-center gap-2.5">
              <Monitor size={16} className="text-primary shrink-0" />
              <span className="text-foreground/90">Screen Sharing & Fullscreen Kiosk</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-background border border-border flex items-center gap-2.5">
              <Wifi size={16} className="text-primary shrink-0" />
              <span className="text-foreground/90">System & Network Audit</span>
            </div>
          </div>

          <div className="pt-5 border-t border-border space-y-4">
            {/* Optional Pre-check Subordinate Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-background border border-border gap-2">
              <div className="text-xs">
                <span className="font-semibold text-foreground/90">Optional: </span>
                <span className="text-muted-foreground">Test camera, display stream, and local device readiness before entering the exam room.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/student/device-check/${examId}`)}
                className="text-xs font-mono text-primary hover:text-indigo-300 hover:bg-primary/10 shrink-0 h-8"
              >
                Run Device Diagnostic →
              </Button>
            </div>

            {/* Primary Guided Action */}
            <div className="flex flex-col items-center justify-center pt-1 gap-2">
              <Button
                disabled={isOver || timeToStart > 0}
                onClick={() => navigate(`/student/exams/${examId}/security`)}
                className={`w-full sm:w-80 text-xs font-mono font-bold h-11 rounded-xl shadow-lg transition-all ${
                  isOver || timeToStart > 0
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed shadow-none'
                    : 'bg-primary hover:bg-primary text-white shadow-indigo-600/25'
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
                <span className="text-[11px] font-mono text-amber-400/90 text-center">
                  Security check unlocks automatically when countdown reaches zero
                </span>
              )}
              {isOver && (
                <span className="text-[11px] font-mono text-rose-400 text-center">
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
