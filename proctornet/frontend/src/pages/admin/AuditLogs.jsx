import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { ClipboardList, Search, RefreshCw, Filter } from 'lucide-react'

const ACTION_COLORS = {
  ADMIN_LOGIN: 'bg-blue-100 text-blue-700',
  FACULTY_LOGIN: 'bg-indigo-100 text-indigo-700',
  STUDENT_LOGIN: 'bg-emerald-100 text-emerald-700',
  FACULTY_REGISTERED: 'bg-amber-100 text-amber-700',
  STUDENT_REGISTERED: 'bg-amber-100 text-amber-700',
  FACULTY_APPROVED: 'bg-green-100 text-green-700',
  STUDENT_APPROVED: 'bg-green-100 text-green-700',
  FACULTY_SUSPENDED: 'bg-red-100 text-red-700',
  STUDENT_SUSPENDED: 'bg-red-100 text-red-700',
  EXAM_CREATED: 'bg-purple-100 text-purple-700',
  EXAM_STARTED: 'bg-blue-100 text-blue-700',
  EXAM_ENDED: 'bg-gray-100 text-gray-700',
  INVIGILATOR_LOGIN: 'bg-teal-100 text-teal-700',
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get('/admin/audit-logs', { params: { page, limit: PER_PAGE, search, role: filterRole } })
        setLogs(res.data.logs || res.data || [])
      } catch { console.error('Failed to load audit logs') }
      finally { setLoading(false) }
    }
    load()
  }, [page, filterRole])

  const filtered = logs.filter(l =>
    !search ||
    (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.userRole || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.ipAddress || '').includes(search) ||
    (l.details || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout title="Audit Logs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all system actions and user activities</p>
        </div>
        <button onClick={() => { setPage(1); window.location.reload() }}
          className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action, IP, or details…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Roles</option>
          {['admin', 'faculty', 'student', 'invigilator'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Timestamp','Role','Action','Details','IP Address'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 capitalize">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{log.userRole}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-xs truncate">{log.details || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">{filtered.length} entries</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1.5 text-xs text-gray-600">Page {page}</span>
                <button disabled={filtered.length < PER_PAGE} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
