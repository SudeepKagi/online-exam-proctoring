import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { toast } from 'sonner'
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

  // Webcam capture modal state
  const videoRef = useRef(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [stream, setStream] = useState(null)

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
        setDepartment(s.department || 'Computer Science & Engineering')
        setSemester(s.semester || 1)
        setFacePhotoUrl(s.facePhotoUrl || user?.facePhotoUrl || '')
        setIdCardPhotoUrl(s.idCardPhotoUrl || user?.idCardPhotoUrl || '')
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

  // Webcam controls for Face Photo
  const startCamera = async () => {
    try {
      setIsCameraActive(true)
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      toast.error('Unable to access camera for face capture')
      setIsCameraActive(false)
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setFacePhotoUrl(dataUrl)
    stopCamera()
    toast.success('New biometric photo captured.')
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }

  const handleIdUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setIdCardPhotoUrl(reader.result)
        toast.success('ID card photo uploaded.')
      }
      reader.readAsDataURL(file)
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
      const payload = {
        name,
        usn,
        email,
        phone,
        department,
        semester,
        facePhotoUrl,
        idCardPhotoUrl
      }
      if (newPassword) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }

      await api.patch('/student/profile', payload)
      toast.success('Profile credentials updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await refreshUser()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.')
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
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Candidate Profile & Biometrics
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              Manage your verified student credentials, academic department, and examination ID photos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/student/enrollment')}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2f80ed] text-xs font-extrabold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0"
          >
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Biometric Verification Portal</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* 1. Academic & Personal Identification */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#2f80ed]" />
                  Academic & Personal Information
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Ensure your USN, department, and semester match your official university registry.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold uppercase tracking-wider border border-emerald-200">
                Enrolled Candidate
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Candidate Full Name</label>
                <input
                  type="text"
                  value={name}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100 border-1.5 border-slate-300 rounded-xl text-xs text-slate-700 font-extrabold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">University USN / Roll No.</label>
                <input
                  type="text"
                  value={usn}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100 border-1.5 border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-700 font-extrabold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Institutional Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Contact Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Department / Stream</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                  <option value="Information Science & Engineering">Information Science & Engineering (ISE)</option>
                  <option value="Artificial Intelligence & Machine Learning">AI & Machine Learning (AIML)</option>
                  <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                  <option value="Electrical & Electronics">Electrical & Electronics (EEE)</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Current Semester</label>
                <select
                  value={semester}
                  onChange={e => setSemester(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Password Change */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                Security & Password Update
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Leave blank if you do not wish to change your existing password.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-9 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
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
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-3.5 pr-9 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
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
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border-1.5 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* 3. Biometric Verification Reference Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Live Reference Face */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#2f80ed]" />
                    Reference Facial Photo
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                    Registered
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Matched against your live camera stream during pre-exam identity verification.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-[#f8fafc] rounded-xl border border-slate-200">
                {facePhotoUrl ? (
                  <img
                    src={facePhotoUrl}
                    alt="Enrolled Face"
                    className="w-40 h-40 object-cover rounded-xl border border-slate-300 shadow-xs"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <User size={36} />
                    <span className="text-xs font-bold mt-2">No photo captured</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={startCamera}
                className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2f80ed] text-xs font-extrabold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera size={15} />
                <span>Re-capture Live Photo</span>
              </button>
            </div>

            {/* Institutional ID Document Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    Official ID Document
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                    ID Uploaded
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Used for automated OCR extraction and candidate identity verification.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-[#f8fafc] rounded-xl border border-slate-200">
                {idCardPhotoUrl ? (
                  <img
                    src={idCardPhotoUrl}
                    alt="Institutional ID"
                    className="w-48 h-32 object-cover rounded-xl border border-slate-300 shadow-xs"
                  />
                ) : (
                  <div className="w-48 h-32 rounded-xl bg-white border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <Upload size={28} />
                    <span className="text-xs font-bold mt-2">No ID card uploaded</span>
                  </div>
                )}
              </div>

              <label className="w-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-extrabold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 text-center">
                <Upload size={15} />
                <span>Upload New ID Card</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIdUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] disabled:opacity-50 text-white text-xs font-extrabold py-2.5 px-6 rounded-xl shadow-md shadow-blue-200 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>

        {/* Modal for Camera Capture */}
        {isCameraActive && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f172a]">Live Webcam Facial Capture</h3>
                <button onClick={stopCamera} className="text-[#94a3b8] hover:text-[#0f172a] text-xs cursor-pointer">
                  Cancel
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-[#2f80ed]/40 rounded-xl pointer-events-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2 bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Camera size={14} />
                  <span>Capture Photo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
