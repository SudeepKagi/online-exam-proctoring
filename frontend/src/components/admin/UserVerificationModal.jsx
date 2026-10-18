import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import { CheckCircle2, XCircle, ShieldCheck, Loader2, ZoomIn, ZoomOut, User, FileText, Phone, Mail, Building, Key } from 'lucide-react'

export default function UserVerificationModal({ user, open, onOpenChange, onSuccess }) {
  const [photos, setPhotos] = useState({ referencePhotoUrl: null, idCardPhotoUrl: null })
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')
  const [zoomedImage, setZoomedImage] = useState(null)
  const [adminPasswordReset, setAdminPasswordReset] = useState({ open: false, password: '', loading: false, msg: '' })

  useEffect(() => {
    if (user && open) {
      setShowRejectBox(false)
      setRejectionReason('')
      setError('')
      setAdminPasswordReset({ open: false, password: '', loading: false, msg: '' })

      if (user.referencePhotoUrl || user.idCardPhotoUrl) {
        setPhotos({ referencePhotoUrl: user.referencePhotoUrl, idCardPhotoUrl: user.idCardPhotoUrl })
      } else {
        setLoadingPhotos(true)
        api.get(`/users/admin/users/${user.id}/photos`)
          .then(res => setPhotos({ referencePhotoUrl: res.data?.referencePhotoUrl, idCardPhotoUrl: res.data?.idCardPhotoUrl }))
          .catch(() => setPhotos({ referencePhotoUrl: null, idCardPhotoUrl: null }))
          .finally(() => setLoadingPhotos(false))
      }
    }
  }, [user, open])

  if (!user) return null

  const isStudent = user.role === 'STUDENT'
  const meta = user.profileMetadata || {}

  const handleApprove = async () => {
    setActionLoading(true)
    setError('')
    try {
      const endpoint = isStudent ? `/users/admin/students/${user.id}/approve` : `/users/admin/faculty/${user.id}/approve`
      await api.patch(endpoint)
      onSuccess?.(`Account approved for ${user.fullName}`)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Failed to approve account'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason for the candidate.')
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const endpoint = isStudent ? `/users/admin/students/${user.id}/reject` : `/users/admin/faculty/${user.id}/reject`
      await api.patch(endpoint, { reason: rejectionReason.trim(), rejectionReason: rejectionReason.trim() })
      onSuccess?.(`Account rejected for ${user.fullName}. Candidate requested to re-upload.`)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Failed to reject account'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdminResetPassword = async () => {
    if (!adminPasswordReset.password || adminPasswordReset.password.length < 6) {
      setAdminPasswordReset(p => ({ ...p, msg: 'Password must be at least 6 characters' }))
      return
    }
    setAdminPasswordReset(p => ({ ...p, loading: true, msg: '' }))
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: adminPasswordReset.password })
      setAdminPasswordReset(p => ({ ...p, loading: false, msg: 'Password updated successfully!', password: '' }))
    } catch (err) {
      setAdminPasswordReset(p => ({ ...p, loading: false, msg: errorMessage(err, 'Password reset failed') }))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl font-sans max-h-[92vh] overflow-y-auto bg-white border-[#e9eaf2] text-[#28253b] rounded-xl shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
          <DialogHeader className="border-b border-[#e9eaf2] pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-[480] text-[#28253b] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#5266eb]" /> Review & Verify Identity Profile — {user.fullName}
            </DialogTitle>
            <Badge variant="outline" className={user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs rounded-full' : 'bg-[#edecfb] text-[#5266eb] border-[#9cb4e8]/30 text-xs rounded-full'}>
              {user.role} • {user.status}
            </Badge>
          </DialogHeader>

          {error && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-[420]">{error}</div>}

          {/* User Metadata Grid: Mercury surface-tint */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-3.5 bg-[#fbfbff] border border-[#e9eaf2] rounded-xl text-xs">
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">Full Name</span><span className="font-[480] text-[#28253b] truncate block">{user.fullName}</span></div>
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">Email</span><span className="font-[420] text-[#28253b] truncate block">{user.email}</span></div>
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">{isStudent ? 'USN' : 'Employee ID'}</span><span className="font-mono font-[480] text-[#5266eb] truncate block">{user.institutionId || '—'}</span></div>
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">Department</span><span className="font-[420] text-[#28253b] truncate block">{meta.department || user.department || '—'}</span></div>
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">{isStudent ? 'Semester' : 'Designation'}</span><span className="font-[420] text-[#28253b] truncate block">{isStudent ? `Sem ${meta.semester || '—'}` : (meta.designation || '—')}</span></div>
            <div><span className="text-[#554e7b] block text-[10px] font-[500] uppercase">Phone</span><span className="font-[420] text-[#28253b] truncate block">{meta.phone || '—'}</span></div>
          </div>

          {/* Photo Inspection Section */}
          <div className={`grid gap-4 pt-1 ${isStudent ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto w-full'}`}>
            {isStudent && (
              <div className="space-y-1.5 text-center">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5"><User className="w-4 h-4 text-[#5266eb]" /> Biometric Face Photo</span>
                  {photos.referencePhotoUrl && (
                    <Button variant="ghost" size="xs" onClick={() => setZoomedImage({ title: 'Biometric Face Photo', url: photos.referencePhotoUrl })} className="h-6 text-[10px] gap-1 text-[#5266eb] rounded-full">
                      <ZoomIn className="w-3 h-3" /> Zoom
                    </Button>
                  )}
                </div>
                <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-[#e9eaf2] bg-[#fbfcfd] flex items-center justify-center relative group">
                  {loadingPhotos ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : photos.referencePhotoUrl ? (
                    <img src={photos.referencePhotoUrl} alt="Face Reference" className="w-full h-full object-cover cursor-pointer" onClick={() => setZoomedImage({ title: 'Biometric Face Photo', url: photos.referencePhotoUrl })} />
                  ) : <span className="text-xs text-[#70707d] font-[400]">No biometric face photo</span>}
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-center">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#5266eb]" /> College ID Card Photo</span>
                {photos.idCardPhotoUrl && (
                  <Button variant="ghost" size="xs" onClick={() => setZoomedImage({ title: 'College ID Card Document', url: photos.idCardPhotoUrl })} className="h-6 text-[10px] gap-1 text-[#5266eb] rounded-full">
                    <ZoomIn className="w-3 h-3" /> Zoom
                  </Button>
                )}
              </div>
              <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-[#e9eaf2] bg-[#fbfcfd] flex items-center justify-center p-2 relative group">
                {loadingPhotos ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : photos.idCardPhotoUrl ? (
                  <img src={photos.idCardPhotoUrl} alt="College ID" className="w-full h-full object-contain cursor-pointer" onClick={() => setZoomedImage({ title: 'College ID Card Document', url: photos.idCardPhotoUrl })} />
                ) : <span className="text-xs text-[#70707d] font-[400]">No College ID card uploaded</span>}
              </div>
            </div>
          </div>

          {/* Rejection input */}
          {showRejectBox && (
            <div className="space-y-2 p-3 bg-red-50/60 border border-red-200 rounded-xl">
              <span className="text-xs font-bold text-red-900 block">Rejection Reason (Visible to candidate):</span>
              <textarea rows={2} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. ID card photo is illegible, please upload a clearer scan..." className="w-full bg-white border border-red-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-red-500 font-sans" />
            </div>
          )}

          {/* Password Reset Drawer */}
          {adminPasswordReset.open && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-amber-600" /> Set Temporary Password</span>
              <div className="flex gap-2">
                <input type="password" value={adminPasswordReset.password} onChange={(e) => setAdminPasswordReset(p => ({ ...p, password: e.target.value }))} placeholder="New temporary password (min 6 chars)" className="h-9 px-3 text-xs border border-slate-300 rounded-lg flex-1 bg-white" />
                <Button size="sm" onClick={handleAdminResetPassword} disabled={adminPasswordReset.loading} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg">{adminPasswordReset.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set Password'}</Button>
              </div>
              {adminPasswordReset.msg && <span className="text-[11px] font-medium text-slate-600 block">{adminPasswordReset.msg}</span>}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#e9eaf2] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={actionLoading} className="text-xs font-[420] rounded-full border-[#e9eaf2]">Close</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdminPasswordReset(p => ({ ...p, open: !p.open }))} className="text-xs font-[420] text-[#554e7b] gap-1 rounded-full"><Key className="w-3.5 h-3.5" /> Reset Password</Button>
            </div>
            <div className="flex items-center gap-2">
              {!showRejectBox ? (
                <Button variant="outline" size="sm" onClick={() => setShowRejectBox(true)} disabled={actionLoading} className="text-xs font-[420] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 rounded-full">
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject & Request Re-upload
                </Button>
              ) : (
                <Button size="sm" onClick={handleReject} disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white text-xs font-[420] rounded-full">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null} Confirm Rejection
                </Button>
              )}
              <Button size="sm" onClick={handleApprove} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-[420] rounded-[32px] px-5 shadow-xs">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} Approve Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-Screen Zoom Toggle */}
      {zoomedImage && (
        <Dialog open={Boolean(zoomedImage)} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-4 flex flex-col items-center">
            <DialogHeader className="w-full pb-2 border-b"><DialogTitle className="text-sm font-bold">{zoomedImage.title}</DialogTitle></DialogHeader>
            <div className="w-full max-h-[75vh] flex items-center justify-center overflow-auto mt-2 bg-slate-900 rounded-xl p-2">
              <img src={zoomedImage.url} alt={zoomedImage.title} className="max-h-[70vh] object-contain rounded-lg shadow-xl" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
