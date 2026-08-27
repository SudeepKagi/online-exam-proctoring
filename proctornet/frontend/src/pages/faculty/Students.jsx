import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Search, UserCheck, ChevronLeft, ChevronRight, User, X, CheckCircle2, ShieldCheck, Mail, Building, GraduationCap, Clock } from 'lucide-react'

export default function FacultyStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const pageSize = 8

  useEffect(() => {
    api.get('/faculty/students')
      .then(r => {
        const raw = r.data.students || r.data || []
        setStudents(raw)
      })
      .catch(() => {
        // Fallback demo data
        setStudents([
          { id: '1', name: 'Sudeep Shankaranand Kagi', usn: '1NT23EC158', email: 'sudeep.kagi@nmit.ac.in', department: 'Electronics & Communication', semester: 6, verified: true, approvalStatus: 'APPROVED' },
          { id: '2', name: 'Ananya Sharma', usn: '1NT23CS012', email: 'ananya.sharma@nmit.ac.in', department: 'Computer Science', semester: 6, verified: true, approvalStatus: 'APPROVED' },
          { id: '3', name: 'Rohan Verma', usn: '1NT23IS045', email: 'rohan.verma@nmit.ac.in', department: 'Information Science', semester: 4, verified: false, approvalStatus: 'PENDING' },
          { id: '4', name: 'Priya Nair', usn: '1NT23EC089', email: 'priya.nair@nmit.ac.in', department: 'Electronics & Communication', semester: 6, verified: true, approvalStatus: 'APPROVED' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.usn || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.department || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const verifiedCount = students.filter(s => s.verified || s.approvalStatus === 'APPROVED').length
  const pendingCount = students.length - verifiedCount

  return (
    <DashboardLayout title="Faculty Workspace">
      <div className="flex flex-col gap-6 font-sans">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Student Registry</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Enrolled candidates, USN records, and biometric verification statuses.</p>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Enrolled</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{students.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Registered candidates</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Biometric Verified
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{verifiedCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Approved face vectors</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Clock size={14} /> Verification Pending
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{pendingCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Awaiting enrollment review</p>
          </div>
        </div>

        {/* Search & Roster Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Enrolled Student Roster</h3>
              <p className="text-xs text-slate-500 mt-0.5">Showing {filtered.length} of {students.length} matched candidates</p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search name, USN, department, email..."
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
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Loading student registry…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">No students match your search criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Student Details</th>
                    <th className="px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">USN</th>
                    <th className="px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Department</th>
                    <th className="px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Face Verification</th>
                    <th className="px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((student) => {
                    const isVerified = student.verified || student.approvalStatus === 'APPROVED'
                    return (
                      <tr key={student.id || student._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 text-[#2f80ed] font-extrabold text-xs flex items-center justify-center shrink-0">
                              {student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ST'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-slate-900 truncate">{student.name}</p>
                              <p className="text-xs font-semibold text-slate-500 truncate">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-slate-900 text-xs tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
                            {student.usn}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">
                          {student.department || 'Electronics & Communication'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                            isVerified 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isVerified ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                            {isVerified ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2f80ed] rounded-lg text-xs font-extrabold transition-colors cursor-pointer"
                          >
                            View Profile
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs font-extrabold text-slate-500 bg-slate-50/50">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 font-bold"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <User size={18} className="text-[#2f80ed]" /> Student Profile
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 text-[#2f80ed] font-extrabold text-lg flex items-center justify-center shrink-0">
                  {selectedStudent.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ST'}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">{selectedStudent.name}</h3>
                  <span className="inline-block mt-0.5 px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-extrabold">
                    USN: {selectedStudent.usn}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-[#f8fafc] p-4 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" />
                  <span className="text-slate-500 font-semibold">Email:</span>
                  <span className="font-extrabold text-slate-900">{selectedStudent.email}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Building size={14} className="text-slate-400" />
                  <span className="text-slate-500 font-semibold">Department:</span>
                  <span className="font-extrabold text-slate-900">{selectedStudent.department || 'Electronics & Communication'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-slate-400" />
                  <span className="text-slate-500 font-semibold">Semester:</span>
                  <span className="font-extrabold text-slate-900">Semester {selectedStudent.semester || 6}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span className="text-slate-500 font-semibold">Biometrics Status:</span>
                  <span className={`font-extrabold ${selectedStudent.verified || selectedStudent.approvalStatus === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {selectedStudent.verified || selectedStudent.approvalStatus === 'APPROVED' ? '✓ VERIFIED & APPROVED' : 'PENDING REVIEW'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 bg-[#2f80ed] hover:bg-[#2563eb] text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
