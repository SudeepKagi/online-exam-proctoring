import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Award,
  ShieldCheck,
  X,
  BookOpen,
  Eye
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function ResultDetailModal({ result, onClose }) {
  if (!result) return null
  const isPassed = (result.percentage || 0) >= 40
  const title = result.title || result.examTitle || result.exam?.title || 'Assessment'
  const subject = result.code || result.subject || result.exam?.subject || 'General'
  const score = result.score ?? result.totalScore ?? 0
  const maxScore = result.maxScore ?? result.totalMarks ?? (result.exam?.totalMarks || 100)
  const percentage = Math.round(result.percentage ?? ((score / (maxScore || 1)) * 100))
  const flags = result.flags ?? result.flagCount ?? 0

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl max-w-lg w-full p-6 text-[#0f172a] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">{title}</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Subject: <span className="font-semibold text-[#0f172a]">{subject}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isPassed
                  ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                  : 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
              }`}
            >
              {isPassed ? 'PASSED' : 'FAILED'}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 6 Clean Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Total Score</p>
            <p className="font-mono font-bold text-sm text-[#0f172a] mt-1">
              {score} <span className="text-xs text-[#94a3b8]">/ {maxScore}</span>
            </p>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Percentage</p>
            <p className={`font-mono font-bold text-sm mt-1 ${isPassed ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              {percentage}%
            </p>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Integrity Flags</p>
            <p className="font-mono font-bold text-sm text-[#0f172a] mt-1">
              {flags === 0 ? (
                <span className="text-[#10b981]">0 (Clean)</span>
              ) : (
                <span className="text-[#ef4444]">{flags} flags</span>
              )}
            </p>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Evaluation Date</p>
            <p className="text-xs font-semibold text-[#0f172a] mt-1">
              {result.gradedAt || result.createdAt
                ? new Date(result.gradedAt || result.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : '—'}
            </p>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Duration</p>
            <p className="text-xs font-semibold text-[#0f172a] mt-1">
              {result.timeTaken ? `${Math.round(result.timeTaken / 60)} mins` : `${result.exam?.duration || 10} mins`}
            </p>
          </div>

          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Biometrics</p>
            <p className="text-xs font-bold text-[#10b981] mt-1 flex items-center gap-1">
              <ShieldCheck size={13} /> VERIFIED
            </p>
          </div>
        </div>

        {/* Itemized Question Breakdown */}
        {result.answers && result.answers.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-xs font-bold text-[#0f172a]">Itemized Question Breakdown</h4>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {result.answers.map((a, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs space-y-1">
                  <p className="font-semibold text-[#0f172a] text-xs">
                    Q{i + 1}. {a.question?.text?.slice(0, 75)}…
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className={a.isCorrect ? 'text-[#10b981] font-bold' : 'text-[#ef4444] font-bold'}>
                      {a.isCorrect ? `Correct (+${a.marksAwarded})` : `Incorrect (${a.marksAwarded})`}
                    </span>
                    <span className="text-[#64748b]">Selected: {a.selectedOption || a.writtenText || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#f1f5f9] mt-4">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StudentResults() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  // Filter & Pagination States
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL') // ALL, PASSED, FAILED, FLAGGED
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    api.get('/student/results')
      .then((r) => setResults(r.data.results || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Standardize dataset
  const formattedResults = results.map((r) => {
    const title = r.title || r.examTitle || r.exam?.title || 'Assessment'
    const code = r.code || r.subject || r.exam?.subject || 'GEN101'
    const rawDate = r.date || r.createdAt
    const date = rawDate
      ? new Date(rawDate).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '—'
    const score = r.score ?? r.totalScore ?? 0
    const maxScore = r.maxScore ?? r.totalMarks ?? (r.exam?.totalMarks || 100)
    const percentage = Math.round(r.percentage ?? ((score / (maxScore || 1)) * 100))
    const flags = r.flags ?? r.flagCount ?? 0
    const isPassed = percentage >= 40 || r.status === 'PASSED' || r.finalStatus === 'PASSED'
    const status = isPassed ? 'PASSED' : 'FAILED'

    return {
      ...r,
      title,
      code,
      date,
      score,
      maxScore,
      percentage,
      flags,
      isPassed,
      status
    }
  })

  const avgScore =
    formattedResults.length > 0
      ? Math.round(formattedResults.reduce((s, r) => s + (r.percentage || 0), 0) / formattedResults.length)
      : 0

  const bestScore = formattedResults.length > 0 ? Math.max(...formattedResults.map((r) => r.percentage || 0)) : 0
  const passedCount = formattedResults.filter((r) => r.isPassed).length
  const flaggedCount = formattedResults.filter((r) => r.flags > 0).length
  const passRate = formattedResults.length > 0 ? Math.round((passedCount / formattedResults.length) * 100) : 0

  // Filtered dataset
  const filtered = formattedResults.filter((r) => {
    const title = r.title.toLowerCase()
    const code = r.code.toLowerCase()
    const q = search.toLowerCase()
    const matchSearch = !search || title.includes(q) || code.includes(q)

    if (filterStatus === 'PASSED') return matchSearch && r.isPassed
    if (filterStatus === 'FAILED') return matchSearch && !r.isPassed
    if (filterStatus === 'FLAGGED') return matchSearch && r.flags > 0
    return matchSearch
  })

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <DashboardLayout title="Student Workspace">
      <ResultDetailModal result={selected} onClose={() => setSelected(null)} />

      <div className="space-y-6 font-sans text-slate-900">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Exam Results & Integrity Docket
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-0.5">
            Automated scoring breakdown and proctoring audit log.
          </p>
        </div>

        {/* ── Bento Stat Section: Hero Card + Slim Secondary Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Primary Hero Stat Card */}
          <Card className="lg:col-span-1 border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Cumulative Performance
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#2f80ed] border border-blue-200">
                  {formattedResults.length} EXAMS
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-slate-900">
                    {avgScore}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">average score</span>
                </div>
                {/* Progress bar visual */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full mt-3 overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-[#2f80ed] rounded-full transition-all"
                    style={{ width: `${Math.min(Math.max(avgScore, 4), 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 text-slate-500 font-semibold">
                <span>
                  Pass Rate: <strong className="text-slate-900 font-extrabold">{passRate}%</strong>
                </span>
                <span>
                  Highest: <strong className="text-emerald-600 font-extrabold">{bestScore}%</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Slim Secondary Metrics Row */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Evaluated Tests
              </span>
              <p className="text-3xl font-extrabold font-mono text-slate-900 mt-2">
                {formattedResults.length}
              </p>
              <span className="text-xs text-slate-500 font-semibold mt-1">Submitted sessions</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Passed Assessments
              </span>
              <p className="text-3xl font-extrabold font-mono text-emerald-600 mt-2">
                {passedCount}
              </p>
              <span className="text-xs text-slate-500 font-semibold mt-1">≥ 40% pass criteria</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Integrity Flags
              </span>
              <p className="text-3xl font-extrabold font-mono text-rose-600 mt-2">
                {flaggedCount}
              </p>
              <span className="text-xs text-slate-500 font-semibold mt-1">Camera / tab alerts</span>
            </div>
          </div>
        </div>

        {/* ── Table & Filter Header ── */}
        <Card className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Evaluated Candidate Dossier</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Filtering and proctoring audit log.</p>
              </div>

              {/* Functional Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Search title or code..."
                    className="w-full pl-9 pr-3 py-1.5 border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-[#f8fafc] focus:bg-white focus:outline-none focus:border-[#2f80ed] transition"
                  />
                </div>

                <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1">
                  {['ALL', 'PASSED', 'FAILED', 'FLAGGED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status)
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        filterStatus === status
                          ? 'bg-[#2f80ed] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-[#f8fafc] border border-slate-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">
                No matching evaluated exams found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-[#f8fafc]">
                    <TableHead className="text-xs font-extrabold uppercase tracking-wider text-slate-500 pl-5 py-3.5">
                      Exam Assessment
                    </TableHead>
                    <TableHead className="text-xs font-extrabold uppercase tracking-wider text-slate-500 py-3.5">
                      Evaluation Date
                    </TableHead>
                    <TableHead className="text-xs font-extrabold uppercase tracking-wider text-slate-500 py-3.5">
                      Score & Percentage
                    </TableHead>
                    <TableHead className="text-xs font-extrabold uppercase tracking-wider text-slate-500 py-3.5">
                      Proctoring Integrity
                    </TableHead>
                    <TableHead className="text-xs font-extrabold uppercase tracking-wider text-slate-500 py-3.5">
                      Status
                    </TableHead>
                    <TableHead className="text-xs text-right font-extrabold uppercase tracking-wider text-slate-500 pr-5 py-3.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {paginated.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Exam Title */}
                      <TableCell className="text-xs font-extrabold text-slate-900 pl-5 py-3.5">
                        <div className="flex flex-col">
                          <span>{r.title}</span>
                          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">{r.code}</span>
                        </div>
                      </TableCell>

                      {/* Evaluation Date */}
                      <TableCell className="text-xs text-slate-500 font-semibold py-3.5">
                        {r.date}
                      </TableCell>

                      {/* Score & Percentage */}
                      <TableCell className="text-xs py-3.5">
                        <span className="font-extrabold text-slate-900">{r.score}</span>
                        <span className="text-slate-400 font-semibold"> / {r.maxScore}</span>
                        <span
                          className={`ml-2 font-extrabold ${
                            r.isPassed ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          ({r.percentage}%)
                        </span>
                      </TableCell>

                      {/* Proctoring Integrity */}
                      <TableCell className="text-xs py-3.5">
                        {r.flags === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle size={11} /> 0 Flags (Verified)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            <AlertTriangle size={11} /> {r.flags} Flags Recorded
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            r.isPassed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right pr-5 py-3.5">
                        <button
                          onClick={() => setSelected(r)}
                          className="px-3.5 py-1.5 text-xs font-extrabold rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2f80ed] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#f1f5f9] text-xs text-[#64748b] bg-[#f8fafc]">
              <span>
                Showing Page <strong className="text-[#0f172a]">{currentPage}</strong> of{' '}
                <strong className="text-[#0f172a]">{totalPages}</strong> ({filtered.length} total entries)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
