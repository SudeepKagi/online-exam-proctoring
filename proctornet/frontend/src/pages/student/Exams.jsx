import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import {
  BookOpen, Calendar, Search, Play, Camera, Lock, Building,
  GraduationCap, CheckCircle2, Radio, Clock, ArrowRight, ShieldCheck,
  Wifi, ExternalLink
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ExamCard({ exam, now }) {
  const start = new Date(exam.startTime)
  const end = new Date(exam.endTime)

  const fifteenMinsBeforeStart = new Date(start.getTime() - 15 * 60 * 1000)
  const isEnded = exam.status === 'ENDED' || now > end
  const isSubmitted = exam.studentStatus === 'SUBMITTED' || exam.isSubmitted
  const isActive = !isEnded && (exam.status === 'ACTIVE' || (now >= start && now <= end && (exam.status === 'PUBLISHED' || exam.status === 'SCHEDULED' || exam.status === 'ACTIVE')))
  const canJoin = !isEnded && !isSubmitted && now >= fifteenMinsBeforeStart && now <= end

  const timeLabel = isActive
    ? `Ends ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : isEnded
      ? `Ended ${end.toLocaleDateString()} ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  return (
    <Card className={`transition-all hover:border-[#2f80ed]/40 hover:shadow-md bg-white border border-slate-200 rounded-2xl overflow-hidden ${isEnded ? 'opacity-75' : ''}`}>
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-3.5">
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2f80ed] flex items-center justify-center shrink-0 border border-blue-100">
                <BookOpen size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-slate-900 truncate">{exam.title}</h3>
                <p className="text-xs text-slate-500 truncate font-semibold">{exam.subject || exam.courseCode}</p>
              </div>
            </div>
            {isSubmitted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={11} /> SUBMITTED
              </span>
            ) : isActive ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-xs">
                LIVE
              </span>
            ) : isEnded ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                ENDED
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#2f80ed] border border-blue-200">
                SCHEDULED
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 my-3.5">
            <div className="bg-[#f8fafc] rounded-xl p-2.5 text-center border border-slate-200">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Duration</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{exam.duration} min</p>
            </div>
            <div className="bg-[#f8fafc] rounded-xl p-2.5 text-center border border-slate-200">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Questions</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{exam._count?.questions ?? exam.questionCount ?? '—'}</p>
            </div>
            <div className="bg-[#f8fafc] rounded-xl p-2.5 text-center border border-slate-200">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Marks</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{exam.totalMarks}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 font-semibold">
            <Calendar size={13} className="text-slate-400" /> {timeLabel}
          </div>

          {/* Allotted Eligibility Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-extrabold text-slate-700">
              Dept: {exam.allowedDepartments && exam.allowedDepartments.length > 0 ? exam.allowedDepartments.join(', ') : 'All'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 font-extrabold text-[#2f80ed]">
              Sem: {exam.allowedSemesters && exam.allowedSemesters.length > 0 ? exam.allowedSemesters.map(s => `Sem ${s}`).join(', ') : 'All'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            {exam.cameraRequired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold">
                <Camera size={10} /> Camera
              </span>
            )}
            {exam.browserLock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold">
                <Lock size={10} /> Lock
              </span>
            )}
          </div>

          {isSubmitted ? (
            <Link to="/student/results">
              <button className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                <CheckCircle2 size={12} /> View Result
              </button>
            </Link>
          ) : canJoin ? (
            <Link to={`/student/exams/${exam.id}/lobby`}>
              <button className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#2f80ed] hover:bg-[#2563eb] text-white cursor-pointer shadow-sm flex items-center gap-1">
                <Play size={12} /> {isActive ? 'Join Now' : 'Enter Lobby'}
              </button>
            </Link>
          ) : isEnded ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-500">Exam Over</span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-500">Not Open</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudentExams() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    api.get('/student/exams')
      .then(r => {
        const examsList = r.data.exams || []
        setExams(examsList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Filter live active exams
  const liveExams = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    return now >= start && now <= end && !isSubmitted && e.status !== 'ENDED'
  })

  const getRemainingTimeStr = (endTime) => {
    const diff = Math.max(0, Math.floor((new Date(endTime) - now) / 1000))
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return `${m}m ${s}s remaining`
  }

  const filtered = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    
    const isEnded = e.status === 'ENDED' || now > end
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    const isActive = !isEnded && !isSubmitted && (e.status === 'ACTIVE' || (now >= start && now <= end && ['PUBLISHED', 'SCHEDULED', 'ACTIVE'].includes(e.status)))
    const isUpcoming = !isEnded && !isSubmitted && now < start

    const matchSearch = (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())

    if (filterStatus === 'ACTIVE') return matchSearch && isActive
    if (filterStatus === 'SCHEDULED') return matchSearch && isUpcoming
    if (filterStatus === 'SUBMITTED') return matchSearch && isSubmitted
    if (filterStatus === 'ENDED') return matchSearch && isEnded
    return matchSearch
  })

  return (
    <DashboardLayout title="Student Workspace">
      <div className="space-y-6 font-sans text-slate-900">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Examination Portal</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-semibold">
              Assessments allotted to your academic stream and semester.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-[#2f80ed] rounded-xl text-xs font-extrabold w-fit">
              <Building size={14} className="shrink-0" />
              <span>{user.department || 'Electronics & Communication'} • Semester {user.semester || 6}</span>
            </div>
          )}
        </div>

        {/* ── LIVE EXAMINATION COMMAND CENTER ── */}
        {liveExams.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 relative overflow-hidden shadow-lg border border-slate-800 flex flex-col justify-between">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#2f80ed]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white tracking-wider flex items-center gap-1.5 shadow-xs">
                      <Radio size={12} className="animate-pulse" /> LIVE EXAMINATION NOW
                    </span>
                    <span className="text-xs font-mono font-extrabold text-sky-400 flex items-center gap-1">
                      <Clock size={12} /> {getRemainingTimeStr(liveExams[0].endTime)}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 font-semibold">
                    Closes at {new Date(liveExams[0].endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">
                    {liveExams[0].title}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 font-semibold">
                    Subject: <strong className="text-white">{liveExams[0].subject || 'Course Assessment'}</strong> • Duration: {liveExams[0].duration} mins • Total Marks: {liveExams[0].totalMarks}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 backdrop-blur-xs border border-white/10 font-extrabold">
                    Allotted: {liveExams[0].allowedDepartments?.join(', ') || 'All Depts'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 backdrop-blur-xs border border-white/10 font-extrabold">
                    Semesters: {liveExams[0].allowedSemesters?.map(s => `Sem ${s}`).join(', ') || 'All'}
                  </span>
                </div>
              </div>

              <div className="relative z-10 pt-5 mt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs text-slate-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Camera size={13} className="text-sky-400" /> AI Face Tracking
                  </span>
                  <span>•</span>
                  <span>Screen Capture</span>
                  <span>•</span>
                  <span>Fullscreen Kiosk</span>
                </div>

                <Link to={`/student/exams/${liveExams[0].id}/lobby`}>
                  <button className="w-full sm:w-auto bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-extrabold px-6 h-11 rounded-xl cursor-pointer shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5">
                    Enter Security Check & Start <ArrowRight size={14} />
                  </button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Workstation Integrity
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Pre-exam verification status</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="space-y-2.5 mt-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Wifi size={13} className="text-[#2f80ed]" /> Telemetry Latency
                    </span>
                    <strong className="font-mono text-emerald-600 font-extrabold">18 ms (Low)</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Lock size={13} className="text-[#2f80ed]" /> WireGuard Tunnel
                    </span>
                    <strong className="font-mono text-[#2f80ed] font-extrabold">Configured</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Camera size={13} className="text-[#2f80ed]" /> Webcam & Mic
                    </span>
                    <strong className="font-mono text-emerald-600 font-extrabold">Ready</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#2f80ed]" /> Browser Sandbox
                    </span>
                    <strong className="font-mono text-emerald-600 font-extrabold">Active</strong>
                  </div>
                </div>
              </div>

              <Link to="/student/device-check" className="block w-full">
                <button className="w-full text-xs font-extrabold bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2f80ed] h-10 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                  Run Diagnostic Lab <ExternalLink size={13} />
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search examinations by title or subject code..."
              className="w-full pl-10 pr-4 py-2.5 border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-[#f8fafc] focus:bg-white focus:outline-none focus:border-[#2f80ed] transition"
              aria-label="Search exams"
            />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {[
              { id: '', label: 'ALL' },
              { id: 'ACTIVE', label: 'LIVE NOW' },
              { id: 'SCHEDULED', label: 'SCHEDULED' },
              { id: 'SUBMITTED', label: 'SUBMITTED' },
              { id: 'ENDED', label: 'ENDED' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setFilterStatus(item.id)}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  filterStatus === item.id
                    ? 'bg-[#2f80ed] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={filterStatus === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-card border border-border animate-pulse shadow-xs" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center bg-white border border-[#e2e8f0] rounded-2xl">
            <BookOpen size={36} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-bold text-foreground">No examinations found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Assessments assigned to your department will appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(exam => (
              <ExamCard key={exam.id} exam={exam} now={now} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
