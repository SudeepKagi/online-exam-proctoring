import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BarChart2, Download, Eye, X, TrendingUp, Users, Trophy } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function ScoreBar({ pct }) {
  const c = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <span className="text-xs font-bold text-gray-600 w-8">{pct}%</span>
    </div>
  )
}

export default function FacultyResults() {
  const { id: examId } = useParams()
  const [results, setResults] = useState([])
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    const url = examId ? `/faculty/exams/${examId}/results` : '/faculty/results'
    Promise.all([
      api.get(url),
      examId ? api.get(`/faculty/exams/${examId}`) : Promise.resolve(null)
    ]).then(([rRes, eRes]) => {
      setResults(rRes.data.results || rRes.data || [])
      if (eRes) setExam(eRes.data.exam)
    }).catch(console.error).finally(() => setLoading(false))
  }, [examId])

  const avg = results.length ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length) : 0
  const passed = results.filter(r => (r.percentage || 0) >= 40).length
  const chartData = results.slice(0, 20).map((r, i) => ({ name: r.student?.usn || `S${i+1}`, score: r.percentage || 0 }))

  const handleRelease = async () => {
    if (!examId || !confirm('Release results to students?')) return
    setReleasing(true)
    try {
      await api.patch(`/faculty/exams/${examId}/results/release`)
      toast.success('Results released to students')
    } catch { toast.error('Failed to release results') }
    finally { setReleasing(false) }
  }

  return (
    <DashboardLayout title={examId ? 'Exam Results' : 'All Results'}>
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{selected.student?.name || 'Student'}</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['USN', selected.student?.usn], ['Score', `${selected.totalScore} / ${selected.exam?.totalMarks || '?'}`], ['Percentage', `${selected.percentage || 0}%`], ['Status', (selected.percentage || 0) >= 40 ? 'Passed' : 'Failed']].map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">{l}</p><p className="font-semibold text-gray-800 mt-0.5">{v}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{exam ? exam.title : 'All Exam Results'}</h1>
          <p className="text-sm text-gray-500">{results.length} submissions</p>
        </div>
        {examId && (
          <button onClick={handleRelease} disabled={releasing}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
            {releasing ? 'Releasing…' : 'Release to Students'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Submissions', value: results.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Average Score', value: `${avg}%`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Passed', value: `${passed}/${results.length}`, icon: Trophy, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}><Icon size={18} className={color} /></div>
            <div><p className="text-xs text-gray-400">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip /><Bar dataKey="score" fill="#4F46E5" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center"><BarChart2 size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No results yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                {['Student','USN','Score','Performance','Date','Action'].map(h => <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{r.student?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{r.student?.usn || '—'}</td>
                    <td className="px-5 py-3.5"><span className={`font-bold ${(r.percentage||0) >= 40 ? 'text-green-600' : 'text-red-500'}`}>{r.totalScore}</span></td>
                    <td className="px-5 py-3.5 w-36"><ScoreBar pct={r.percentage || 0} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{r.submittedAt || r.gradedAt ? new Date(r.submittedAt || r.gradedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelected(r)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
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
