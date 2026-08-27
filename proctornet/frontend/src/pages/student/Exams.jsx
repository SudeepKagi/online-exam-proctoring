import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { BookOpen, Calendar, Search, Play, Camera, Lock, Building, GraduationCap } from 'lucide-react'
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
    <Card className={`transition-all hover:border-primary/40 hover:shadow-md ${isEnded ? 'opacity-70' : ''}`}>
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-3.5">
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-primary flex items-center justify-center shrink-0 border border-[#d5e6fb] dark:bg-neutral-800 dark:border-neutral-700">
                <BookOpen size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-foreground truncate">{exam.title}</h3>
                <p className="text-xs text-muted-foreground truncate font-medium">{exam.subject || exam.courseCode}</p>
              </div>
            </div>
            {isSubmitted ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0] flex items-center gap-1">
                <CheckCircle2 size={11} /> SUBMITTED
              </span>
            ) : isActive ? (
              <Badge variant="green" className="text-[10px]">
                LIVE
              </Badge>
            ) : isEnded ? (
              <Badge variant="outline" className="text-[10px]">ENDED</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">SCHEDULED</Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 my-3.5">
            <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 text-center border border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Duration</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{exam.duration} min</p>
            </div>
            <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 text-center border border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Questions</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{exam._count?.questions ?? exam.questionCount ?? '—'}</p>
            </div>
            <div className="bg-[#f8fafc] dark:bg-neutral-900 rounded-xl p-2.5 text-center border border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Marks</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{exam.totalMarks}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium">
            <Calendar size={13} className="text-muted-foreground" /> {timeLabel}
          </div>

          {/* Allotted Eligibility Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-[#f1f5f9] border border-[#e2e8f0] font-semibold text-[#0f172a]">
              Dept: {exam.allowedDepartments && exam.allowedDepartments.length > 0 ? exam.allowedDepartments.join(', ') : 'All'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#eff6ff] border border-[#dbeafe] font-semibold text-[#2563eb]">
              Sem: {exam.allowedSemesters && exam.allowedSemesters.length > 0 ? exam.allowedSemesters.map(s => `Sem ${s}`).join(', ') : 'All'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            {exam.cameraRequired && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                <Camera size={10} /> Camera
              </Badge>
            )}
            {exam.browserLock && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                <Lock size={10} /> Lock
              </Badge>
            )}
          </div>

          {isSubmitted ? (
            <Link to="/student/results">
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-[#10b981] border-[#a7f3d0] bg-[#ecfdf5] hover:bg-[#d1fae5] cursor-pointer">
                <CheckCircle2 size={12} className="mr-1.5" /> View Result
              </Button>
            </Link>
          ) : canJoin ? (
            <Link to={`/student/exams/${exam.id}/lobby`}>
              <Button size="sm" className="h-8 text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer">
                <Play size={12} className="mr-1.5" /> {isActive ? 'Join Now' : 'Enter Lobby'}
              </Button>
            </Link>
          ) : isEnded ? (
            <Badge variant="secondary" className="text-[10px]">Exam Over</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not Open</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudentExams() {
  const { user } = useAuth()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 5000)
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

  const filtered = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const fifteenMinsBeforeStart = new Date(start.getTime() - 15 * 60 * 1000)
    
    const isEnded = e.status === 'ENDED' || now > end
    const isActive = !isEnded && (e.status === 'ACTIVE' || (now >= start && now <= end && ['PUBLISHED', 'SCHEDULED', 'ACTIVE'].includes(e.status)))
    const isUpcoming = !isEnded && now < start

    const matchSearch = (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())

    if (filterStatus === 'ACTIVE') return matchSearch && isActive
    if (filterStatus === 'SCHEDULED') return matchSearch && isUpcoming
    if (filterStatus === 'ENDED') return matchSearch && isEnded
    return matchSearch
  })

  return (
    <DashboardLayout title="My Exams">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Assigned Examinations</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Assessments specifically allotted to your academic stream.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#eff6ff] border border-[#dbeafe] text-[#2563eb] rounded-xl text-xs font-bold w-fit">
              <Building size={14} className="shrink-0" />
              <span>{user.department || 'Department'} • Semester {user.semester || 1}</span>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exams by title or code..."
              className="pl-10 text-xs bg-card"
              aria-label="Search exams"
            />
          </div>
          <div className="flex gap-1 p-1 bg-[#f1f5f9] dark:bg-neutral-900 rounded-xl border border-border">
            {['', 'ACTIVE', 'SCHEDULED', 'ENDED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterStatus === status
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={filterStatus === status}
              >
                {status || 'ALL'}
              </button>
            ))}
          </div>
        </div>

        {/* Content grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-card border border-border animate-pulse shadow-xs" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen size={36} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-bold text-foreground">No examinations found</h3>
            <p className="text-xs text-muted-foreground mt-1">Assessments assigned to your department will appear here.</p>
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
