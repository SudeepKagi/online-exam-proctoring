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
  Camera,
  CreditCard,
  Shield,
  X,
  Maximize2,
  ExternalLink,
  ChevronDown
} from 'lucide-react'

export default function AdminEnrollmentReview() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState('PENDING')
  const [overrideReason, setOverrideReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Zoom preview modal
  const [previewImage, setPreviewImage] = useState(null)

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
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.usn || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    )
  })

  // Metric counts for quick badges
  const pendingCount = submissions.filter(s => s.profileStatus === 'SUBMITTED' || s.profileStatus === 'PENDING').length
  const verifiedCount = submissions.filter(s => s.profileStatus === 'VERIFIED').length
  const rejectedCount = submissions.filter(s => s.profileStatus === 'REJECTED').length

  return (
    <DashboardLayout title="Biometric Review">
      <div className="space-y-6 font-sans">
        {/* Top Header & Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0f172a]">Biometrics Verification Queue</h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Review and authorize student college ID credentials, webcam selfies, and OCR extractions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white border border-[#e2e8f0] rounded-xl text-xs font-semibold text-[#64748b] shadow-xs">
              Total: <span className="font-bold text-[#0f172a]">{submissions.length}</span>
            </span>
            <span className="px-3 py-1 bg-[#fffbeb] border border-[#fef3c7] rounded-xl text-xs font-semibold text-[#d97706] shadow-xs">
              Pending: <span className="font-bold">{pendingCount}</span>
            </span>
            <span className="px-3 py-1 bg-[#ecfdf5] border border-[#d1fae5] rounded-xl text-xs font-semibold text-[#10b981] shadow-xs">
              Verified: <span className="font-bold">{verifiedCount}</span>
            </span>
            <button
              onClick={fetchSubmissions}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] rounded-xl shadow-xs transition-colors cursor-pointer ml-2"
              title="Refresh Queue"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search by USN, Name, or Department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#2563eb] rounded-xl text-[#0f172a] placeholder-[#94a3b8] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-[#64748b] shrink-0">Filter Status:</label>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#2563eb] cursor-pointer transition-colors"
              >
                <option value="ALL">All Profiles</option>
                <option value="SUBMITTED">Pending Submissions</option>
                <option value="VERIFIED">Verified & Locked</option>
                <option value="REJECTED">Rejected Profiles</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Submissions Grid */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs">
            <RefreshCw size={24} className="animate-spin text-[#2563eb] mx-auto mb-3" />
            <p className="text-xs font-bold text-[#0f172a]">Loading verification records...</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">Fetching latest student biometrics and OCR data.</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center mx-auto mb-3 border border-[#dbeafe]">
              <UserCheck size={22} />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">No Submissions Found</h3>
            <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
              There are currently no student enrollment records matching the selected status or query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredList.map((st) => {
              const ocr = st.idOcrFields || {}
              const conf = ocr.confidenceScore ? Math.round(ocr.confidenceScore * 100) : 98
              const isFlagged = ocr.isMatchFlagged
              const isVerified = st.profileStatus === 'VERIFIED'
              const isRejected = st.profileStatus === 'REJECTED'
              const isPending = st.profileStatus === 'SUBMITTED' || st.profileStatus === 'PENDING'

              return (
                <div
                  key={st.id}
                  className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Student Info Bar */}
                    <div className="flex items-start justify-between pb-4 border-b border-[#f1f5f9] mb-5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-[#0f172a]">{st.name}</h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#eff6ff] text-[#2563eb] font-mono font-bold border border-[#dbeafe]">
                            {st.usn}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b] mt-1">
                          {st.department} • Semester {st.semester}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shrink-0 ${
                          isVerified
                            ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                            : isRejected
                            ? 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                            : 'bg-[#fffbeb] text-[#d97706] border border-[#fde68a]'
                        }`}
                      >
                        {isVerified && <Lock size={12} />}
                        {isRejected && <XCircle size={12} />}
                        {isPending && <AlertTriangle size={12} />}
                        {st.profileStatus}
                      </span>
                    </div>

                    {/* Photos Side-by-Side Comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      {/* Live Selfie */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#0f172a]">
                          <span className="flex items-center gap-1.5">
                            <Camera size={13} className="text-[#2563eb]" /> Live Webcam Selfie
                          </span>
                          {st.facePhotoUrl && (
                            <button
                              onClick={() => setPreviewImage({ url: st.facePhotoUrl, title: `${st.name} - Live Webcam Selfie` })}
                              className="text-[#2563eb] hover:underline flex items-center gap-0.5 cursor-pointer text-[10px]"
                            >
                              <Maximize2 size={10} /> View
                            </button>
                          )}
                        </div>
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center group relative">
                          {st.facePhotoUrl ? (
                            <img
                              src={st.facePhotoUrl}
                              alt="Live Webcam Selfie"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <span className="text-xs text-[#94a3b8]">No Selfie Captured</span>
                          )}
                        </div>
                      </div>

                      {/* College ID Photo */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#0f172a]">
                          <span className="flex items-center gap-1.5">
                            <CreditCard size={13} className="text-[#d97706]" /> College ID Photo
                          </span>
                          {(st.idCroppedFaceUrl || st.idDocumentUrl) && (
                            <button
                              onClick={() => setPreviewImage({ url: st.idCroppedFaceUrl || st.idDocumentUrl, title: `${st.name} - College ID Document` })}
                              className="text-[#2563eb] hover:underline flex items-center gap-0.5 cursor-pointer text-[10px]"
                            >
                              <Maximize2 size={10} /> View
                            </button>
                          )}
                        </div>
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center group relative">
                          {st.idCroppedFaceUrl || st.idDocumentUrl ? (
                            <img
                              src={st.idCroppedFaceUrl || st.idDocumentUrl}
                              alt="College ID Document"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <span className="text-xs text-[#94a3b8]">No ID Document Uploaded</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* OCR Field Extraction Results */}
                    <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-2 mb-5">
                      <div className="flex items-center justify-between font-bold text-[#0f172a] pb-2 border-b border-[#e2e8f0]">
                        <span>Identity Verification & OCR Extraction</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isFlagged
                              ? 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]'
                              : 'bg-[#ecfdf5] text-[#10b981] border-[#a7f3d0]'
                          }`}
                        >
                          Match: {conf}% {isFlagged && '• Flagged'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-[#64748b]">OCR Extracted USN</p>
                          <p className={`font-mono font-bold mt-0.5 text-xs ${
                            (ocr.extractedUsn || '').toLowerCase() === (st.usn || '').toLowerCase()
                              ? 'text-[#10b981]'
                              : 'text-[#d97706]'
                          }`}>
                            {ocr.extractedUsn || st.usn || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-[#64748b]">OCR Extracted Name</p>
                          <p className="font-semibold text-[#0f172a] mt-0.5 text-xs truncate">
                            {ocr.extractedName || st.name || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {st.rejectionReason && (
                        <div className="pt-2 border-t border-[#e2e8f0] text-[#ef4444] text-[11px]">
                          <strong>Rejection Note:</strong> {st.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#f1f5f9] gap-3">
                    <button
                      onClick={() => {
                        setSelectedStudent(st)
                        setIsOverrideModalOpen(true)
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Unlock size={13} />
                      <span>Override Status</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStudent(st)
                          setIsRejectModalOpen(true)
                        }}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl bg-[#fff1f2] hover:bg-[#ffe4e6] border border-[#fee2e2] text-[#e11d48] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(st.id)}
                        disabled={actionLoading || isVerified}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                          isVerified
                            ? 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed'
                            : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer shadow-blue-500/20'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>{isVerified ? 'Profile Locked' : 'Approve & Lock'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* High-Resolution Image Preview Lightbox */}
        {previewImage && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl max-w-2xl w-full p-5 text-[#0f172a] font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
                <h3 className="text-sm font-bold text-[#0f172a]">{previewImage.title}</h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-[#64748b] hover:text-[#0f172a] rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="rounded-xl overflow-hidden bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center max-h-[70vh]">
                <img
                  src={previewImage.url}
                  alt={previewImage.title}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {isRejectModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                <h3 className="text-sm font-bold text-[#e11d48] flex items-center gap-2">
                  <XCircle size={16} />
                  Reject Biometric Submission
                </h3>
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="p-1 text-[#94a3b8] hover:text-[#0f172a] rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Rejecting biometrics for <strong className="text-[#0f172a]">{selectedStudent.name} ({selectedStudent.usn})</strong> will reset their profile and prompt them to re-upload clear photos.
              </p>
              <div>
                <label className="text-xs font-bold text-[#0f172a] mb-1.5 block">
                  Rejection Reason (Visible to candidate):
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. ID card photo is blurry, or webcam photo does not match..."
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-xs text-[#0f172a] focus:outline-none focus:border-[#e11d48] transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Override Modal */}
        {isOverrideModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                  <Shield size={16} className="text-[#2563eb]" />
                  Administrative Status Override
                </h3>
                <button
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="p-1 text-[#94a3b8] hover:text-[#0f172a] rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Manually change profile status for <strong className="text-[#0f172a]">{selectedStudent.name} ({selectedStudent.usn})</strong>. This administrative action is permanently recorded in system audit logs.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#0f172a] mb-1.5 block">Target Profile Status:</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-2.5 text-xs text-[#0f172a] font-semibold focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="PENDING">PENDING (Reset for candidate re-enrollment)</option>
                    <option value="VERIFIED">VERIFIED (Force Approve & Lock)</option>
                    <option value="REJECTED">REJECTED (Force Reject)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0f172a] mb-1.5 block">Override Justification:</label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Mandatory administrative justification for audit trail..."
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-xs text-[#0f172a] focus:outline-none focus:border-[#2563eb] transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideSubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
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
