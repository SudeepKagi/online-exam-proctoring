import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import { CheckCircle2, XCircle, ShieldCheck, Loader2, User, FileText, AlertTriangle } from 'lucide-react'

export default function ReviewUserDialog({ user, open, onOpenChange, onSuccess }) {
  const [photos, setPhotos] = useState({ referencePhotoUrl: null, idCardPhotoUrl: null })
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && open) {
      setLoadingPhotos(true)
      setShowRejectBox(false)
      setRejectionReason('')
      setError('')

      api.get(`/users/admin/users/${user.id}/photos`)
        .then(res => setPhotos(res.data?.photos || {}))
        .catch(() => setPhotos({ referencePhotoUrl: null, idCardPhotoUrl: null }))
        .finally(() => setLoadingPhotos(false))
    }
  }, [user, open])

  if (!user) return null

  const isStudent = user.role === 'STUDENT'
  const meta = (user.profileMetadata && typeof user.profileMetadata === 'object') ? user.profileMetadata : {}

  const handleApprove = async () => {
    setActionLoading(true)
    setError('')
    try {
      const endpoint = isStudent
        ? `/users/admin/students/${user.id}/approve`
        : `/users/admin/faculty/${user.id}/approve`
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
      const endpoint = isStudent
        ? `/users/admin/students/${user.id}/reject`
        : `/users/admin/faculty/${user.id}/reject`
      await api.patch(endpoint, { reason: rejectionReason.trim() })
      onSuccess?.(`Account rejected for ${user.fullName}. Candidate requested to re-upload.`)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Failed to reject account'))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Review & Verify Identity Profile
            </DialogTitle>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              {user.role} PENDING APPROVAL
            </Badge>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Profile Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Candidate</span>
            <span className="font-bold text-slate-900">{user.fullName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">{isStudent ? 'Roll No / USN' : 'Employee ID'}</span>
            <span className="font-mono font-bold text-blue-600">{user.institutionId || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Department</span>
            <span className="font-medium text-slate-700">{meta.department || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">{isStudent ? 'Semester' : 'Designation'}</span>
            <span className="font-medium text-slate-700">{isStudent ? `Sem ${meta.semester || '—'}` : (meta.designation || '—')}</span>
          </div>
        </div>

        {/* Side-by-Side Photos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Live Face Photo */}
          <div className="space-y-1.5 text-center">
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" /> Live Webcam Face Photo
            </span>
            <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              {loadingPhotos ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : photos.referencePhotoUrl ? (
                <img src={photos.referencePhotoUrl} alt="Live Reference Face" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-slate-400 font-medium">No live face snapshot</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Captured via browser webcam during onboarding</span>
          </div>

          {/* College ID Card */}
          <div className="space-y-1.5 text-center">
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" /> College ID Card Document
            </span>
            <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-2">
              {loadingPhotos ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : photos.idCardPhotoUrl ? (
                <img src={photos.idCardPhotoUrl} alt="College ID Document" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400 font-medium">No College ID card uploaded</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Official institutional document upload</span>
          </div>
        </div>

        {/* Rejection Input */}
        {showRejectBox && (
          <div className="space-y-2 p-3 bg-red-50/60 border border-red-200 rounded-xl">
            <Label className="text-xs font-bold text-red-900">Rejection Reason (Visible to candidate):</Label>
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. ID card photo is blurry, or face photo does not match..."
              className="w-full bg-white border border-red-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-red-500 font-sans"
            />
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={actionLoading}
            className="text-xs font-semibold rounded-xl cursor-pointer"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!showRejectBox ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectBox(true)}
                disabled={actionLoading}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 rounded-xl cursor-pointer"
              >
                <XCircle className="w-4 h-4 mr-1.5" /> Reject & Request Re-upload
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleReject}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Confirm Rejection
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Approve Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
