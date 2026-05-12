import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Video, Search, RefreshCw, Eye, Clock, CheckCircle } from 'lucide-react'

export default function AdminInvigilators() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/invigilator-sessions')
      setSessions(res.data.sessions || res.data || [])
    } catch { console.error('Failed to load sessions') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = sessions.filter(s =>
    !search ||
    (s.invId || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.exam?.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout title="Invigilators">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invigilator Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all invigilator login sessions</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID or exam…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Session Detail</h3>
            <div className="space-y-3">
              {selected.idCardPhotoUrl && selected.idCardPhotoUrl !== 'placeholder_id' && (
                <img src={selected.idCardPhotoUrl} alt="ID" className="w-full rounded-xl max-h-48 object-cover" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Invigilator ID', selected.invId],
                  ['Exam', selected.exam?.title || selected.examId],
                  ['Login Time', selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'],
                  ['Session Expiry', selected.sessionExpiry ? new Date(selected.sessionExpiry).toLocaleString() : '—'],
                  ['IP Address', selected.ipAddress || '—'],
                  ['Status', selected.isActive ? 'Active' : 'Expired'],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className={`font-semibold text-sm mt-0.5 ${label === 'Status' ? (selected.isActive ? 'text-green-600' : 'text-gray-400') : 'text-gray-800'}`}>{val}</p>
                  </div>
                ))}
              </div>
              {selected.idCardOcrResult && (
                <div className="bg-blue-50 rounded-xl p-3 text-sm">
                  <p className="text-xs text-gray-400 mb-0.5">OCR Extracted Name</p>
                  <p className="font-semibold text-gray-800">{selected.idCardOcrResult}</p>
                </div>
              )}
            </div>
            <button onClick={() => setSelected(null)}
              className="mt-4 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Video size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No invigilator sessions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Invigilator ID','Exam','Login Time','Session Expiry','IP','Status','Action'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{s.invId}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-32 truncate">{s.exam?.title || s.examId}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{s.sessionExpiry ? new Date(s.sessionExpiry).toLocaleString() : '—'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{s.ipAddress || '—'}</td>
                    <td className="px-5 py-3.5">
                      {s.isActive
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Active</span>
                        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">Expired</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelected(s)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
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
