import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  BookOpen,
  Search,
  RefreshCw,
  Activity,
  Calendar,
  CheckCircle2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  X,
  Lock
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function ExamStatusBadge({ status }) {
  if (status === 'ACTIVE' || status === 'IN_PROGRESS') {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0] font-mono text-[10px] font-bold flex items-center gap-1.5 w-fit">
        <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
        ACTIVE NOW
      </span>
    )
  }
  if (status === 'SCHEDULED' || status === 'PUBLISHED') {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] font-mono text-[10px] font-bold">
        SCHEDULED
      </span>
    )
  }
  if (status === 'ENDED' || status === 'COMPLETED') {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] font-mono text-[10px] font-bold">
        ENDED
      </span>
    )
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full bg-[#fffbeb] text-[#d97706] border border-[#fde68a] font-mono text-[10px] font-bold">
      {status}
    </span>
  )
}

export default function AdminExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Credentials Modal State
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
  const [selectedCredentials, setSelectedCredentials] = useState(null)
  const [credLoading, setCredLoading] = useState(false)
  const [credResetting, setCredResetting] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/exams')
      setExams(res.data.exams || res.data || [])
    } catch {
      console.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // Open credentials modal and fetch credentials
  const handleViewCredentials = async (exam) => {
    setCredentialsModalOpen(true)
    setCredLoading(true)
    setShowPassword(false)
    setCopiedField(null)
    try {
      const res = await api.get(`/admin/exams/${exam.id}/invigilator-credentials`)
      setSelectedCredentials(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch invigilator credentials.')
      setCredentialsModalOpen(false)
    } finally {
      setCredLoading(false)
    }
  }

  // Regenerate / reset invigilator password
  const handleResetCredentials = async () => {
    if (!selectedCredentials?.examId) return
    setCredResetting(true)
    try {
      const res = await api.post(`/admin/exams/${selectedCredentials.examId}/invigilator-credentials/reset`)
      setSelectedCredentials(res.data)
      toast.success('Invigilator access password regenerated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to regenerate credentials.')
    } finally {
      setCredResetting(false)
    }
  }

  // Copy individual field
  const copyToClipboard = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Copy complete formatted credentials package
  const copyAllCredentials = () => {
    if (!selectedCredentials) return
    const portalUrl = `${window.location.origin}/invigilator/login`
    const packageText = [
      `PROCTORNET INVIGILATOR ACCESS CREDENTIALS`,
      `══════════════════════════════════════════`,
      `Exam Title:      ${selectedCredentials.title} (${selectedCredentials.subject})`,
      `Faculty:         ${selectedCredentials.facultyName}`,
      `Exam ID:         ${selectedCredentials.examId}`,
      `Invigilator ID:  ${selectedCredentials.invId}`,
      `Access Password: ${selectedCredentials.password}`,
      `Login Portal:    ${portalUrl}`,
      `══════════════════════════════════════════`,
      `Instructions:`,
      `1. Open the Login Portal link above.`,
      `2. Paste the Exam ID, Invigilator ID, and Access Password.`,
      `3. Complete camera live preview to monitor the candidate grid.`
    ].join('\n')

    navigator.clipboard.writeText(packageText)
    setCopiedField('all')
    toast.success('Full invigilator credentials copied to clipboard!')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const filtered = exams.filter((e) => {
    const matchSearch =
      (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.faculty?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.subject || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || e.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    active: exams.filter((e) => e.status === 'ACTIVE' || e.status === 'IN_PROGRESS').length,
    scheduled: exams.filter((e) => e.status === 'SCHEDULED' || e.status === 'PUBLISHED').length,
    ended: exams.filter((e) => e.status === 'ENDED' || e.status === 'COMPLETED').length,
  }

  return (
    <DashboardLayout title="Exams Overview">
      <div className="flex flex-col gap-5 py-2 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0f172a]">All Platform Exams</h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Platform-wide exam scheduling, proctoring status, and invigilator access management
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] text-[#0f172a] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b]">Active Now</span>
              <div className="w-8 h-8 rounded-xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center border border-[#d1fae5]">
                <Activity size={16} />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono text-[#10b981] mt-2">{stats.active}</p>
          </Card>

          <Card className="bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b]">Scheduled / Published</span>
              <div className="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center border border-[#dbeafe]">
                <Calendar size={16} />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono text-[#2563eb] mt-2">{stats.scheduled}</p>
          </Card>

          <Card className="bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b]">Completed Sessions</span>
              <div className="w-8 h-8 rounded-xl bg-[#f8fafc] text-[#64748b] flex items-center justify-center border border-[#e2e8f0]">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono text-[#0f172a] mt-2">{stats.ended}</p>
          </Card>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam title, subject, faculty..."
              className="w-full pl-9 pr-3.5 py-2 border border-[#e2e8f0] bg-white text-xs text-[#0f172a] placeholder-[#94a3b8] rounded-xl focus:outline-none focus:border-[#2563eb] transition-colors"
            />
          </div>

          <div className="flex bg-white border border-[#e2e8f0] rounded-xl p-1 w-full sm:w-auto overflow-x-auto shadow-xs">
            {['', 'ACTIVE', 'SCHEDULED', 'PUBLISHED', 'ENDED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === s
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {s || 'All Exams'}
              </button>
            ))}
          </div>
        </div>

        {/* Exams Table */}
        <Card className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <BookOpen size={36} className="text-[#94a3b8] mx-auto mb-2" />
              <p className="text-[#0f172a] font-bold text-sm">No exams found</p>
              <p className="text-xs text-[#64748b] mt-1">No exam sessions match your filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#f1f5f9] bg-[#f8fafc]/70">
                    <TableHead className="text-xs font-bold text-[#64748b] pl-5 py-3.5">Exam Title</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] py-3.5">Subject</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] py-3.5">Faculty</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] py-3.5">Duration</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] py-3.5">Status</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] py-3.5">Scheduled Date</TableHead>
                    <TableHead className="text-xs font-bold text-[#64748b] text-right pr-5 py-3.5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#f1f5f9]">
                  {filtered.map((e) => (
                    <TableRow key={e.id} className="hover:bg-[#f8fafc] transition-colors">
                      <TableCell className="font-bold text-xs text-[#0f172a] pl-5 py-3.5">
                        {e.title}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                          {e.subject}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-[#475569] font-medium py-3.5">
                        {e.faculty?.name || 'Faculty'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#64748b] py-3.5">
                        {e.duration} mins
                      </TableCell>
                      <TableCell className="py-3.5">
                        <ExamStatusBadge status={e.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#64748b] py-3.5">
                        {new Date(e.startTime).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right pr-5 py-3.5">
                        <button
                          onClick={() => handleViewCredentials(e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-[#eff6ff] border border-[#e2e8f0] hover:border-[#2563eb] text-[#2563eb] shadow-2xs transition-all cursor-pointer"
                          title="Get Invigilator Login Credentials"
                        >
                          <Key size={13} />
                          <span>Invigilator Key</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Invigilator Credentials Modal */}
        {credentialsModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCredentialsModalOpen(false)}
          >
            <div
              className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl max-w-lg w-full p-6 text-[#0f172a] font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Invigilator Access Credentials</h3>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      Authentication keys for live proctoring supervision
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCredentialsModalOpen(false)}
                  className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {credLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw size={24} className="animate-spin text-[#2563eb] mx-auto mb-3" />
                  <p className="text-xs font-bold text-[#0f172a]">Fetching secure credentials...</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">Preparing one-time authentication keys.</p>
                </div>
              ) : selectedCredentials ? (
                <div className="space-y-4">
                  {/* Exam Info Banner */}
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">{selectedCredentials.title}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        Subject: <span className="font-semibold text-[#0f172a]">{selectedCredentials.subject}</span> • Faculty: {selectedCredentials.facultyName}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]">
                      {selectedCredentials.status}
                    </span>
                  </div>

                  {/* 3 Credential Fields */}
                  <div className="space-y-2.5">
                    {/* 1. Exam ID */}
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex items-center justify-between hover:border-[#cbd5e1] transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-[10px] uppercase font-bold text-[#64748b] block">
                          1. Exam Session ID
                        </span>
                        <p className="text-xs font-mono font-bold text-[#0f172a] truncate mt-0.5">
                          {selectedCredentials.examId}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedCredentials.examId, 'Exam ID')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#f8fafc] hover:bg-[#eff6ff] border border-[#e2e8f0] text-[#2563eb] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      >
                        {copiedField === 'Exam ID' ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} />}
                        <span>{copiedField === 'Exam ID' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* 2. Invigilator ID */}
                    <div className="bg-[#eff6ff]/40 border border-[#dbeafe] rounded-xl p-3 flex items-center justify-between hover:border-[#93c5fd] transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-[10px] uppercase font-bold text-[#2563eb] block">
                          2. Invigilator ID (invId)
                        </span>
                        <p className="text-sm font-mono font-bold text-[#1d4ed8] truncate mt-0.5">
                          {selectedCredentials.invId}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedCredentials.invId, 'Invigilator ID')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-[#eff6ff] border border-[#dbeafe] text-[#2563eb] flex items-center gap-1 cursor-pointer shrink-0 transition-colors shadow-2xs"
                      >
                        {copiedField === 'Invigilator ID' ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} />}
                        <span>{copiedField === 'Invigilator ID' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* 3. Session Access Password */}
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex items-center justify-between hover:border-[#cbd5e1] transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-[10px] uppercase font-bold text-[#64748b] block">
                          3. Access Password
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm font-mono font-bold text-[#0f172a] tracking-wider">
                            {showPassword ? selectedCredentials.password : '••••••••'}
                          </p>
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[#94a3b8] hover:text-[#0f172a] cursor-pointer"
                            title={showPassword ? 'Hide Password' : 'Show Password'}
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedCredentials.password, 'Password')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#f8fafc] hover:bg-[#eff6ff] border border-[#e2e8f0] text-[#2563eb] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      >
                        {copiedField === 'Password' ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} />}
                        <span>{copiedField === 'Password' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Action Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                    <button
                      onClick={copyAllCredentials}
                      className="w-full sm:flex-1 py-2 px-3.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {copiedField === 'all' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedField === 'all' ? 'All Credentials Copied!' : 'Copy Full Credentials Package'}</span>
                    </button>

                    <a
                      href="/invigilator/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto py-2 px-3 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink size={13} className="text-[#64748b]" />
                      <span>Open Portal</span>
                    </a>

                    <button
                      onClick={handleResetCredentials}
                      disabled={credResetting}
                      className="w-full sm:w-auto py-2 px-3 bg-white hover:bg-[#fff1f2] border border-[#e2e8f0] hover:border-[#fee2e2] text-[#e11d48] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Generate a fresh password"
                    >
                      <RefreshCw size={13} className={credResetting ? 'animate-spin' : ''} />
                      <span>Reset Password</span>
                    </button>
                  </div>

                  {/* Security Note */}
                  <p className="text-[11px] text-[#94a3b8] leading-tight text-center pt-2 border-t border-[#f1f5f9]">
                    Provide these credentials to the proctor/invigilator assigned to this session. They grant access to live candidate webcams and incident logs.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
