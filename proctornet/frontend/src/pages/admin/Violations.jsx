import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { AlertTriangle, Search, RefreshCw, Eye, Filter } from 'lucide-react'

function SeverityBadge({ severity }) {
  const cls = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[severity] || cls.LOW}`}>
      {severity}
    </span>
  )
}

const EVENT_LABELS = {
  tab_switch: 'Tab Switch',
  window_blur: 'Window Blur',
  fullscreen_exit: 'Fullscreen Exit',
  multiple_faces: 'Multiple Faces',
  no_face: 'No Face Detected',
  face_mismatch: 'Face Mismatch',
  vpn_disconnected: 'VPN Disconnected',
  keyboard_shortcut: 'Keyboard Shortcut',
  copy_attempt: 'Copy Attempt',
}

export default function AdminViolations() {
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/violations')
        setViolations(res.data.violations || res.data || [])
      } catch { console.error('Failed to load violations') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = violations.filter(v => {
    const matchSearch = (v.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.examTitle || '').toLowerCase().includes(search.toLowerCase())
    const matchSeverity = !filterSeverity || v.severity === filterSeverity
    const matchType = !filterType || v.eventType === filterType
    return matchSearch && matchSeverity && matchType
  })

  const stats = {
    total: violations.length,
    high: violations.filter(v => ['HIGH', 'CRITICAL'].includes(v.severity)).length,
    medium: violations.filter(v => v.severity === 'MEDIUM').length,
    low: violations.filter(v => v.severity === 'LOW').length,
  }

  return (
    <DashboardLayout title="Violations">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Violations Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">All security events and proctoring flags</p>
        </div>
        <button onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Flags', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'High/Critical', value: stats.high, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Medium', value: stats.medium, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Low', value: stats.low, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl p-4 ${bg} border border-gray-100`}>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or exam…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Severities</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Violation Detail</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xl">×</button>
            </div>
            <div className="space-y-3">
              {selected.cameraFrameUrl && (
                <img src={selected.cameraFrameUrl} alt="Camera frame" className="w-full rounded-xl object-cover max-h-48" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Student', selected.studentName || 'N/A'],
                  ['USN', selected.studentUsn || 'N/A'],
                  ['Exam', selected.examTitle || 'N/A'],
                  ['Type', EVENT_LABELS[selected.eventType] || selected.eventType],
                  ['Severity', selected.severity],
                  ['Time', selected.timestamp ? new Date(selected.timestamp).toLocaleString() : 'N/A'],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
              {selected.details && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-medium">Details</p>
                  <p className="text-sm text-gray-700 mt-0.5">{selected.details}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No violations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Student','Exam','Event Type','Severity','Time','Action'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{v.studentName || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs max-w-32 truncate">{v.examTitle || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-700">{EVENT_LABELS[v.eventType] || v.eventType}</td>
                    <td className="px-5 py-3.5"><SeverityBadge severity={v.severity} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelected(v)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                        <Eye size={12} /> View
                      </button>
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
