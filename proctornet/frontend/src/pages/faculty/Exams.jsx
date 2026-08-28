import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import {
  Plus, Search, BookOpen, Clock, Users, Edit, Trash2,
  Eye, Copy, Play, StopCircle, ChevronRight, Filter, MoreHorizontal, Calendar, Award, CheckCircle2
} from 'lucide-react'

function getComputedStatus(exam) {
  if (!exam) return 'DRAFT'
  if (exam.status === 'DRAFT') return 'DRAFT'
  if (exam.status === 'CANCELLED') return 'CANCELLED'

  const now = new Date()
  const start = exam.startTime ? new Date(exam.startTime) : null
  const end = exam.endTime ? new Date(exam.endTime) : null

  if (start && now < start) return 'SCHEDULED'
  if (start && end && now >= start && now <= end) return 'ACTIVE'
  if (end && now > end) return 'ENDED'

  return exam.status === 'PUBLISHED' ? 'SCHEDULED' : (exam.status || 'SCHEDULED')
}

function ExamStatusBadge({ status }) {
  const map = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ENDED: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${map[status] || map.DRAFT}`}>
      {status === 'ACTIVE' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      {status}
    </span>
  )
}

function ExamCard({ exam, onDelete, onCopy }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const startTime = exam.startTime ? new Date(exam.startTime) : null
  const endTime = exam.endTime ? new Date(exam.endTime) : null
  const computedStatus = getComputedStatus(exam)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookOpen size={20} className="text-[#2f80ed]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 text-base truncate">{exam.title}</h3>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                {exam.subject}
              </span>
            </div>
          </div>
          <div className="relative flex-shrink-0 ml-2">
            <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20">
                <button onClick={() => { navigate(`/faculty/exams/${exam.id}`); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Eye size={14} className="text-[#2f80ed]" /> View Details
                </button>
                {exam.status === 'DRAFT' && (
                  <button onClick={() => { navigate(`/faculty/exams/${exam.id}/edit`); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Edit size={14} className="text-[#2f80ed]" /> Edit Exam
                  </button>
                )}
                <button onClick={() => { onCopy(exam.id); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Copy size={14} className="text-[#2f80ed]" /> Duplicate
                </button>
                {['DRAFT', 'SCHEDULED'].includes(exam.status) && (
                  <button onClick={() => { onDelete(exam.id); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Duration</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">{exam.duration}<span className="text-xs font-normal text-slate-500"> m</span></p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Questions</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">{exam._count?.questions ?? exam.questionCount ?? (exam.questions ? exam.questions.length : 0)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Marks</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">{exam.totalMarks}</p>
          </div>
        </div>

        {startTime && (
          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-600 flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-[#2f80ed] flex-shrink-0" />
            <span className="font-normal truncate">
              {startTime.toLocaleDateString()} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {endTime && ` → ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <ExamStatusBadge status={computedStatus} />
        <button onClick={() => navigate(`/faculty/exams/${exam.id}`)}
          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2f80ed] rounded-lg text-xs font-semibold transition-colors cursor-pointer">
          {computedStatus === 'ACTIVE' ? 'Monitor Live' : 'View Details'} <ChevronRight size={13} />
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
  const [examToDelete, setExamToDelete] = useState(null)

  const fetchExams = async () => {
    setLoading(true)
    try {
      const res = await api.get('/faculty/exams')
      setExams(res.data.exams || res.data || [])
    } catch { toast.error('Failed to load exams') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchExams() }, [])

  const handleDelete = (id) => {
    setExamToDelete(id)
  }

  const performDelete = async () => {
    if (!examToDelete) return
    try {
      await api.delete(`/faculty/exams/${examToDelete}`)
      toast.success('Exam deleted')
      fetchExams()
    } catch { toast.error('Failed to delete exam') }
    finally { setExamToDelete(null) }
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
    
    const computed = getComputedStatus(e)

    let matchStatus = !filterStatus
    if (filterStatus === 'SCHEDULED') {
      matchStatus = computed === 'SCHEDULED' || e.status === 'SCHEDULED' || e.status === 'PUBLISHED'
    } else if (filterStatus === 'ACTIVE') {
      matchStatus = computed === 'ACTIVE' || e.status === 'ACTIVE'
    } else if (filterStatus === 'ENDED') {
      matchStatus = computed === 'ENDED' || e.status === 'ENDED' || e.status === 'COMPLETED'
    } else if (filterStatus === 'DRAFT') {
      matchStatus = e.status === 'DRAFT'
    } else if (filterStatus) {
      matchStatus = e.status === filterStatus || computed === filterStatus
    }

    return matchSearch && matchStatus
  })

  // Summary counts
  const totalCount = exams.length
  const activeCount = exams.filter(e => getComputedStatus(e) === 'ACTIVE').length
  const scheduledCount = exams.filter(e => getComputedStatus(e) === 'SCHEDULED' || e.status === 'PUBLISHED').length
  const endedCount = exams.filter(e => getComputedStatus(e) === 'ENDED').length

  return (
    <DashboardLayout title="My Exams">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Exams</h1>
          <p className="text-sm text-slate-500 font-normal mt-0.5">Manage, schedule, and monitor online examination sessions</p>
        </div>
        <Link to="/faculty/exams/create"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2f80ed] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-xl shadow-xs transition-all">
          <Plus size={18} /> Create New Exam
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Exams</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Live
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-[#2f80ed]">Scheduled</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{scheduledCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Ended / Completed</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{endedCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search exams by title or course subject..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2f80ed] transition" 
          />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {['', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'ENDED'].map(status => (
            <button 
              key={status} 
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${filterStatus === status ? 'bg-[#2f80ed] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-60 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-xs">
          <BookOpen size={48} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No exams match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-normal">
            {search || filterStatus ? 'Try adjusting your search query or status tab filter.' : 'You have not created any exam sessions yet.'}
          </p>
          {search || filterStatus ? (
            <button
              onClick={() => { setSearch(''); setFilterStatus('') }}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Clear Search & Filters
            </button>
          ) : (
            <Link to="/faculty/exams/create"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#2f80ed] text-white font-semibold text-xs rounded-xl hover:bg-[#2563eb] transition-colors shadow-xs">
              <Plus size={16} /> Create your first exam
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(exam => (
            <ExamCard key={exam.id} exam={exam} onDelete={handleDelete} onCopy={handleCopy} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!examToDelete}
        onOpenChange={(open) => { if (!open) setExamToDelete(null) }}
        title="Delete Examination?"
        description="Are you sure you want to delete this exam? All associated student assignments and records for this exam will be permanently removed. This action cannot be undone."
        confirmText="Delete Exam"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={performDelete}
      />
    </DashboardLayout>
  )
}
