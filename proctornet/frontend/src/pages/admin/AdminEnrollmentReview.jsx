import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Eye,
  Lock,
  Unlock,
  Sparkles,
  FileText,
  Camera,
  Shield,
} from 'lucide-react'

export default function AdminEnrollmentReview() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('SUBMITTED')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState('PENDING')
  const [overrideReason, setOverrideReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchSubmissions()
  }, [filterStatus])

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/enrollments?status=${filterStatus}`)
      setSubmissions(res.data?.records || [])
    } catch (err) {
      toast.error('Failed to load biometric submissions.')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (studentId) => {
    setActionLoading(true)
    try {
      await api.post(`/admin/enrollments/${studentId}/approve`)
      toast.success('Biometric profile approved and locked.')
      fetchSubmissions()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve enrollment.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectSubmit = async () => {
    if (!selectedStudent || !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection.')
      return
    }

    setActionLoading(true)
    try {
      await api.post(`/admin/enrollments/${selectedStudent.id}/reject`, { reason: rejectReason })
      toast.success('Biometric enrollment rejected.')
      setIsRejectModalOpen(false)
      setRejectReason('')
      setSelectedStudent(null)
      fetchSubmissions()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject enrollment.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleOverrideSubmit = async () => {
    if (!selectedStudent || !overrideReason.trim()) {
      toast.error('Please provide an administrative reason for override.')
      return
    }

    setActionLoading(true)
    try {
      await api.post('/admin/enrollments/override', {
        studentId: selectedStudent.id,
        newStatus: overrideStatus,
        reason: overrideReason,
      })
      toast.success(`Profile status overridden to ${overrideStatus}.`)
      setIsOverrideModalOpen(false)
      setOverrideReason('')
      setSelectedStudent(null)
      fetchSubmissions()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to override status.')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredList = submissions.filter((s) => {
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q) || s.department.toLowerCase().includes(q)
  })

  return (
    <DashboardLayout title="Biometric Enrollment Review">
      <div className="space-y-6">
        {/* Header & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Student Enrollment Verification Queue</h2>
              <p className="text-xs text-slate-400">Side-by-side live selfie, MTCNN ID photo crop, & PaddleOCR verification</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search USN or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filter Tabs */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="SUBMITTED">Pending Submissions</option>
              <option value="VERIFIED">Verified & Locked</option>
              <option value="REJECTED">Rejected Profiles</option>
              <option value="ALL">All Profiles</option>
            </select>

            <button
              onClick={fetchSubmissions}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Submissions Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading enrollment submissions...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No submissions found</p>
            <p className="text-xs text-slate-500 mt-1">No student biometrics match the selected filter query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredList.map((st) => {
              const ocr = st.idOcrFields || {}
              const conf = ocr.confidenceScore ? Math.round(ocr.confidenceScore * 100) : 80
              const isFlagged = ocr.isMatchFlagged

              return (
                <div
                  key={st.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    {/* Student Info Bar */}
                    <div className="flex items-start justify-between pb-3 border-b border-slate-800/80 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-100 text-sm">{st.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 font-mono font-semibold">
                            {st.usn}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {st.department} • Semester {st.semester}
                        </p>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                          st.profileStatus === 'VERIFIED' || st.profileStatus === 'LOCKED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : st.profileStatus === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {st.profileStatus === 'VERIFIED' && <Lock className="w-3 h-3" />}
                        {st.profileStatus}
                      </span>
                    </div>

                    {/* Photos Side-by-Side Comparison */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Live Selfie */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-indigo-400" /> Live Webcam Selfie
                        </span>
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                          {st.facePhotoUrl ? (
                            <img src={st.facePhotoUrl} alt="Live Selfie" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-600">No Photo</span>
                          )}
                        </div>
                      </div>

                      {/* Cropped ID Face Photo */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-400" /> MTCNN Cropped ID Photo
                        </span>
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                          {st.idCroppedFaceUrl || st.idDocumentUrl ? (
                            <img src={st.idCroppedFaceUrl || st.idDocumentUrl} alt="Cropped ID Face" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-600">No ID Photo</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PaddleOCR Data Section */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-1.5 mb-4">
                      <div className="flex items-center justify-between font-semibold text-slate-300 pb-1 border-b border-slate-800">
                        <span>PaddleOCR Field Match Results</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isFlagged
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          Match: {conf}% {isFlagged && '• Flagged'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-slate-400">
                        <div>
                          <strong>OCR Extracted USN:</strong>{' '}
                          <span className={ocr.extractedUsn === st.usn ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                            {ocr.extractedUsn || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <strong>OCR Extracted Name:</strong>{' '}
                          <span className="text-slate-200">{ocr.extractedName || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                    <button
                      onClick={() => {
                        setSelectedStudent(st)
                        setIsOverrideModalOpen(true)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Override</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStudent(st)
                          setIsRejectModalOpen(true)
                        }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(st.id)}
                        disabled={actionLoading || st.profileStatus === 'VERIFIED'}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1 transition shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Lock</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Reject Modal */}
        {isRejectModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Reject Biometric Profile
              </h3>
              <p className="text-xs text-slate-400">
                Rejecting biometrics for <strong>{selectedStudent.name} ({selectedStudent.usn})</strong> will allow them to re-attempt photo upload.
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Rejection Reason:</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. ID photo is blurry, or webcam photo does not match ID card..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Override Modal */}
        {isOverrideModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Administrative Status Override
              </h3>
              <p className="text-xs text-slate-400">
                Override profile status for <strong>{selectedStudent.name} ({selectedStudent.usn})</strong>. This action is recorded in the audit log.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Target Profile Status:</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PENDING">PENDING (Reset for re-enrollment)</option>
                    <option value="VERIFIED">VERIFIED (Force Approve & Lock)</option>
                    <option value="REJECTED">REJECTED (Force Reject)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Override Audit Reason:</label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Mandatory administrative justification for override..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideSubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Execute Override
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
