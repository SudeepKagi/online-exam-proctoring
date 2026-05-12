import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Trophy, BookOpen, TrendingUp, Target, BarChart2, Download, Eye, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function ScoreBar({ percentage }) {
  const color = percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${percentage >= 75 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
        {percentage}%
      </span>
    </div>
  )
}

function ResultDetailModal({ result, onClose }) {
  if (!result) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">{result.exam?.title || result.examTitle}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            ['Score', `${result.totalScore} / ${result.exam?.totalMarks || result.totalMarks}`],
            ['Percentage', `${result.percentage || 0}%`],
            ['Date', result.gradedAt ? new Date(result.gradedAt).toLocaleDateString() : '—'],
            ['Duration', result.exam?.duration ? `${result.exam.duration} min` : '—'],
            ['Questions', result.exam?._count?.questions ?? '—'],
            ['Status', (result.percentage || 0) >= 40 ? 'Passed' : 'Failed'],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`font-semibold mt-0.5 ${label === 'Status' ? ((result.percentage || 0) >= 40 ? 'text-green-600' : 'text-red-500') : 'text-gray-800'}`}>{val}</p>
            </div>
          ))}
        </div>

        {result.answers && result.answers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Question-wise Breakdown</h4>
            <div className="space-y-2">
              {result.answers.map((a, i) => (
                <div key={i} className={`p-3 rounded-xl border ${a.isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-xs font-medium text-gray-700">Q{i + 1}. {a.question?.text?.slice(0, 80)}…</p>
                  <p className={`text-xs mt-1 font-semibold ${a.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                    {a.isCorrect ? `✓ Correct (+${a.marksAwarded})` : `✗ Wrong (${a.marksAwarded})`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StudentResults() {
  const { user } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.get('/student/results')
      .then(r => setResults(r.data.results || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length)
    : null

  const bestScore = results.length > 0 ? Math.max(...results.map(r => r.percentage || 0)) : null
  const passed = results.filter(r => (r.percentage || 0) >= 40).length

  return (
    <DashboardLayout title="My Results">
      <ResultDetailModal result={selected} onClose={() => setSelected(null)} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your exam performance and score history</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
        ) : [
          { label: 'Exams Taken', value: results.length, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Average Score', value: avgScore !== null ? `${avgScore}%` : '—', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Best Score', value: bestScore !== null ? `${bestScore}%` : '—', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Passed', value: passed, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : results.length === 0 ? (
          <div className="p-14 text-center">
            <BarChart2 size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No exam results yet</p>
            <p className="text-sm text-gray-400 mt-1">Your results will appear here after exams are graded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Exam','Subject','Score','Performance','Date','Action'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{r.exam?.title || r.examTitle}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{r.exam?.subject || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${(r.percentage || 0) >= 40 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.totalScore} / {r.exam?.totalMarks || r.totalMarks}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 w-36">
                      <ScoreBar percentage={r.percentage || 0} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {r.gradedAt ? new Date(r.gradedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelected(r)}
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
