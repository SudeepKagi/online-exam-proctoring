import React, { useState } from 'react'
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
  X
} from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function DataTable({ data = [] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedResult, setSelectedResult] = useState(null)
  const pageSize = 5

  const listData = Array.isArray(data) ? data : []

  const formattedData = listData.map((r) => {
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

  const filtered = formattedData.filter((item) => {
    const title = item.title.toLowerCase()
    const code = item.code.toLowerCase()
    const q = search.toLowerCase()
    const matchSearch = !search || title.includes(q) || code.includes(q)

    if (filterStatus === 'PASSED') return matchSearch && item.isPassed
    if (filterStatus === 'FAILED') return matchSearch && !item.isPassed
    if (filterStatus === 'FLAGGED') return matchSearch && item.flags > 0
    return matchSearch
  })

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xs font-sans overflow-hidden">
      {/* Header with Search and Filter Toolbar */}
      <div className="p-5 pb-4 border-b border-[#f1f5f9]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Recent Exam Results</h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Detailed list of evaluated exam scores and session audit flags.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search exam or subject..."
                className="pl-9 h-8 text-xs bg-[#f8fafc] border-[#e2e8f0] focus:border-[#2563eb]"
                aria-label="Search exam name"
              />
            </div>

            <div className="flex bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl p-1">
              {['ALL', 'PASSED', 'FAILED', 'FLAGGED'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status)
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterStatus === status
                      ? 'bg-white text-[#2563eb] shadow-2xs'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                  aria-pressed={filterStatus === status}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] pl-5 py-3.5">
                Exam Title
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] py-3.5">
                Course Code
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] py-3.5">
                Date
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] py-3.5">
                Score
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] py-3.5">
                Security Alerts
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748b] py-3.5">
                Status
              </TableHead>
              <TableHead className="text-xs text-right font-bold uppercase tracking-wider text-[#64748b] pr-5 py-3.5">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[#f1f5f9]">
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-[#94a3b8] text-xs font-medium">
                  No matching exam records found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow key={r.id} className="hover:bg-[#f8fafc] transition-colors">
                  {/* Exam Title */}
                  <TableCell className="text-xs font-bold text-[#0f172a] pl-5 py-3.5">
                    {r.title}
                  </TableCell>

                  {/* Course Code / Subject */}
                  <TableCell className="py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                      {r.code}
                    </span>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-xs text-[#64748b] font-medium py-3.5">
                    {r.date}
                  </TableCell>

                  {/* Score */}
                  <TableCell className="text-xs py-3.5">
                    <span className="font-bold text-[#0f172a]">{r.score}</span>
                    <span className="text-[#94a3b8]"> / {r.maxScore}</span>
                    <span
                      className={`ml-1.5 font-bold ${
                        r.isPassed ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}
                    >
                      ({r.percentage}%)
                    </span>
                  </TableCell>

                  {/* Security Alerts */}
                  <TableCell className="text-xs py-3.5">
                    {r.flags === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10b981] bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Clean Session
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ef4444] bg-[#fef2f2] border border-[#fecaca] px-2.5 py-0.5 rounded-full">
                        <AlertTriangle size={11} /> {r.flags} Flagged
                      </span>
                    )}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="py-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.isPassed
                          ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                          : 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                      }`}
                    >
                      {r.status}
                    </span>
                  </TableCell>

                  {/* View Details Action */}
                  <TableCell className="text-right pr-5 py-3.5">
                    <button
                      onClick={() => setSelectedResult(r)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] shadow-2xs hover:border-[#2563eb] transition-all cursor-pointer"
                    >
                      View Details
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
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
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Result Details Modal */}
      {selectedResult && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedResult(null)}
        >
          <div
            className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl max-w-md w-full p-6 text-[#0f172a] font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Assessment Evaluation</h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Official score and session integrity report
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Exam Info */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0f172a]">{selectedResult.title}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    Course: <span className="font-semibold text-[#0f172a]">{selectedResult.code}</span>
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedResult.isPassed
                      ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                      : 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                  }`}
                >
                  {selectedResult.status}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-[#64748b] block">Total Score</span>
                  <p className="text-base font-bold text-[#0f172a] mt-0.5">
                    {selectedResult.score} <span className="text-xs font-normal text-[#94a3b8]">/ {selectedResult.maxScore}</span>
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-[#64748b] block">Percentage</span>
                  <p
                    className={`text-base font-bold mt-0.5 ${
                      selectedResult.isPassed ? 'text-[#10b981]' : 'text-[#ef4444]'
                    }`}
                  >
                    {selectedResult.percentage}%
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-[#64748b] block">Date Evaluated</span>
                  <p className="text-xs font-semibold text-[#0f172a] mt-1">{selectedResult.date}</p>
                </div>

                <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-[#64748b] block">Security Incidents</span>
                  <p className="text-xs font-semibold mt-1">
                    {selectedResult.flags === 0 ? (
                      <span className="text-[#10b981]">0 Flags (Clean)</span>
                    ) : (
                      <span className="text-[#ef4444] font-bold">{selectedResult.flags} Flagged</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Proctoring Verification Banner */}
              <div className="p-3 rounded-xl bg-[#ecfdf5]/40 border border-[#a7f3d0] flex items-center gap-2.5 text-xs text-[#065f46]">
                <ShieldCheck size={16} className="text-[#10b981] shrink-0" />
                <span>
                  ProctorNet AI verified biometric integrity during this session.
                </span>
              </div>

              {/* Close Button */}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedResult(null)}
                  className="w-full py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
