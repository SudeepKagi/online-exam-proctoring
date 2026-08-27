import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import {
  Shield, Bell, AlertTriangle, Search, RefreshCw,
  Clock, Filter, Users, Radio
} from 'lucide-react'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'

import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'
import StudentGrid from '@/components/invigilator/StudentGrid'
import StudentDossierModal from '@/components/invigilator/StudentDossierModal'
import EvidenceLightbox from '@/components/invigilator/EvidenceLightbox'

export default function InvDashboard() {
  const { examId } = useParams()
  const navigate = useNavigate()

  // ── Local State ──
  const [examInfo, setExamInfo] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRemaining, setTimeRemaining] = useState('--:--:--')
  const [isLoading, setIsLoading] = useState(true)

  // ── Hook: Invigilator Socket & WebRTC ──
  const {
    connected,
    alerts,
    chats,
    requestStudentStream,
    sendWarning,
    terminateStudentExam
  } = useInvigilatorSocket({
    examId,
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
    try {
      const res = await api.get(`/invigilator/exam/${examId}`)
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
      toast.error('Failed to load exam data')
    } finally {
      setIsLoading(false)
    }
  }, [examId])

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
              Exam ID: <span className="text-foreground/90">{examId}</span> • Connected Candidates: <span className="text-foreground/90">{students.length}</span>
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

        {/* Right Timer & Status */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-foreground/90 font-bold">{connected ? 'Relay Live' : 'Connecting'}</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border bg-background text-foreground font-bold text-xs">
            <Clock size={14} className="text-primary" />
            <span>{timeRemaining}</span>
          </div>
        </div>
      </header>

      {/* ── Main Candidates Stream Grid ── */}
      <main className="flex-1 overflow-y-auto p-4 bg-background">
        {isLoading ? (
          <div className="h-96 flex items-center justify-center font-mono text-xs text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            Synchronizing live multi-feed matrix…
          </div>
        ) : (
          <StudentGrid
            students={filteredStudents}
            filter={filter}
            onSelectStudent={setSelectedStudent}
            onRequestStream={requestStudentStream}
          />
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
