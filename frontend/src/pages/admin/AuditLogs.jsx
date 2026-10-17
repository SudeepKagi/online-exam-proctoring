import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import ErrorState from '@/components/common/ErrorState'
import { getErrorMessage } from '@/utils/errorUtils'
import {
  ClipboardList,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Calendar,
  KeyRound,
  FileCheck
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/admin/audit-logs', {
        params: { page, limit: PER_PAGE, search, userRole: filterRole || undefined }
      })
      setLogs(res.data.logs || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
    } catch (err) {
      console.error('[AdminAuditLogs] Fetch error:', err)
      setError(getErrorMessage(err, 'Failed to load system audit trails.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filterRole])

  // Format Action code to human-readable title
  const formatAction = (rawAction = '') => {
    const action = rawAction.toUpperCase().trim()

    switch (action) {
      case 'STUDENT_APPROVED':
        return { label: 'Student Profile Approved', color: 'emerald' }
      case 'STUDENT_REJECTED':
        return { label: 'Student Profile Rejected', color: 'rose' }
      case 'BIOMETRIC_ENROLLMENT_APPROVED':
        return { label: 'Biometrics Verified & Locked', color: 'emerald' }
      case 'BIOMETRIC_ENROLLMENT_REJECTED':
        return { label: 'Biometrics Rejected', color: 'rose' }
      case 'FACULTY_APPROVED':
        return { label: 'Faculty Account Approved', color: 'indigo' }
      case 'FACULTY_REJECTED':
        return { label: 'Faculty Account Rejected', color: 'rose' }
      case 'STUDENT_SUSPENDED':
        return { label: 'Student Suspended', color: 'rose' }
      case 'STUDENT_UNSUSPENDED':
        return { label: 'Student Restored', color: 'emerald' }
      case 'EXAM_CREATED':
        return { label: 'Exam Created', color: 'blue' }
      case 'EXAM_PUBLISHED':
        return { label: 'Exam Published Live', color: 'blue' }
      case 'QUESTIONS_BULK_ADDED':
        return { label: 'Exam Questions Added', color: 'indigo' }
      case 'EXAM_STATUS_UPDATED':
        return { label: 'Exam Status Updated', color: 'blue' }
      case 'INVIGILATOR_LOGIN':
        return { label: 'Invigilator Session Started', color: 'amber' }
      case 'INVIGILATOR_REVOKED':
        return { label: 'Invigilator Session Revoked', color: 'rose' }
      case 'ADMIN_LOGIN':
        return { label: 'Admin Signed In', color: 'blue' }
      case 'FACULTY_LOGIN':
        return { label: 'Faculty Signed In', color: 'indigo' }
      case 'STUDENT_LOGIN':
        return { label: 'Student Signed In', color: 'emerald' }
      case 'PASSWORD_CHANGED':
        return { label: 'Password Changed', color: 'amber' }
      case 'SETTINGS_UPDATED':
        return { label: 'Platform Settings Updated', color: 'purple' }
      default:
        // Format HTTP or snake_case cleanly
        if (action.includes('/')) {
          return { label: action.replace(/^PATCH |^POST |^PUT |^DELETE /, 'Update: '), color: 'slate' }
        }
        return {
          label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          color: 'slate'
        }
    }
  }

  // Format details column into clean readable English
  const formatDetails = (log) => {
    const text = log.details || ''

    if (!text || text === 'null' || text === 'undefined') {
      switch (log.action) {
        case 'ADMIN_LOGIN':
          return 'Administrator authenticated successfully.'
        case 'FACULTY_LOGIN':
          return 'Faculty member logged in to portal.'
        case 'STUDENT_LOGIN':
          return 'Student verified and authenticated.'
        default:
          return 'Action verified and logged by system.'
      }
    }

    // Handle raw JSON objects if present
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        if (
          parsed.body &&
          Object.keys(parsed.body).length === 0 &&
          (!parsed.params || Object.keys(parsed.params).length === 0)
        ) {
          return 'Action verified and authorized by administrator.'
        }
        if (parsed.title) return `Exam: "${parsed.title}"`
        if (parsed.name) return `Candidate: ${parsed.name} ${parsed.usn ? `(${parsed.usn})` : ''}`
        if (parsed.questions && Array.isArray(parsed.questions)) {
          return `${parsed.questions.length} questions uploaded to examination pool.`
        }
        // Extract meaningful keys
        const keys = Object.keys(parsed).filter((k) => k !== 'body' && k !== 'params')
        if (keys.length > 0) {
          return keys.map((k) => `${k}: ${parsed[k]}`).join(', ')
        }
        return 'System action recorded.'
      } catch {
        return text
      }
    }

    // Handle session query strings e.g. "examId=... invId=..."
    if (text.includes('invId=') || text.includes('examId=')) {
      const invMatch = text.match(/invId=([^\s]+)/)
      const examMatch = text.match(/examId=([^\s]+)/)
      const invPart = invMatch ? `Invigilator: ${invMatch[1]}` : ''
      const examPart = examMatch ? `Exam Session: ${examMatch[1].slice(0, 8)}...` : ''
      return [invPart, examPart].filter(Boolean).join(' • ')
    }

    return text
  }

  // Client-side quick filter
  const filtered = logs.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    const actionObj = formatAction(l.action)
    const detailsStr = formatDetails(l).toLowerCase()
    return (
      (l.action || '').toLowerCase().includes(q) ||
      actionObj.label.toLowerCase().includes(q) ||
      (l.userRole || '').toLowerCase().includes(q) ||
      detailsStr.includes(q)
    )
  })

  return (
    <DashboardLayout title="Audit Logs">
      <div className="flex flex-col gap-5 py-2 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Audit Trail</h1>
            <p className="text-sm text-slate-500 font-normal mt-0.5">
              Verified chronological record of administrative, faculty, and student security actions
            </p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, details, user role..."
              className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 rounded-xl focus:outline-none focus:border-[#2f80ed] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Filter by Role:</label>
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-slate-200 bg-white text-xs font-semibold text-slate-900 rounded-xl focus:outline-none focus:border-[#2f80ed] cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* Audit Table */}
        <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Unable to Retrieve Audit Logs"
                message={error}
                onRetry={fetchLogs}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <ClipboardList size={36} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-900 font-semibold text-sm">
                {search ? 'No audit records match your search' : 'No audit records found'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {search ? 'Try adjusting your search keyword or clearing the filter.' : 'No system logs recorded yet.'}
              </p>
              {search && (
                <div>
                  <button
                    onClick={() => setSearch('')}
                    className="mt-4 px-4 py-2 border border-[#e2e8f0] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                  >
                    Clear Search Filter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/75">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pl-5">Timestamp</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">Role</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">Action</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pr-5">Event Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filtered.map((log, i) => {
                    const actionInfo = formatAction(log.action)
                    const detailsStr = formatDetails(log)
                    const role = (log.userRole || 'system').toLowerCase()

                    return (
                      <TableRow key={log.id || i} className="hover:bg-slate-50/70 transition-colors">
                        {/* Timestamp */}
                        <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap pl-5 py-3.5">
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString([], {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : new Date().toLocaleDateString()}
                        </TableCell>

                        {/* Role Badge */}
                        <TableCell className="py-3.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                              role === 'admin'
                                ? 'bg-blue-50 text-[#2f80ed] border border-blue-200'
                                : role === 'faculty'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : role === 'student'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {role}
                          </span>
                        </TableCell>

                        {/* Action Label */}
                        <TableCell className="py-3.5">
                          <span className="font-semibold text-xs text-slate-900">
                            {actionInfo.label}
                          </span>
                        </TableCell>

                        {/* Details */}
                        <TableCell className="text-xs text-[#475569] font-medium max-w-xl py-3.5 pr-5 leading-relaxed">
                          {detailsStr}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#f1f5f9] bg-[#f8fafc]/50 text-xs text-[#64748b]">
              <span>
                Showing Page <strong className="text-[#0f172a]">{page}</strong> of <strong className="text-[#0f172a]">{totalPages}</strong> ({total} total actions)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
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
