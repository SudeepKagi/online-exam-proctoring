import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BookOpen, Users, Eye, Search, RefreshCw } from 'lucide-react'

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
      {status === 'ACTIVE' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
      {status}
    </span>
  )
}

export default function AdminExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/exams')
      setExams(res.data.exams || res.data || [])
    } catch { console.error('Failed to load exams') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = exams.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.faculty?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || e.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    active: exams.filter(e => e.status === 'ACTIVE').length,
    scheduled: exams.filter(e => e.status === 'SCHEDULED').length,
    ended: exams.filter(e => e.status === 'ENDED').length,
  }

  return (
    <DashboardLayout title="Exams Overview">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Exams</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform-wide exam monitoring</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Active Now', value: stats.active, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats.ended, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl p-4 ${bg} border border-gray-100`}>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exams or faculty…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {['', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'ENDED'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterStatus === s ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No exams found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Exam Title','Faculty','Department','Questions','Status','Time Window'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(exam => (
                  <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">{exam.title}</p>
                      <p className="text-xs text-gray-400">{exam.subject}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{exam.faculty?.name || '—'}</td>
                    <td className="px-5 py-3.5">
                      {exam.allowedDepartments?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {exam.allowedDepartments.slice(0, 2).map(d => (
                            <span key={d} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{d}</span>
                          ))}
                          {exam.allowedDepartments.length > 2 && <span className="text-xs text-gray-400">+{exam.allowedDepartments.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{exam._count?.questions ?? exam.questionCount ?? '—'}</td>
                    <td className="px-5 py-3.5"><ExamStatusBadge status={exam.status} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {exam.startTime ? new Date(exam.startTime).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
