import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { getErrorMessage } from '@/utils/errorUtils'
import { Search, ChevronLeft, ChevronRight, Download, BarChart2, ShieldAlert, Award, User, X, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'

function extractResultData(r) {
  if (!r) return {}
  const student = r.student || r.studentExam?.student || {}
  const exam = r.exam || r.studentExam?.exam || {}
  
  const studentName = r.studentName || student.name || 'Student Candidate'
  const usn = r.usn || student.usn || 'N/A'
  const examTitle = r.examTitle || exam.title || 'Examination'
  const score = r.totalScore !== undefined ? r.totalScore : (r.score !== undefined ? r.score : 0)
  const totalMarks = r.totalMarks !== undefined ? r.totalMarks : (exam.totalMarks || 100)
  const percentage = r.percentage !== undefined ? r.percentage : (totalMarks > 0 ? (score / totalMarks) * 100 : 0)
  const flags = r.flags !== undefined ? r.flags : (r.violationsCount !== undefined ? r.violationsCount : (r.studentExam?.violationsCount || 0))
  const status = r.finalStatus || r.status || (percentage >= 40 ? 'PASSED' : 'FAILED')

  return { studentName, usn, examTitle, score, totalMarks, percentage, flags, status, raw: r }
}

export default function FacultyResults() {
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedResult, setSelectedResult] = useState(null)
  const pageSize = 8

  const loadResults = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get('/faculty/results')
      setResults(r.data.results || r.data || [])
    } catch (err) {
      console.error('[FacultyResults] Fetch failed:', err)
      setError(getErrorMessage(err, 'Failed to load examination results.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResults()
  }, [])

  const handleExportCSV = async (examId) => {
    try {
      const targetExamId = examId || (results[0]?.raw?.examId || results[0]?.raw?.exam?.id || results[0]?.raw?.id || 'all')
      
      const res = await api.get(`/faculty/exams/${targetExamId}/export-csv`, {
        responseType: 'blob'
      })

      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Faculty_Exam_Results_Report.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CSV Audit Report downloaded successfully!')
    } catch (err) {
      console.error('[Export CSV Error]', err)
      toast.error('Failed to export CSV report')
    }
  }

  const parsedResults = results.map(extractResultData)

  const filtered = parsedResults.filter(r =>
    (r.examTitle || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.usn || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Metrics
  const totalEvaluated = parsedResults.length
  const passedCount = parsedResults.filter(r => r.percentage >= 40).length
  const passRate = totalEvaluated > 0 ? ((passedCount / totalEvaluated) * 100).toFixed(1) : '0.0'
  const alertCount = parsedResults.reduce((acc, r) => acc + (r.flags || 0), 0)
  const avgScore = totalEvaluated > 0 ? (parsedResults.reduce((acc, r) => acc + r.percentage, 0) / totalEvaluated).toFixed(1) : '0.0'

  return (
    <DashboardLayout title="Faculty Workspace">
      <div className="flex flex-col gap-6 font-sans">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Exam Evaluation & Results</h1>
            <p className="text-sm text-slate-500 font-normal mt-0.5">Automated scoring breakdown, candidate performance metrics, and security audit reports.</p>
          </div>

          <button
            onClick={() => handleExportCSV()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2f80ed] hover:bg-[#2563eb] text-white font-semibold text-xs rounded-xl shadow-xs transition-all self-start sm:self-auto cursor-pointer"
          >
            <Download size={16} /> Export CSV Audit Report
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Evaluated Results</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2">{totalEvaluated}</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Student submissions</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <Award size={14} /> Class Pass Rate
            </p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2">{passRate}%</p>
            <p className="text-xs font-normal text-slate-500 mt-1">{passedCount} of {totalEvaluated} passed</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <ShieldAlert size={14} /> Security Flags
            </p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2">{alertCount}</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Total proctor alerts</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-[#2f80ed]">Average Percentage</p>
            <p className="text-3xl font-bold tracking-tight text-[#2f80ed] mt-2">{avgScore}%</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Mean evaluated score</p>
          </div>
        </div>

        {/* Results Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Evaluated Results Dossier</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Showing {filtered.length} of {totalEvaluated} evaluated student entries</p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search exam title, student name, or USN..."
                className="w-full pl-10 pr-9 py-2.5 border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-[#f8fafc] focus:bg-white focus:outline-none focus:border-[#2f80ed] transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 border-3 border-[#2f80ed] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-slate-500 font-semibold">Loading evaluated results…</p>
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Unable to Load Examination Results"
                message={error}
                onRetry={loadResults}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Award}
                title={search ? 'No Matching Results' : 'No Evaluated Results Yet'}
                description={
                  search
                    ? `No candidate results matched your search term "${search}". Try clearing your filter.`
                    : 'Candidate submissions will automatically populate here once students complete their tests.'
                }
                actionText={search ? 'Clear Search Filter' : undefined}
                onAction={search ? () => setSearch('') : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Exam Title</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Student Candidate</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Score & Percentage</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Security Alerts</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((r, idx) => {
                    const isPassed = r.percentage >= 40
                    return (
                      <tr key={r.raw?.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 text-xs font-semibold text-slate-900">
                          {r.examTitle}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-[#2f80ed] font-bold text-xs flex items-center justify-center shrink-0">
                              {r.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900">{r.studentName}</p>
                              <span className="text-[11px] font-normal text-slate-500 font-mono">
                                {r.usn}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{r.score}</span>
                            <span className="text-xs font-normal text-slate-400">/ {r.totalMarks}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              ({r.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                            r.flags === 0 
                              ? 'bg-slate-100 text-slate-600 border-slate-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {r.flags === 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                            {r.flags === 0 ? 'No Alerts' : `${r.flags} Violation Alerts`}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                            isPassed 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isPassed ? '✓ PASSED' : '✕ FAILED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedResult(r)}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2f80ed] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs font-normal text-slate-500 bg-slate-50/50">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 font-medium cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 font-medium cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
                <BarChart2 size={18} className="text-[#2f80ed]" /> Evaluation Summary
              </div>
              <button 
                onClick={() => setSelectedResult(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <h3 className="font-semibold text-slate-900 text-base">{selectedResult.examTitle}</h3>
                <p className="text-xs text-[#2f80ed] font-medium mt-0.5">Candidate: {selectedResult.studentName} ({selectedResult.usn})</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Score</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{selectedResult.score} / {selectedResult.totalMarks}</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Percentage</p>
                  <p className={`text-xl font-bold mt-1 ${selectedResult.percentage >= 40 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedResult.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 bg-slate-50/75 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-normal">Evaluation Status:</span>
                  <span className={`font-semibold px-2.5 py-0.5 rounded-full text-[11px] ${selectedResult.percentage >= 40 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {selectedResult.percentage >= 40 ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-normal">Security Violations:</span>
                  <span className={`font-semibold ${selectedResult.flags > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {selectedResult.flags === 0 ? '0 Security Alerts' : `${selectedResult.flags} Alert Events`}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-5 py-2 bg-[#2f80ed] hover:bg-[#2563eb] text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
