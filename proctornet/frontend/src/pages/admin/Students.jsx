import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Search, RefreshCw, CheckCircle, XCircle, UserMinus, UserCheck, Eye, X, Users, Clock } from 'lucide-react'

function StatusBadge({ status, isSuspended }) {
  if (isSuspended) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Suspended</span>
  if (status === 'APPROVED') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
  if (status === 'REJECTED') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejected</span>
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
}

function IDCardModal({ student, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">Student ID — {student.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
        </div>

        <div className="bg-gray-100 rounded-xl overflow-hidden mb-4">
          {student.idCardPhotoUrl && student.idCardPhotoUrl !== 'placeholder_id' ? (
            <img src={student.idCardPhotoUrl} alt="ID" className="w-full object-contain max-h-60" />
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No ID card uploaded</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          {[['USN', student.usn], ['Department', student.department], ['Semester', `Semester ${student.semester}`], ['Submitted', new Date(student.createdAt).toLocaleDateString()]].map(([label, val]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-semibold text-gray-800">{val}</p>
            </div>
          ))}
        </div>

        {student.faceMatchScore !== undefined && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${student.faceMatchScore >= 0.8 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            Face match score: <strong>{Math.round(student.faceMatchScore * 100)}%</strong>
            {student.faceMatchScore < 0.8 && ' — Manual review required'}
          </div>
        )}

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
              <button onClick={() => onApprove(student.id)}
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
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => onReject(student.id, rejectReason)} disabled={!rejectReason.trim()}
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
      setAllStudents(allRes.data.students || allRes.data || [])
      setPending(pendingRes.data.students || pendingRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load student data')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/approve`)
      toast.success('Student approved')
      setSelected(null); fetchAll()
    } catch { toast.error('Failed to approve student') }
  }

  const handleReject = async (id, reason) => {
    try {
      await api.patch(`/admin/students/${id}/reject`, { reason })
      toast.success('Student rejected')
      setSelected(null); fetchAll()
    } catch { toast.error('Failed to reject student') }
  }

  const handleSuspend = async (id) => {
    if (!confirm('Suspend this student?')) return
    try {
      await api.patch(`/admin/students/${id}/suspend`)
      toast.success('Student suspended'); fetchAll()
    } catch { toast.error('Failed to suspend student') }
  }

  const handleUnsuspend = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/unsuspend`)
      toast.success('Student reactivated'); fetchAll()
    } catch { toast.error('Failed to reactivate student') }
  }

  const DEPTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
  const list = tab === 'pending' ? pending : allStudents
  const filtered = list.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.usn.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    const matchDept = !filterDept || s.department === filterDept
    return matchSearch && matchDept
  })

  return (
    <DashboardLayout title="Student Management">
      {selected && (
        <IDCardModal student={selected} onClose={() => setSelected(null)} onApprove={handleApprove} onReject={handleReject} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Student Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review applications and manage student accounts</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Clock size={14} /> Pending Approval
          {pending.length > 0 && <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('all')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={14} /> All Students
          <span className="text-xs text-gray-400">({allStudents.length})</span>
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, USN, email…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Departments</option>
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {tab === 'pending' && !loading && (
        filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No pending approvals</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                    {s.facePhotoUrl && s.facePhotoUrl !== 'placeholder_face'
                      ? <img src={s.facePhotoUrl} alt="" className="w-full h-full object-cover" />
                      : s.name?.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{s.department}</span>
                      <span className="text-xs text-gray-400">{s.usn}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-gray-400">Semester</p><p className="font-medium text-gray-700">Sem {s.semester}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-gray-400">Match Score</p><p className={`font-medium ${s.faceMatchScore >= 0.8 ? 'text-green-600' : 'text-amber-600'}`}>{Math.round((s.faceMatchScore || 0) * 100)}%</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelected(s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Eye size={13} /> View ID
                  </button>
                  <button onClick={() => handleApprove(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold">
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button onClick={() => handleReject(s.id, 'Rejected by admin')}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl">
                    <XCircle size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'all' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    {['Student','USN','Dept/Sem','Status','Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">No students found</td></tr>
                  ) : filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center font-semibold overflow-hidden flex-shrink-0">
                            {s.facePhotoUrl && s.facePhotoUrl !== 'placeholder_face'
                              ? <img src={s.facePhotoUrl} alt="" className="w-full h-full object-cover" />
                              : s.name?.slice(0, 2).toUpperCase()
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{s.usn}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{s.department}</span>
                        <span className="text-xs text-gray-400 ml-1">Sem {s.semester}</span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={s.approvalStatus} isSuspended={s.isSuspended} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelected(s)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                            <Eye size={12} /> ID Card
                          </button>
                          {s.approvalStatus !== 'APPROVED' ? (
                            <button onClick={() => handleApprove(s.id)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
                              <CheckCircle size={12} /> Approve
                            </button>
                          ) : s.isSuspended ? (
                            <button onClick={() => handleUnsuspend(s.id)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                              <UserCheck size={12} /> Reactivate
                            </button>
                          ) : (
                            <button onClick={() => handleSuspend(s.id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
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
