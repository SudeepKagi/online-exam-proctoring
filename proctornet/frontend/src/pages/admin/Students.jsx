import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Search, RefreshCw, CheckCircle, XCircle, UserMinus, UserCheck, Eye, X, Users, Clock, GraduationCap } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function StatusBadge({ status, isSuspended }) {
  if (isSuspended) return <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono text-[10px]">Suspended</Badge>
  if (status === 'APPROVED') return <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px]">Active</Badge>
  if (status === 'REJECTED') return <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono text-[10px]">Rejected</Badge>
  return <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">Pending</Badge>
}

function IDCardModal({ student, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 text-foreground font-sans" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 border-b border-border pb-3">
          <h3 className="text-base font-bold text-foreground">Student ID — {student.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="bg-background border border-border rounded-xl overflow-hidden mb-4 flex items-center justify-center min-h-[160px]">
          {student.idCardPhotoUrl && student.idCardPhotoUrl !== 'placeholder_id' ? (
            <img src={student.idCardPhotoUrl} alt="ID" className="w-full object-contain max-h-60" />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-xs font-mono">No ID card photo uploaded</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
          {[
            ['USN', student.usn],
            ['Department', student.department],
            ['Semester', `Semester ${student.semester}`],
            ['Submitted', new Date(student.createdAt).toLocaleDateString()],
          ].map(([label, val]) => (
            <div key={label} className="bg-background border border-border rounded-xl p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase">{label}</p>
              <p className="font-semibold text-foreground mt-0.5 font-mono">{val}</p>
            </div>
          ))}
        </div>

        {student.faceMatchScore !== undefined && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-mono ${student.faceMatchScore >= 0.8 ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'}`}>
            Face Match Score: <strong>{Math.round(student.faceMatchScore * 100)}%</strong>
            {student.faceMatchScore < 0.8 && ' — Manual review recommended'}
          </div>
        )}

        {showReject && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-foreground/90 mb-1.5">Rejection Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-xs bg-background text-foreground focus:outline-none focus:border-rose-500 resize-none"
              rows={3}
            />
          </div>
        )}

        <div className="flex gap-3">
          {!showReject ? (
            <>
              <button
                onClick={() => onApprove(student.id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle size={15} /> Approve Account
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <XCircle size={15} /> Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowReject(false)
                  setRejectReason('')
                }}
                className="flex-1 border border-border bg-background py-2.5 rounded-xl text-xs text-foreground/90 hover:bg-[#f8fafc] dark:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={() => onReject(student.id, rejectReason)}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminStudents() {
  const [allStudents, setAllStudents] = useState([])
  const [pending, setPending] = useState([])
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [selected, setSelected] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [allRes, pendingRes] = await Promise.all([
        api.get('/admin/students'),
        api.get('/admin/students/pending'),
      ])
      setAllStudents(allRes.data.students || [])
      setPending(pendingRes.data.pending || pendingRes.data.students || [])
    } catch {
      toast.error('Failed to load student records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/approve`)
      toast.success('Student approved')
      setSelected(null)
      fetchAll()
    } catch {
      toast.error('Failed to approve student')
    }
  }

  const handleReject = async (id, reason) => {
    try {
      await api.patch(`/admin/students/${id}/reject`, { reason })
      toast.success('Student registration rejected')
      setSelected(null)
      fetchAll()
    } catch {
      toast.error('Failed to reject student')
    }
  }

  const handleSuspend = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/suspend`)
      toast.success('Student account suspended')
      fetchAll()
    } catch {
      toast.error('Failed to suspend student')
    }
  }

  const handleUnsuspend = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/unsuspend`)
      toast.success('Student account reactivated')
      fetchAll()
    } catch {
      toast.error('Failed to reactivate student')
    }
  }

  const DEPTS = ['CSE', 'ECE', 'ME', 'CIVIL', 'ISE', 'EEE']
  const list = tab === 'pending' ? pending : allStudents
  const filtered = list.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.usn.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    const matchDept = !filterDept || s.department === filterDept
    return matchSearch && matchDept
  })

  return (
    <DashboardLayout title="Student Management">
      {selected && (
        <IDCardModal
          student={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Student Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Review student registrations and manage active candidate profiles</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border border-border bg-card hover:bg-[#f8fafc] dark:bg-neutral-900 text-foreground/90 rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tabs & Controls Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex bg-[#f1f5f9] border border-[#e2e8f0] rounded-full p-1">
            <button
              onClick={() => setTab('pending')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                tab === 'pending'
                  ? 'bg-[#fffbeb] text-[#b45309] border border-[#fef3c7] shadow-2xs font-bold'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <Clock size={13} /> Pending Approval
              {pending.length > 0 && <span className="bg-[#f59e0b] text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">{pending.length}</span>}
            </button>

            <button
              onClick={() => setTab('all')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                tab === 'all'
                  ? 'bg-white text-[#0f172a] shadow-2xs border border-[#e2e8f0] font-bold'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <GraduationCap size={13} /> All Students ({allStudents.length})
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, USN, email..."
                className="w-full pl-9 pr-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
              />
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-1.5 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
            >
              <option value="">All Departments</option>
              {DEPTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pending Approval View */}
        {tab === 'pending' && !loading && (
          filtered.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center shadow-xl">
              <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-foreground font-semibold text-sm">No pending approvals</p>
              <p className="text-xs text-slate-500 mt-1">All student account applications have been processed.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s) => (
                <Card key={s.id} className="bg-card border-border shadow-xl hover:border-border transition p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden font-mono">
                        {s.facePhotoUrl && s.facePhotoUrl !== 'placeholder_face' ? (
                          <img src={s.facePhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          s.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{s.name}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{s.usn}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px]">
                            {s.department}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-500">Sem {s.semester}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background border border-border text-xs text-muted-foreground mb-4">
                      <span className="text-[10px] font-mono uppercase text-slate-500">Submitted Date: </span>
                      <span className="text-foreground font-mono">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => setSelected(s)}
                      className="w-full text-xs font-mono bg-primary hover:bg-primary text-white"
                    >
                      <Eye size={13} className="mr-1.5" /> Review Application
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* All Students Table View */}
        {tab === 'all' && !loading && (
          <Card className="bg-card border-border shadow-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background">
                  <TableHead className="text-xs text-muted-foreground font-mono">Student Name</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-mono">USN</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Department</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Semester</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                    <TableCell className="font-semibold text-xs text-foreground">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground/90">{s.usn}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs text-foreground/90 border-border bg-background">{s.department}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">Semester {s.semester}</TableCell>
                    <TableCell><StatusBadge status={s.approvalStatus} isSuspended={s.isSuspended} /></TableCell>
                    <TableCell className="text-right">
                      {s.isSuspended ? (
                        <Button size="sm" variant="ghost" onClick={() => handleUnsuspend(s.id)} className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10">
                          <UserCheck size={13} className="mr-1" /> Reactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleSuspend(s.id)} className="h-7 text-xs text-rose-400 hover:bg-rose-500/10">
                          <UserMinus size={13} className="mr-1" /> Suspend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
