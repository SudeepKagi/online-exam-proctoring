import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api, { extractErrorMessage } from '@/utils/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
  User, Key, Camera, Upload, Save, CheckCircle2,
  AlertCircle, GraduationCap, Phone, Mail, RefreshCw,
  Building, ShieldCheck, Eye, EyeOff
} from 'lucide-react'

export default function StudentProfile() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [usn, setUsn] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('Computer Science & Engineering')
  const [semester, setSemester] = useState(6)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  // Photos
  const [facePhotoUrl, setFacePhotoUrl] = useState('')
  const [idCardPhotoUrl, setIdCardPhotoUrl] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get('/student/profile')
      const s = res.data?.student || res.data
      if (s) {
        setName(s.name || user?.name || '')
        setUsn(s.usn || user?.usn || '')
        setEmail(s.email || user?.email || '')
        setPhone(s.phone || '')
        setDepartment(s.departmentCode || s.department || 'ECE')
        setSemester(s.semester || 1)
        setFacePhotoUrl(s.facePhotoKey || s.facePhotoUrl || user?.facePhotoUrl || '')
        setIdCardPhotoUrl(s.idCardPhotoKey || s.idCardPhotoUrl || user?.idCardPhotoUrl || '')
      }
    } catch (err) {
      console.warn('Failed to load profile details:', err)
      setName(user?.name || '')
      setUsn(user?.usn || '')
      setEmail(user?.email || '')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.')
      return
    }

    setSaving(true)
    try {
      if (newPassword) {
        if (!currentPassword) {
          toast.error('Current password is required to change your password.')
          setSaving(false)
          return
        }
        await api.post('/auth/change-password', {
          currentPassword,
          newPassword
        })
      }

      const payload = {
        name: name.trim(),
        phone: phone ? phone.trim() : null
      }

      await api.put('/student/profile', payload)

      toast.success('Profile presentation details updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await refreshUser()
      await fetchProfile()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update profile.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Student Profile">
        <div className="flex items-center justify-center min-h-[50vh]">
          <RefreshCw className="w-6 h-6 text-[#2f80ed] animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Student Workspace">
      <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans text-slate-900">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2f80ed] flex items-center justify-center border border-blue-100">
                <User size={18} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Candidate Profile & Biometrics
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-normal mt-1">
              Manage your verified student credentials, academic department, and examination ID photos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/student/enrollment')}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2f80ed] text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0"
          >
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Biometric Verification Portal</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* 1. Academic & Personal Identification */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#2f80ed]" />
                  Academic & Personal Information
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Ensure your USN, department, and semester match your official university registry.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase tracking-wider border border-emerald-200">
                Enrolled Candidate
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Candidate Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Enter candidate full name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">University USN / Roll No. (Official)</label>
                <input
                  type="text"
                  value={usn}
                  disabled
                  title="USN is bound to official university registry and cannot be modified"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-700 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Institutional Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  title="Institutional email address is verified and administrative-only"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-normal text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Contact Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Department / Stream (Official)</label>
                <input
                  type="text"
                  value={department}
                  disabled
                  title="Department allocation is managed by university administration"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-normal text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Current Semester (Official)</label>
                <input
                  type="text"
                  value={`Semester ${semester}`}
                  disabled
                  title="Semester enrollment is bound to official university records"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-normal text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* 2. Password Change */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                Security & Password Update
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Leave blank if you do not wish to change your existing password.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* 3. Biometric Verification Reference Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Live Reference Face */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#2f80ed]" />
                    Reference Facial Photo
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    Registered
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">
                  Matched against your live camera stream during pre-exam identity verification.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-slate-50/75 rounded-xl border border-slate-200">
                {facePhotoUrl ? (
                  <img
                    src={facePhotoUrl}
                    alt="Enrolled Face"
                    className="w-40 h-40 object-cover rounded-xl border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <User size={36} />
                    <span className="text-xs font-medium mt-2">No photo captured</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/student/enrollment')}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck size={15} className="text-emerald-600" />
                <span>Biometric Enrollment & Verification Portal</span>
              </button>
            </div>

            {/* Institutional ID Document Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    Official ID Document
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    ID Uploaded
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">
                  Used for automated document extraction and candidate identity verification.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-slate-50/75 rounded-xl border border-slate-200">
                {idCardPhotoUrl ? (
                  <img
                    src={idCardPhotoUrl}
                    alt="Institutional ID"
                    className="w-48 h-32 object-cover rounded-xl border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-48 h-32 rounded-xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <Upload size={28} />
                    <span className="text-xs font-medium mt-2">No ID card uploaded</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/student/enrollment')}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 text-center"
              >
                <ShieldCheck size={15} className="text-purple-600" />
                <span>Official Document Verification Portal</span>
              </button>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
