import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import {
  BookOpen, User, Mail, GraduationCap, Building, CheckCircle2,
  ShieldCheck, Clock, Radio, Play, ArrowRight, Calendar, Lock,
  Camera, AlertCircle, FileText, Check
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionCards } from '@/components/section-cards'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [examRes, resultsRes] = await Promise.all([
          api.get('/student/exams').catch(() => ({ data: { exams: [] } })),
          api.get('/student/results').catch(() => ({ data: { results: [] } })),
        ])
        const allExams = examRes.data?.exams || examRes.data || []
        setExams(Array.isArray(allExams) ? allExams : [])
        const allResults = resultsRes.data?.results || resultsRes.data || []
        setResults(Array.isArray(allResults) ? allResults : [])
      } catch (err) {
        console.error('[StudentDashboard] Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
    : 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const isVerified = user?.profileStatus === 'VERIFIED' || user?.profileStatus === 'LOCKED'

  // Categorize exams
  const liveExams = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    return currentTime >= start && currentTime <= end && !isSubmitted && e.status !== 'ENDED'
  })

  const upcomingExams = exams.filter(e => {
    const start = new Date(e.startTime)
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    return currentTime < start && !isSubmitted && e.status !== 'ENDED'
  })

  const submittedExams = exams.filter(e => {
    return e.studentStatus === 'SUBMITTED' || e.isSubmitted
  })

  return (
    <DashboardLayout title="Student Console">
      <div className="space-y-6 font-sans text-[#0f172a]">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">
              {greeting()}, {user?.name?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-xs text-[#64748b] mt-1 font-normal">
              USN: <span className="font-mono font-semibold text-[#0f172a]">{user?.usn || user?.rollNo || 'N/A'}</span> • {user?.department || 'Engineering'} • Semester {user?.semester || 1}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/student/device-check')}
              className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold py-2 px-3.5 rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck size={15} className="text-[#2563eb]" />
              <span>BYOD Diagnostic</span>
            </button>
            <button
              onClick={() => navigate('/student/exams')}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-3.5 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <BookOpen size={15} />
              <span>All Examinations</span>
            </button>
          </div>
        </div>

        {/* ── LIVE & RECENT EXAMINATIONS SECTION (PROMINENT TOP PLACEMENT) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10b981]"></span>
              </span>
              <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">
                Live & Scheduled Examinations
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-[#64748b]">
              {liveExams.length} Active Now • {upcomingExams.length} Upcoming
            </span>
          </div>

          {/* 1. Live Exams Showcase */}
          {liveExams.length > 0 && (
            <div className="space-y-3">
              {liveExams.map(exam => (
                <div
                  key={exam.id}
                  className="p-5 rounded-2xl bg-gradient-to-r from-[#ecfdf5] via-[#f0fdf4] to-white border-2 border-[#10b981] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#10b981] text-white flex items-center gap-1">
                        <Radio size={12} className="animate-pulse" /> LIVE NOW
                      </span>
                      <span className="text-xs font-mono font-bold text-[#10b981]">
                        Ends at {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#0f172a] tracking-tight">{exam.title}</h3>
                    <p className="text-xs text-[#64748b]">
                      Subject: <strong className="text-[#0f172a]">{exam.subject || 'Core Assessment'}</strong> • Duration: {exam.duration} mins • Total Marks: {exam.totalMarks}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#a7f3d0] text-[#0f172a] font-semibold">
                        Dept: {exam.allowedDepartments?.join(', ') || 'All'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#eff6ff] border border-[#dbeafe] text-[#2563eb] font-semibold">
                        Sem: {exam.allowedSemesters?.map(s => `Sem ${s}`).join(', ') || 'All'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/student/exams/${exam.id}/lobby`}>
                      <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-6 h-10 rounded-xl cursor-pointer shadow-xs">
                        Enter Security Check & Start <ArrowRight size={14} className="ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. Upcoming & Submitted Exams Grid */}
          {(upcomingExams.length > 0 || submittedExams.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upcoming Scheduled */}
              {upcomingExams.slice(0, 2).map(exam => (
                <Card key={exam.id} className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                        UPCOMING
                      </span>
                      <span className="text-[11px] font-mono text-[#64748b]">
                        {new Date(exam.startTime).toLocaleDateString()} at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#0f172a] truncate">{exam.title}</h4>
                    <p className="text-xs text-[#64748b] mt-0.5">{exam.subject || 'Assessment'}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#f1f5f9]">
                    <span className="text-[11px] text-[#64748b] font-medium">{exam.duration} mins • {exam.totalMarks} Marks</span>
                    <Link to={`/student/exams/${exam.id}/lobby`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#e2e8f0] text-[#2563eb] hover:bg-[#eff6ff] cursor-pointer">
                        Open Lobby <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}

              {/* Completed / Submitted Exam Status */}
              {submittedExams.slice(0, 2).map(exam => (
                <Card key={exam.id} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0] flex items-center gap-1">
                        <Check size={11} /> SUBMITTED
                      </span>
                      <span className="text-[10px] font-semibold text-[#10b981]">
                        Re-entry Closed
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#0f172a] truncate">{exam.title}</h4>
                    <p className="text-xs text-[#64748b] mt-0.5">Answers submitted and archived.</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#e2e8f0]">
                    <span className="text-[11px] text-[#64748b]">Score recorded</span>
                    <Link to="/student/results">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#a7f3d0] text-[#10b981] bg-white hover:bg-[#ecfdf5] cursor-pointer">
                        View Transcripts
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Fallback empty state if zero exams */}
          {liveExams.length === 0 && upcomingExams.length === 0 && submittedExams.length === 0 && (
            <Card className="p-6 text-center bg-white border border-[#e2e8f0] rounded-2xl">
              <BookOpen size={28} className="text-[#94a3b8] mx-auto mb-2 opacity-60" />
              <h4 className="text-xs font-bold text-[#0f172a]">No Live or Scheduled Exams</h4>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                When faculty allot examinations to {user?.department || 'your department'}, they will immediately appear here.
              </p>
            </Card>
          )}
        </div>

        {/* Candidate Personal Info Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                <User className="w-4 h-4 text-[#2563eb]" />
                Personal & Academic Profile
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Verified candidate credentials and institutional enrollment details.
              </p>
            </div>
            {isVerified ? (
              <span className="px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#10b981] text-[10px] font-bold uppercase tracking-wider border border-[#dcfce7] flex items-center gap-1">
                <CheckCircle2 size={12} />
                Verified Candidate
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-[#fffbeb] text-[#b45309] text-[10px] font-bold uppercase tracking-wider border border-[#fef3c7] flex items-center gap-1">
                <Clock size={12} />
                Under Admin Review
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <User size={13} className="text-[#94a3b8]" /> Full Name
              </span>
              <p className="font-bold text-[#0f172a] mt-1 text-sm">{user?.name || 'Candidate'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <GraduationCap size={13} className="text-[#94a3b8]" /> Roll No / USN
              </span>
              <p className="font-bold text-[#0f172a] font-mono mt-1 text-sm">{user?.usn || user?.rollNo || 'N/A'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <Mail size={13} className="text-[#94a3b8]" /> Institutional Email
              </span>
              <p className="font-bold text-[#0f172a] truncate mt-1 text-sm">{user?.email || 'N/A'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <Building size={13} className="text-[#94a3b8]" /> Department & Phone
              </span>
              <p className="font-bold text-[#0f172a] truncate mt-1 text-sm">{user?.department || 'N/A'} • {user?.phone || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <SectionCards
          avgScore={avgScore}
          activeCount={liveExams.length}
          scheduledCount={upcomingExams.length}
          completedCount={submittedExams.length}
        />

        {/* Interactive Chart Block */}
        <ChartAreaInteractive results={results} />

        {/* Data Table Block */}
        <DataTable data={results} />
      </div>
    </DashboardLayout>
  )
}
