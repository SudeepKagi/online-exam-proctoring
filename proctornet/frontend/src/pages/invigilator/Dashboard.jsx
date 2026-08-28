import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import {
  Shield, Bell, AlertTriangle, Search, RefreshCw,
  Clock, Filter, Users, Radio, LogOut, CheckCircle2, Archive
} from 'lucide-react'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'

import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'
import StudentGrid from '@/components/invigilator/StudentGrid'
import StudentDossierModal from '@/components/invigilator/StudentDossierModal'
import EvidenceLightbox from '@/components/invigilator/EvidenceLightbox'

import { useAuth } from '@/context/AuthContext'

export default function InvDashboard() {
  const { examId } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const effectiveExamId = examId || user?.examId || localStorage.getItem('inv_examId') || 'active'

  // ── Local State ──
  const [examInfo, setExamInfo] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRemaining, setTimeRemaining] = useState('--:--:--')
  const [isLoading, setIsLoading] = useState(true)
  const [errorState, setErrorState] = useState(null)
  const [showArchivedGrid, setShowArchivedGrid] = useState(false)

  const isExamEnded = Boolean(
    examInfo?.status === 'ENDED' ||
    (examInfo?.endTime && new Date() > new Date(examInfo.endTime)) ||
    timeRemaining === '00:00:00'
  )

  const handleLogout = () => {
    logout()
    navigate('/invigilator/login')
  }

  // ── Hook: Invigilator Socket & WebRTC ──
  const {
    connected,
    alerts,
    chats,
    requestStudentStream,
    sendWarning,
    terminateStudentExam
  } = useInvigilatorSocket({
    examId: effectiveExamId,
    enabled: !isExamEnded && !isLoading && !errorState,
    onAlertReceived: (alert) => {
      setStudents(prev => prev.map(s => {
        if (s.id === alert.studentId || s.studentId === alert.studentId) {
          const nextCount = (s.flagCount || 0) + 1
          return {
            ...s,
            flagCount: nextCount,
            events: [alert, ...(s.events || [])]
          }
        }
        return s
      }))
    }
  })

  // ── Fetch Initial Exam State ──
  const fetchExamData = useCallback(async () => {
    setErrorState(null)
    setIsLoading(true)
    try {
      const res = await api.get(`/invigilator/exam/${effectiveExamId}`)
      setExamInfo(res.data.exam)

      const initialStudents = (res.data.students || []).map(s => ({
        id: s.studentId || s.id,
        studentId: s.studentId || s.id,
        name: s.name,
        usn: s.usn,
        department: s.department,
        status: s.status || 'ACTIVE',
        progress: s.progress || { answered: 0, total: 0 },
        flagCount: s.flagCount || 0,
        events: s.events || []
      }))
      setStudents(initialStudents)

      // Start timer countdown
      if (res.data.exam?.endTime) {
        const endTime = new Date(res.data.exam.endTime).getTime()
        const updateTimer = () => {
          const diff = endTime - Date.now()
          if (diff <= 0) {
            setTimeRemaining('00:00:00')
            return
          }
          const h = Math.floor(diff / 3600000)
          const m = Math.floor((diff % 3600000) / 60000)
          const s = Math.floor((diff % 60000) / 1000)
          const pad = n => String(n).padStart(2, '0')
          setTimeRemaining(`${pad(h)}:${pad(m)}:${pad(s)}`)
        }
        updateTimer()
        const timer = setInterval(updateTimer, 1000)
        return () => clearInterval(timer)
      }
    } catch (err) {
      console.error('[fetchExamData]', err)
      const status = err.response?.status
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to connect to exam server.'
      setErrorState({
        status,
        title: status === 403 
          ? 'Invigilator Access Restricted'
          : status === 404
          ? 'No Active Examination Assigned'
          : 'Invigilation Session Error',
        message: status === 403
          ? 'Your current credentials do not have authorization for this session, or the session token has expired.'
          : status === 404
          ? 'No active examination matching this session could be found.'
          : msg
      })
    } finally {
      setIsLoading(false)
    }
  }, [effectiveExamId])

  useEffect(() => {
    fetchExamData()
  }, [fetchExamData])

  const filteredStudents = students.filter(s => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = s.name?.toLowerCase().includes(q)
      const matchUsn = s.usn?.toLowerCase().includes(q)
      if (!matchName && !matchUsn) return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* ── Top Header ── */}
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <ProctorNetLogo size={24} />
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              {examInfo?.title || 'Live Invigilation Terminal'}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-semibold">
                {examInfo?.subject || 'INVIGILATOR'}
              </span>
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              Exam ID: <span className="text-foreground/90">{examInfo?.id || effectiveExamId}</span> • Connected Candidates: <span className="text-foreground/90">{students.length}</span>
            </p>
          </div>
        </div>

        {/* Center Live Socket State & Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by name or USN…"
              className="bg-background border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-foreground outline-none focus:border-primary w-48 lg:w-64 font-mono transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-background border border-border p-1 rounded-xl text-xs font-mono">
            {['all', 'flagged', 'active'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg capitalize font-bold transition-all ${
                  filter === tab
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right Timer & Status & Logout */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-xs">
            <span className={`w-2 h-2 rounded-full ${isExamEnded ? 'bg-slate-400' : connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-foreground/90 font-bold">
              {isExamEnded ? 'Concluded' : connected ? 'Relay Live' : 'Connecting'}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border bg-background text-foreground font-bold text-xs">
            <Clock size={14} className={isExamEnded ? 'text-muted-foreground' : 'text-primary'} />
            <span>{timeRemaining}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition cursor-pointer"
            title="Logout Invigilator Session"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main Candidates Stream Grid ── */}
      <main className="flex-1 overflow-y-auto p-4 bg-background">
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p>Synchronizing live multi-feed matrix…</p>
          </div>
        ) : errorState ? (
          <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-card border border-destructive/30 rounded-3xl shadow-sm max-w-lg mx-auto space-y-4 my-8">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <Shield size={28} />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20">
                  HTTP {errorState.status || 500}
                </span>
                <h3 className="text-base font-bold text-foreground">{errorState.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-medium">
                {errorState.message}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={fetchExamData}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <RefreshCw size={13} /> Retry Synchronization
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-background hover:bg-muted border border-border text-foreground rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5"
              >
                <LogOut size={13} /> Invigilator Logout
              </button>
            </div>
          </div>
        ) : isExamEnded && !showArchivedGrid ? (
          <div className="h-full py-12 flex flex-col items-center justify-center">
            <div className="bg-card border border-border rounded-3xl shadow-xl max-w-xl w-full p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
                  EXAMINATION WINDOW CLOSED
                </div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  Examination Concluded
                </h2>
                <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed font-normal">
                  The scheduled window for <strong className="text-foreground font-medium">{examInfo?.title || 'this examination'}</strong> ended at{' '}
                  {examInfo?.endTime ? new Date(examInfo.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'the designated time'}.
                  Live video streaming and candidate telemetry relays have terminated.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="p-3.5 bg-background border border-border rounded-2xl">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Candidates</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">{students.length}</p>
                </div>
                <div className="p-3.5 bg-background border border-border rounded-2xl">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Flags</p>
                  <p className="text-base font-semibold text-amber-500 mt-0.5">
                    {students.reduce((acc, s) => acc + (s.flagCount || 0), 0)}
                  </p>
                </div>
                <div className="p-3.5 bg-background border border-border rounded-2xl">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Duration</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">{examInfo?.duration || '—'} Mins</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs font-mono"
                >
                  <LogOut size={14} /> End Session & Logout
                </button>
                <button
                  onClick={() => setShowArchivedGrid(true)}
                  className="px-4 py-2.5 bg-background hover:bg-muted border border-border text-foreground rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer font-mono"
                >
                  <Archive size={14} /> Review Candidate Feeds
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isExamEnded && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between font-sans">
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold">
                  <Archive size={16} />
                  <span>Viewing Archived Session Feeds (Examination Concluded)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchivedGrid(false)}
                    className="text-xs px-3 py-1.5 bg-background hover:bg-muted border border-border rounded-xl text-foreground font-bold font-mono cursor-pointer"
                  >
                    Back to Summary
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              </div>
            )}
            <StudentGrid
              students={filteredStudents}
              filter={filter}
              onSelectStudent={setSelectedStudent}
              onRequestStream={requestStudentStream}
            />
          </>
        )}
      </main>

      {/* ── Modal 1: Student Dossier Deep Inspection ── */}
      {selectedStudent && (
        <StudentDossierModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onWarn={sendWarning}
          onTerminate={terminateStudentExam}
          onOpenLightbox={setActiveLightbox}
          chats={chats}
        />
      )}

      {/* ── Modal 2: Evidence Lightbox ── */}
      {activeLightbox && (
        <EvidenceLightbox
          snapshot={activeLightbox}
          onClose={() => setActiveLightbox(null)}
        />
      )}
    </div>
  )
}
