import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, CheckCircle, XCircle, UserMinus, UserCheck,
  Eye, X, Users, Clock, AlertTriangle, ShieldCheck
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'

function StatusBadge({ isApproved, isSuspended }) {
  if (isSuspended) return <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono text-[10px]">Suspended</Badge>
  if (!isApproved) return <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">Pending</Badge>
  return <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px]">Active</Badge>
}

function IDCardModal({ faculty, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 text-foreground font-sans" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 border-b border-border pb-3">
          <h3 className="text-base font-bold text-foreground">Faculty ID Card — {faculty.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-neutral-900 rounded-xl overflow-hidden aspect-[16/10] border border-border flex items-center justify-center">
            {faculty.idCardPhotoUrl ? (
              <img src={faculty.idCardPhotoUrl} alt="ID Card" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground">
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">No ID Card uploaded</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Name:</span> <strong className="text-foreground">{faculty.name}</strong></div>
            <div><span className="text-muted-foreground">Emp ID:</span> <strong className="text-foreground font-mono">{faculty.employeeId}</strong></div>
            <div><span className="text-muted-foreground">Dept:</span> <strong className="text-foreground">{faculty.department}</strong></div>
            <div><span className="text-muted-foreground">Email:</span> <strong className="text-foreground font-mono text-[11px]">{faculty.email}</strong></div>
          </div>

          {showReject && (
            <div className="pt-2">
              <label className="text-xs text-muted-foreground block mb-1">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this registration is being rejected..."
                className="w-full h-20 p-2.5 text-xs bg-background border border-border rounded-xl resize-none text-foreground outline-none focus:border-rose-500"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          {!showReject ? (
            <>
              <button
                onClick={() => onApprove(faculty.id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle size={15} /> Approve Account
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                className="flex-1 border border-border bg-background py-2.5 rounded-xl text-xs text-foreground/90 hover:bg-[#f8fafc] dark:bg-neutral-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onReject(faculty.id, rejectReason)}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
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

export default function AdminFaculty() {
  const [allFaculty, setAllFaculty] = useState([])
  const [pending, setPending] = useState([])
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState(null)
  const [confirmAction, setConfirmAction] = useState({ open: false, faculty: null, type: null, loading: false })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [allRes, pendingRes] = await Promise.all([
        api.get('/admin/faculty'),
        api.get('/admin/faculty/pending'),
      ])
      setAllFaculty(allRes.data.faculty || [])
      setPending(pendingRes.data.pending || [])
    } catch {
      toast.error('Failed to load faculty data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/approve`)
      toast.success('Faculty approved successfully')
      setSelectedFaculty(null)
      fetchAll()
    } catch {
      toast.error('Failed to approve faculty')
    }
  }

  const handleReject = async (id, reason) => {
    try {
      await api.patch(`/admin/faculty/${id}/reject`, { reason })
      toast.success('Faculty registration rejected')
      setSelectedFaculty(null)
      fetchAll()
    } catch {
      toast.error('Failed to reject faculty')
    }
  }

  const handleRequestSuspend = (faculty) => {
    setConfirmAction({
      open: true,
      faculty,
      type: 'suspend',
      loading: false
    })
  }

  const handleRequestUnsuspend = (faculty) => {
    setConfirmAction({
      open: true,
      faculty,
      type: 'unsuspend',
      loading: false
    })
  }

  const handleExecuteAction = async () => {
    const { faculty, type } = confirmAction
    if (!faculty) return
    setConfirmAction(prev => ({ ...prev, loading: true }))
    try {
      if (type === 'suspend') {
        await api.patch(`/admin/faculty/${faculty.id}/suspend`)
        toast.success(`Faculty ${faculty.name} suspended`)
      } else {
        await api.patch(`/admin/faculty/${faculty.id}/unsuspend`)
        toast.success(`Faculty ${faculty.name} reactivated`)
      }
      fetchAll()
    } catch {
      toast.error(`Failed to ${type} faculty`)
    } finally {
      setConfirmAction({ open: false, faculty: null, type: null, loading: false })
    }
  }

  const DEPTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
  const list = tab === 'pending' ? pending : allFaculty
  const filtered = list.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase())
    const matchDept = !filterDept || f.department === filterDept
    return matchSearch && matchDept
  })

  return (
    <DashboardLayout title="Faculty Management">
      {selectedFaculty && (
        <IDCardModal
          faculty={selectedFaculty}
          onClose={() => setSelectedFaculty(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Faculty Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Review faculty applications and manage system permissions</p>
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
          <div className="flex bg-card border border-border rounded-full p-1">
            <button
              onClick={() => setTab('pending')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold rounded-full transition-colors ${
                tab === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-muted-foreground hover:text-white'
              }`}
            >
              <Clock size={13} /> Pending Approval
              {pending.length > 0 && <span className="bg-amber-500 text-black font-bold text-[10px] px-1.5 rounded-full">{pending.length}</span>}
            </button>

            <button
              onClick={() => setTab('all')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold rounded-full transition-colors ${
                tab === 'all' ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'
              }`}
            >
              <Users size={13} /> All Faculty ({allFaculty.length})
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, ID..."
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
              {search || filterDept ? (
                <div>
                  <Users size={36} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-foreground font-semibold text-sm">No pending faculty match your filter</p>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms or department selection.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSearch(''); setFilterDept('') }}
                    className="mt-4 text-xs"
                  >
                    Clear Search & Filters
                  </Button>
                </div>
              ) : (
                <div>
                  <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
                  <p className="text-foreground font-semibold text-sm">No pending approvals</p>
                  <p className="text-xs text-slate-500 mt-1">All faculty applications have been processed.</p>
                </div>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((f) => (
                <Card key={f.id} className="bg-card border-border shadow-xl hover:border-border transition p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden font-mono">
                        {f.profilePhotoUrl && f.profilePhotoUrl !== 'placeholder_face' ? (
                          <img src={f.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          f.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{f.name}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{f.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px]">
                            {f.department}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-500">{f.employeeId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background border border-border text-xs text-muted-foreground mb-4">
                      <span className="text-[10px] font-mono uppercase text-slate-500">Submitted Date: </span>
                      <span className="text-foreground font-mono">{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => setSelectedFaculty(f)}
                      className="w-full text-xs font-mono bg-primary hover:bg-primary text-white cursor-pointer"
                    >
                      <Eye size={13} className="mr-1.5" /> Review Application
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* All Faculty Table View */}
        {tab === 'all' && !loading && (
          filtered.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center shadow-xl">
              <Users size={36} className="text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-foreground font-semibold text-sm">No faculty records match your criteria</p>
              <p className="text-xs text-slate-500 mt-1">
                {search || filterDept ? 'Try clearing your search keyword or department filter.' : 'No faculty records exist yet in the database.'}
              </p>
              {(search || filterDept) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSearch(''); setFilterDept('') }}
                  className="mt-4 text-xs cursor-pointer"
                >
                  Clear Search & Filters
                </Button>
              )}
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-background">
                    <TableHead className="text-xs text-muted-foreground font-mono">Faculty Name</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Employee ID</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Department</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                      <TableCell className="font-semibold text-xs text-foreground">{f.name}</TableCell>
                      <TableCell className="font-mono text-xs text-foreground/90">{f.employeeId}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs text-foreground/90 border-border bg-background">{f.department}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{f.email}</TableCell>
                      <TableCell><StatusBadge isApproved={f.isApproved} isSuspended={f.isSuspended} /></TableCell>
                      <TableCell className="text-right">
                        {f.isSuspended ? (
                          <Button size="sm" variant="ghost" onClick={() => handleRequestUnsuspend(f)} className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10 cursor-pointer">
                            <UserCheck size={13} className="mr-1" /> Reactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleRequestSuspend(f)} className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                            <UserMinus size={13} className="mr-1" /> Suspend
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        )}

        {/* Confirmation Dialog for Destructive Suspend/Reactivate Actions */}
        <ConfirmDialog
          isOpen={confirmAction.open}
          title={confirmAction.type === 'suspend' ? `Suspend Faculty Account: ${confirmAction.faculty?.name}?` : `Reactivate Faculty Account: ${confirmAction.faculty?.name}?`}
          description={confirmAction.type === 'suspend'
            ? `Suspending this faculty account (${confirmAction.faculty?.employeeId}) will immediately revoke their access to create, publish, and evaluate examinations.`
            : `Reactivating this account will restore full faculty examination management privileges.`}
          confirmText={confirmAction.type === 'suspend' ? 'Yes, Suspend Account' : 'Yes, Reactivate Account'}
          cancelText="Cancel"
          variant={confirmAction.type === 'suspend' ? 'destructive' : 'primary'}
          loading={confirmAction.loading}
          onConfirm={handleExecuteAction}
          onClose={() => setConfirmAction({ open: false, faculty: null, type: null, loading: false })}
        />
      </div>
    </DashboardLayout>
  )
}
