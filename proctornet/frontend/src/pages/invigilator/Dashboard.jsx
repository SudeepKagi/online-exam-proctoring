import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import {
  Shield, Bell, AlertTriangle, Search, RefreshCw,
  Clock, Filter, Users, Radio, LogOut, CheckCircle2, Archive
} from 'lucide-react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'
import StudentGrid from '@/components/invigilator/StudentGrid'
import StudentDossierModal from '@/components/invigilator/StudentDossierModal'
import EvidenceLightbox from '@/components/invigilator/EvidenceLightbox'
import { useAuth } from '@/context/AuthContext'

export default function InvDashboard() {
  const { examId } = useParams()
  const effectiveExamId = examId || user?.examId || 'active'

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
        events: s.events || [],
        facePhotoUrl: s.facePhotoUrl || s.lastSnapshot || s.latestFrame || null,
        latestFrame: s.latestFrame || s.facePhotoUrl || s.lastSnapshot || null,
        lastSnapshot: s.lastSnapshot || s.facePhotoUrl || null
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
    <DashboardLayout title="Exam History & Violations">
      <div className="flex flex-col gap-6 font-sans py-2">
        {/* Top Exam Header & Filter Control Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {examInfo?.title || 'Examination Log & History'}
              </h1>
              {examInfo?.subject && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2f80ed] text-xs font-semibold border border-blue-200">
                  {examInfo.subject}
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${
                isExamEnded
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : connected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isExamEnded ? 'bg-amber-500' : connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isExamEnded ? 'Concluded' : connected ? 'Live Monitoring' : 'Connecting'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-3">
              <span>Exam ID: <code className="text-slate-700 font-semibold">{examInfo?.id || effectiveExamId}</code></span>
              <span>•</span>
              <span>Connected Candidates: <strong className="text-slate-900">{students.length}</strong></span>
              <span>•</span>
              <span>Time Remaining: <strong className="text-slate-900">{timeRemaining}</strong></span>
            </p>
          </div>

          {/* Controls: Search Input & Filter Tabs */}
          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by name or USN…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#2f80ed] focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {['all', 'flagged', 'active'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-all cursor-pointer ${
                    filter === tab
                      ? 'bg-[#2f80ed] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              onClick={fetchExamData}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div>
          {isLoading ? (
            <div className="h-80 flex flex-col items-center justify-center text-xs text-slate-500 space-y-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="w-8 h-8 border-2 border-[#2f80ed] border-t-transparent rounded-full animate-spin" />
              <p className="font-semibold text-slate-700">Synchronizing candidate history matrix…</p>
            </div>
          ) : errorState ? (
            <div className="py-12 flex flex-col items-center justify-center p-8 text-center bg-white border border-rose-200 rounded-2xl shadow-xs max-w-lg mx-auto space-y-4 my-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Shield size={24} />
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                    HTTP {errorState.status || 500}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{errorState.title}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                  {errorState.message}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={fetchExamData}
                  className="px-4 py-2 bg-[#2f80ed] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <RefreshCw size={13} /> Retry Sync
                </button>
              </div>
            </div>
          ) : isExamEnded && !showArchivedGrid ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm max-w-xl w-full p-8 text-center space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
                    EXAMINATION WINDOW CLOSED
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Examination Concluded
                  </h2>
                  <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed font-medium">
                    The scheduled window for <strong className="text-slate-800 font-semibold">{examInfo?.title || 'this examination'}</strong> ended at{' '}
                    {examInfo?.endTime ? new Date(examInfo.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'the designated time'}.
                    Live video streaming and candidate telemetry relays have terminated.
                  </p>
                </div>

                {/* Summary Stats Grid */}
                <div className="grid grid-cols-3 gap-3 text-left">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Candidates</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{students.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Flags</p>
                    <p className="text-lg font-bold text-amber-600 mt-0.5">
                      {students.reduce((acc, s) => acc + (s.flagCount || 0), 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Duration</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{examInfo?.duration || '—'} Mins</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowArchivedGrid(true)}
                    className="px-5 py-2.5 bg-[#2f80ed] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Archive size={15} /> Review Candidate Feeds
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isExamEnded && (
                <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between font-sans">
                  <div className="flex items-center gap-2 text-xs text-amber-800 font-bold">
                    <Archive size={16} />
                    <span>Viewing Archived Session Feeds & Violations (Examination Concluded)</span>
                  </div>
                  <button
                    onClick={() => setShowArchivedGrid(false)}
                    className="text-xs px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer transition-colors"
                  >
                    Back to Summary
                  </button>
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
        </div>

        {/* Modal 1: Student Dossier Deep Inspection */}
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

        {/* Modal 2: Evidence Lightbox */}
        {activeLightbox && (
          <EvidenceLightbox
            snapshot={activeLightbox}
            onClose={() => setActiveLightbox(null)}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
