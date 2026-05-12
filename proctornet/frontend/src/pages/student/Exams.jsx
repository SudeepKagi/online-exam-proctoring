import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BookOpen, Clock, Play, Search, Filter, Calendar } from 'lucide-react'

function ExamCard({ exam }) {
  const start = new Date(exam.startTime)
  const end = new Date(exam.endTime)
  const now = new Date()
  const isActive = exam.status === 'ACTIVE'
  const isUpcoming = exam.status === 'SCHEDULED' && start > now
  const canJoin = isActive || (exam.status === 'SCHEDULED' && (start - now) < 15 * 60 * 1000)

  const timeLabel = isActive
    ? `Ends ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-shadow ${isActive ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-green-100' : 'bg-emerald-50'}`}>
          {isActive
            ? <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            : <BookOpen size={20} className="text-emerald-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{exam.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{exam.subject}</p>
        </div>
        {isActive && <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
        </span>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-xs text-gray-400">Duration</p>
          <p className="text-sm font-bold text-gray-800">{exam.duration}<span className="text-xs font-normal text-gray-400"> min</span></p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-xs text-gray-400">Questions</p>
          <p className="text-sm font-bold text-gray-800">{exam._count?.questions ?? exam.questionCount ?? '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-xs text-gray-400">Marks</p>
          <p className="text-sm font-bold text-gray-800">{exam.totalMarks}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Calendar size={11} /> {timeLabel}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {exam.cameraRequired && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">📷 Camera</span>}
          {exam.browserLock && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🔒 Locked</span>}
          {exam.vpnRequired && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🛡️ VPN</span>}
        </div>
        {canJoin ? (
          <Link to={`/student/exam-lobby/${exam.id}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors">
            <Play size={12} /> {isActive ? 'Join Now' : 'Enter Lobby'}
          </Link>
        ) : exam.status === 'ENDED' ? (
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">Completed</span>
        ) : (
          <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">Not yet open</span>
        )}
      </div>
    </div>
  )
}

export default function StudentExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    api.get('/student/exams')
      .then(r => setExams(r.data.exams || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = exams.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || e.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <DashboardLayout title="My Exams">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Exams</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and join your scheduled exam sessions</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exams…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {['', 'ACTIVE', 'SCHEDULED', 'ENDED'].map(status => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterStatus === status ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No exams found</p>
          <p className="text-sm text-gray-400 mt-1">Exams assigned to your department and semester will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(exam => <ExamCard key={exam.id} exam={exam} />)}
        </div>
      )}
    </DashboardLayout>
  )
}
