import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Plus, Search, BookOpen, Clock, Users, Edit, Trash2,
  Eye, Copy, Play, StopCircle, ChevronRight, Filter, MoreHorizontal
} from 'lucide-react'

function ExamStatusBadge({ status }) {
  const map = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    ENDED: 'bg-gray-100 text-gray-500',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.DRAFT}`}>
      {status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      {status}
    </span>
  )
}

function ExamCard({ exam, onDelete, onCopy }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const startTime = exam.startTime ? new Date(exam.startTime) : null
  const endTime = exam.endTime ? new Date(exam.endTime) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <BookOpen size={18} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{exam.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{exam.subject}</p>
          </div>
        </div>
        <div className="relative flex-shrink-0 ml-2">
          <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal size={16} className="text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10">
              <button onClick={() => { navigate(`/faculty/exams/${exam.id}`); setMenuOpen(false) }}
                className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Eye size={13} /> View Details
              </button>
              {exam.status === 'DRAFT' && (
                <button onClick={() => { navigate(`/faculty/exams/${exam.id}/edit`); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Edit size={13} /> Edit Exam
                </button>
              )}
              <button onClick={() => { onCopy(exam.id); setMenuOpen(false) }}
                className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Copy size={13} /> Duplicate
              </button>
              {['DRAFT', 'SCHEDULED'].includes(exam.status) && (
                <button onClick={() => { onDelete(exam.id); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
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

      {startTime && (
        <div className="text-xs text-gray-400 flex items-center gap-1.5 mb-3">
          <Clock size={11} />
          {startTime.toLocaleDateString()} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {endTime && ` → ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}

      <div className="flex items-center justify-between">
        <ExamStatusBadge status={exam.status} />
        <button onClick={() => navigate(`/faculty/exams/${exam.id}`)}
          className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline">
          {exam.status === 'ACTIVE' ? 'Monitor' : 'View'} <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

export default function FacultyExams() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchExams = async () => {
    setLoading(true)
    try {
      const res = await api.get('/faculty/exams')
      setExams(res.data.exams || res.data || [])
    } catch { toast.error('Failed to load exams') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchExams() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this exam? This cannot be undone.')) return
    try {
      await api.delete(`/faculty/exams/${id}`)
      toast.success('Exam deleted')
      fetchExams()
    } catch { toast.error('Failed to delete exam') }
  }

  const handleCopy = async (id) => {
    try {
      await api.post(`/faculty/exams/${id}/duplicate`)
      toast.success('Exam duplicated')
      fetchExams()
    } catch { toast.error('Failed to duplicate exam') }
  }

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
          <p className="text-sm text-gray-500 mt-0.5">Create, manage, and monitor your exam sessions</p>
        </div>
        <Link to="/faculty/exams/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors">
          <Plus size={16} /> Create Exam
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exams…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {['', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'ENDED'].map(status => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterStatus === status ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">{search || filterStatus ? 'No exams match your filters' : 'No exams yet'}</p>
          {!search && !filterStatus && (
            <Link to="/faculty/exams/create"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> Create your first exam
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(exam => (
            <ExamCard key={exam.id} exam={exam} onDelete={handleDelete} onCopy={handleCopy} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
