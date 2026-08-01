import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
  User,
  Key,
  ShieldCheck,
  Camera,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  GraduationCap,
  Phone,
  Mail,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
  const [department, setDepartment] = useState('Computer Science')
  const [semester, setSemester] = useState(6)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Photos
  const [facePhotoUrl, setFacePhotoUrl] = useState('')
  const [idCardPhotoUrl, setIdCardPhotoUrl] = useState('')

  // Camera capture modal state
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
      const s = res.data.student
      if (s) {
        setName(s.name || user?.name || '')
        setUsn(s.usn || user?.usn || '')
        setEmail(s.email || user?.email || '')
        setPhone(s.phone || '')
        setDepartment(s.department || 'Computer Science')
        setSemester(s.semester || 1)
        setFacePhotoUrl(s.facePhotoUrl || '')
        setIdCardPhotoUrl(s.idCardPhotoUrl || '')
      }
    } catch (err) {
      console.warn('Failed to load profile details:', err)
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

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, 400, 400)
    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setFacePhotoUrl(base64)
    stopCamera()
    toast.success('Live face photo captured successfully!')
  }

  // Handle image file uploads
  const handleFileUpload = (e, setUrl) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setUrl(reader.result)
      toast.success('Photo uploaded successfully!')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.')
      return
    }

    try {
      setSaving(true)
      const payload = {
        usn,
        phone,
        email,
        department,
        semester,
        facePhotoUrl,
        idCardPhotoUrl,
      }

      if (newPassword) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }

      const res = await api.put('/student/profile', payload)
      toast.success('Profile and Biometrics updated successfully!')
      if (refreshUser) refreshUser()
      
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update profile'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="student" activeTab="profile">
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="student" activeTab="profile">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-400" />
              Candidate Profile & Biometric Setup
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Update your account credentials, academic department, and pre-exam biometric verification photos.
            </p>
          </div>
          {user?.mustChangePassword && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1 text-xs">
              <AlertCircle className="w-3.5 h-3.5 mr-1" /> First-Login Password Change Required
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Academic & Personal Identification */}
          <Card className="bg-[#141416] border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                Academic & Personal Information
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Ensure your USN, department, and semester match your official university enrollment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Candidate Full Name</label>
                <Input value={name} disabled className="bg-zinc-900 border-zinc-700 text-zinc-300 cursor-not-allowed" />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">University USN / Roll No.</label>
                <Input value={usn} onChange={e => setUsn(e.target.value)} required className="bg-zinc-900 border-zinc-700 text-white" placeholder="e.g. 1NT23CS001" />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Email Address</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} required type="email" className="bg-zinc-900 border-zinc-700 text-white" />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Phone Number</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white" placeholder="e.g. +91 9876543210" />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Department / Branch</label>
                <select 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Computer Science">Computer Science & Engineering</option>
                  <option value="Information Science">Information Science & Engineering</option>
                  <option value="Electronics & Comm">Electronics & Communication</option>
                  <option value="Mechanical Engg">Mechanical Engineering</option>
                  <option value="Civil Engg">Civil Engineering</option>
                  <option value="AI & Machine Learning">Artificial Intelligence & Data Science</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Current Semester</label>
                <select 
                  value={semester} 
                  onChange={e => setSemester(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* 2. Password Change */}
          <Card className="bg-[#141416] border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                Security & Password Update
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Leave password fields blank if you do not wish to change your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Current Password</label>
                <Input 
                  type="password"
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  className="bg-zinc-900 border-zinc-700 text-white" 
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">New Password</label>
                <Input 
                  type="password"
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="bg-zinc-900 border-zinc-700 text-white" 
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1 block">Confirm New Password</label>
                <Input 
                  type="password"
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="bg-zinc-900 border-zinc-700 text-white" 
                  placeholder="••••••••"
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Biometric Face & Student ID Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Face Photo */}
            <Card className="bg-[#141416] border-zinc-800 text-zinc-100">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Biometric Face Reference Photo
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  This photo is matched against your live camera during pre-exam verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  {facePhotoUrl ? (
                    <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-lg bg-zinc-950">
                      <img src={facePhotoUrl} alt="Face Reference" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-2 right-2 bg-emerald-500 text-black font-semibold text-[10px]">
                        REGISTERED
                      </Badge>
                    </div>
                  ) : (
                    <div className="w-40 h-40 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500">
                      <User className="w-12 h-12 mb-2 stroke-1" />
                      <span className="text-xs">No Face Photo</span>
                    </div>
                  )}
                </div>

                {isCameraActive && (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-48 rounded-lg object-cover bg-black" />
                    <Button type="button" onClick={capturePhoto} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Camera className="w-4 h-4 mr-2" /> Snap Face Photo
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  {!isCameraActive && (
                    <Button type="button" variant="outline" onClick={startCamera} className="flex-1 border-zinc-700 text-zinc-200 hover:bg-zinc-800">
                      <Camera className="w-4 h-4 mr-2 text-emerald-400" /> Webcam Capture
                    </Button>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center h-10 px-4 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-medium">
                      <Upload className="w-4 h-4 mr-2 text-indigo-400" /> Upload File
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, setFacePhotoUrl)} />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Official ID Card Photo */}
            <Card className="bg-[#141416] border-zinc-800 text-zinc-100">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Official Student ID Card Photo
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  Used for OCR USN extraction and identity authorization before tests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  {idCardPhotoUrl ? (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-lg bg-zinc-950">
                      <img src={idCardPhotoUrl} alt="ID Card" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-2 right-2 bg-indigo-500 text-white font-semibold text-[10px]">
                        ID UPLOADED
                      </Badge>
                    </div>
                  ) : (
                    <div className="w-full h-40 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500">
                      <FileText className="w-12 h-12 mb-2 stroke-1" />
                      <span className="text-xs">No ID Card Photo Uploaded</span>
                    </div>
                  )}
                </div>

                <label className="block w-full cursor-pointer">
                  <div className="flex items-center justify-center h-10 px-4 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-medium">
                    <Upload className="w-4 h-4 mr-2 text-indigo-400" /> Upload ID Card Photo
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, setIdCardPhotoUrl)} />
                </label>
              </CardContent>
            </Card>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-2.5 h-11 text-base shadow-lg shadow-emerald-950/40"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Saving Profile...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" /> Save Profile & Biometrics
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
