import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BookOpen, Calendar, Search, Play, Camera, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ExamCard({ exam, now }) {
  const start = new Date(exam.startTime)
  const end = new Date(exam.endTime)

  const fifteenMinsBeforeStart = new Date(start.getTime() - 15 * 60 * 1000)
  const isEnded = exam.status === 'ENDED' || now > end
  const isActive = exam.status === 'ACTIVE' || (now >= start && now <= end && (exam.status === 'PUBLISHED' || exam.status === 'SCHEDULED' || exam.status === 'ACTIVE'))
  const canJoin = !isEnded && now >= fifteenMinsBeforeStart && now <= end

  const timeLabel = isActive
    ? `Ends ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : isEnded
      ? `Ended ${end.toLocaleDateString()} ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  return (
    <Card className={`transition-all border-[#27272A] bg-[#141416] ${isEnded ? 'opacity-70' : ''}`}>
      <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#27272A] text-white flex items-center justify-center shrink-0 border border-[#3F3F46]">
                <BookOpen size={14} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-xs text-slate-100 truncate">{exam.title}</h3>
                <p className="text-[11px] font-mono text-slate-400 truncate">{exam.subject || exam.courseCode}</p>
              </div>
            </div>
            {isActive && (
              <Badge variant="default" className="text-[9px] font-mono">
                LIVE
              </Badge>
            )}
            {isEnded && (
              <Badge variant="secondary" className="text-[9px] font-mono">ENDED</Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="bg-[#1F1F22] rounded-xl p-2 text-center border border-[#27272A]">
              <p className="text-[9px] text-slate-400 font-mono uppercase">Duration</p>
              <p className="text-xs font-mono font-bold text-slate-200 mt-0.5">{exam.duration} min</p>
            </div>
            <div className="bg-[#1F1F22] rounded-xl p-2 text-center border border-[#27272A]">
              <p className="text-[9px] text-slate-400 font-mono uppercase">Questions</p>
              <p className="text-xs font-mono font-bold text-slate-200 mt-0.5">{exam._count?.questions ?? exam.questionCount ?? '—'}</p>
            </div>
            <div className="bg-[#1F1F22] rounded-xl p-2 text-center border border-[#27272A]">
              <p className="text-[9px] text-slate-400 font-mono uppercase">Marks</p>
              <p className="text-xs font-mono font-bold text-slate-200 mt-0.5">{exam.totalMarks}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-3">
            <Calendar size={11} className="text-slate-500" /> {timeLabel}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
          <div className="flex items-center gap-1">
            {exam.cameraRequired && (
              <Badge variant="secondary" className="text-[9px] gap-1 px-2 py-0 font-mono">
                <Camera size={9} /> Camera
              </Badge>
            )}
            {exam.browserLock && (
              <Badge variant="secondary" className="text-[9px] gap-1 px-2 py-0 font-mono">
                <Lock size={9} /> Lock
              </Badge>
            )}
          </div>

          {canJoin ? (
            <Link to={`/student/exam-lobby/${exam.id}`}>
              <Button size="sm" className="h-7 text-[11px] font-mono">
                <Play size={11} className="mr-1" /> {isActive ? 'Join Now' : 'Enter Lobby'}
              </Button>
            </Link>
          ) : isEnded ? (
            <Badge variant="secondary" className="text-[9px] font-mono">Exam Over</Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] font-mono">Not Open</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudentExams() {
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
    const isActive = e.status === 'ACTIVE' || (now >= start && now <= end && (e.status === 'PUBLISHED' || e.status === 'SCHEDULED' || e.status === 'ACTIVE'))
    const isUpcoming = !isEnded && now < fifteenMinsBeforeStart

    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())

    if (filterStatus === 'ACTIVE') return matchSearch && isActive && !isEnded
    if (filterStatus === 'SCHEDULED') return matchSearch && isUpcoming
    if (filterStatus === 'ENDED') return matchSearch && isEnded
    return matchSearch
  })

  return (
    <DashboardLayout title="My Exams">
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Assigned Examinations</h1>
          <p className="text-xs text-slate-400 mt-0.5">Scheduled and active assessment sessions.</p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exams by title or code..."
              className="pl-8 text-xs bg-[#141416]"
            />
          </div>
          <div className="flex gap-1 p-0.5 bg-[#141416] rounded-xl border border-[#27272A]">
            {['', 'ACTIVE', 'SCHEDULED', 'ENDED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                  filterStatus === status
                    ? 'bg-[#27272A] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
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
              <div key={i} className="h-44 rounded-2xl bg-[#141416] border border-[#27272A] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center border-[#27272A] bg-[#141416]">
            <BookOpen size={32} className="text-slate-500 mx-auto mb-2 opacity-50" />
            <h3 className="text-xs font-semibold text-slate-200">No examinations found</h3>
            <p className="text-[11px] font-mono text-slate-500 mt-1">Assessments assigned to your department will appear here.</p>
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
