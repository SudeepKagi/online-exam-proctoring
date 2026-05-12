import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, CheckCircle, XCircle, UserMinus, UserCheck,
  Eye, X, ChevronDown, Users, Clock, AlertTriangle
} from 'lucide-react'

function StatusBadge({ isApproved, isSuspended }) {
  if (isSuspended) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Suspended</span>
  if (!isApproved) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
}

function IDCardModal({ faculty, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">Faculty ID Card — {faculty.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="bg-gray-100 rounded-xl overflow-hidden mb-4">
          {faculty.idCardPhotoUrl && faculty.idCardPhotoUrl !== 'placeholder_id' ? (
            <img src={faculty.idCardPhotoUrl} alt="ID Card" className="w-full object-contain max-h-60" />
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No ID card uploaded</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Employee ID</p>
            <p className="font-semibold text-gray-800">{faculty.employeeId}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Department</p>
            <p className="font-semibold text-gray-800">{faculty.department}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Email</p>
            <p className="font-semibold text-gray-800 text-xs truncate">{faculty.email}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Submitted</p>
            <p className="font-semibold text-gray-800 text-xs">{new Date(faculty.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {showReject && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={3} />
          </div>
        )}

        <div className="flex gap-3">
          {!showReject ? (
            <>
              <button onClick={() => onApprove(faculty.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => setShowReject(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                <XCircle size={15} /> Reject
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setShowReject(false); setRejectReason('') }}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => onReject(faculty.id, rejectReason)}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
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

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [allRes, pendingRes] = await Promise.all([
        api.get('/admin/faculty'),
        api.get('/admin/faculty/pending'),
      ])
      setAllFaculty(allRes.data.faculty || allRes.data || [])
      setPending(pendingRes.data.faculty || pendingRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load faculty data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/approve`)
      toast.success('Faculty approved successfully')
      setSelectedFaculty(null)
      fetchAll()
    } catch { toast.error('Failed to approve faculty') }
  }

  const handleReject = async (id, reason) => {
    try {
      await api.patch(`/admin/faculty/${id}/reject`, { reason })
      toast.success('Faculty rejected')
      setSelectedFaculty(null)
      fetchAll()
    } catch { toast.error('Failed to reject faculty') }
  }

  const handleSuspend = async (id) => {
    if (!confirm('Suspend this faculty member?')) return
    try {
      await api.patch(`/admin/faculty/${id}/suspend`)
      toast.success('Faculty suspended')
      fetchAll()
    } catch { toast.error('Failed to suspend faculty') }
  }

  const handleUnsuspend = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/unsuspend`)
      toast.success('Faculty reactivated')
      fetchAll()
    } catch { toast.error('Failed to reactivate faculty') }
  }

  const DEPTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
  const list = tab === 'pending' ? pending : allFaculty
  const filtered = list.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Faculty Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review applications and manage faculty accounts</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Clock size={14} /> Pending Approval
          {pending.length > 0 && <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('all')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={14} /> All Faculty
          <span className="text-xs text-gray-400">({allFaculty.length})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, ID…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Departments</option>
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Pending cards */}
      {tab === 'pending' && !loading && (
        filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No pending approvals</p>
            <p className="text-sm text-gray-400 mt-1">All faculty applications have been processed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                    {f.profilePhotoUrl && f.profilePhotoUrl !== 'placeholder_face'
                      ? <img src={f.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                      : f.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{f.name}</p>
                    <p className="text-xs text-gray-500 truncate">{f.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{f.department}</span>
                      <span className="text-xs text-gray-400">{f.employeeId}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-400">Submitted</p>
                    <p className="font-medium text-gray-700">{new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-400">Designation</p>
                    <p className="font-medium text-gray-700 truncate">{f.designation || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedFaculty(f)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    <Eye size={13} /> View ID
                  </button>
                  <button onClick={() => handleApprove(f.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-colors">
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button onClick={() => handleReject(f.id, 'Rejected by admin')}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                    <XCircle size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* All faculty table */}
      {tab === 'all' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3.5 text-left font-semibold">Faculty</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Employee ID</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">No faculty found</td></tr>
                  ) : filtered.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-semibold overflow-hidden flex-shrink-0">
                            {f.profilePhotoUrl && f.profilePhotoUrl !== 'placeholder_face'
                              ? <img src={f.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                              : f.name?.slice(0, 2).toUpperCase()
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{f.name}</p>
                            <p className="text-xs text-gray-400">{f.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{f.employeeId}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{f.department}</span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge isApproved={f.isApproved} isSuspended={f.isSuspended} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedFaculty(f)}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                            <Eye size={12} /> ID Card
                          </button>
                          {!f.isApproved ? (
                            <button onClick={() => handleApprove(f.id)}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
                              <CheckCircle size={12} /> Approve
                            </button>
                          ) : f.isSuspended ? (
                            <button onClick={() => handleUnsuspend(f.id)}
                              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                              <UserCheck size={12} /> Reactivate
                            </button>
                          ) : (
                            <button onClick={() => handleSuspend(f.id)}
                              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
                              <UserMinus size={12} /> Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
