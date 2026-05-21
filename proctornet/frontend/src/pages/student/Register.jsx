import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff, User, Hash, Phone, Upload, CheckCircle, ArrowLeft, Camera } from 'lucide-react'
import api from '@/utils/api'

const DEPARTMENTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']

export default function StudentRegister() {
  const [form, setForm] = useState({
    name: '', email: '', usn: '', password: '', confirmPassword: '',
    department: '', semester: '', phone: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [idCard, setIdCard] = useState(null)
  const [idCardPreview, setIdCardPreview] = useState(null)
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [profilePreview, setProfilePreview] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const idCardRef = useRef()
  const photoRef = useRef()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [liveStream, setLiveStream] = useState(null)

  // Assign stream to video element AFTER it mounts in the DOM
  useEffect(() => {
    if (liveStream && videoRef.current) {
      videoRef.current.srcObject = liveStream
      videoRef.current.play().catch(err => console.warn('Video play error:', err))
    }
  }, [liveStream, cameraActive])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      // Set cameraActive first so the <video> element renders,
      // then the useEffect above will assign srcObject once it's in the DOM
      setCameraActive(true)
      setLiveStream(stream)
      setErrors(prev => ({ ...prev, photo: '' }))
    } catch (err) {
      console.error('Camera access failed:', err)
      setErrors(prev => ({ ...prev, photo: 'Could not access webcam. Please allow camera permission in your browser.' }))
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setLiveStream(null)
    setCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setProfilePreview(dataUrl)
    setProfilePhoto(dataUrl)
    setErrors(prev => ({ ...prev, photo: '' }))
    stopCamera()
  }

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleIdCard = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErrors(prev => ({ ...prev, idCard: 'File must be under 5MB' })); return }
    setIdCard(file)
    setErrors(prev => ({ ...prev, idCard: '' }))
    const reader = new FileReader()
    reader.onload = (ev) => setIdCardPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setErrors(prev => ({ ...prev, photo: 'Only image files allowed' })); return }
    if (file.size > 2 * 1024 * 1024) { setErrors(prev => ({ ...prev, photo: 'Photo must be under 2MB' })); return }
    setProfilePhoto(file)
    setErrors(prev => ({ ...prev, photo: '' }))
    const reader = new FileReader()
    reader.onload = (ev) => setProfilePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Full name is required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required'
    if (!form.usn.trim()) e.usn = 'USN is required'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!form.department) e.department = 'Select a department'
    if (!form.semester) e.semester = 'Select a semester'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (!idCard) e.idCard = 'College ID card is required'
    if (!profilePhoto) e.photo = 'Profile photo is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        usn: form.usn.trim().toUpperCase(),
        email: form.email.trim(),
        password: form.password,
        department: form.department,
        semester: form.semester,
        phone: form.phone.trim(),
        facePhotoBase64: profilePreview,
        idCardBase64: idCardPreview
      }
      await api.post('/auth/student/register', payload)
      setSubmitted(true)
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.'
      setErrors({ submit: msg })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Registration Submitted!</h2>
          <p className="text-gray-600 mb-6">Your ID and details are under review. You'll be notified via email once your account is approved by the administrator.</p>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-semibold text-emerald-800">Review Process</p>
            <p className="text-xs text-emerald-700">1. AI verification of ID card and face photo</p>
            <p className="text-xs text-emerald-700">2. Admin review and approval</p>
            <p className="text-xs text-emerald-700">3. Email notification sent to you</p>
            <p className="text-xs text-emerald-700">4. Login to access your exam dashboard</p>
          </div>
          <Link to="/student/login" className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-emerald-700 transition">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition mb-4">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Link to="/student/login" className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">ProctorNet</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
            <p className="text-gray-500 text-sm mt-1">Submit your details and ID card for admin verification.</p>
          </div>

          {errors.submit && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{errors.submit}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.name} onChange={set('name')} placeholder="John Smith"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.name ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={form.email} onChange={set('email')} placeholder="student@university.edu"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.email ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">USN *</label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.usn} onChange={set('usn')} placeholder="1NM21CS001"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition uppercase ${errors.usn ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.usn && <p className="text-red-500 text-xs mt-1">{errors.usn}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 9876543210"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.phone ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department *</label>
                <select value={form.department} onChange={set('department')}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.department ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester *</label>
                <select value={form.semester} onChange={set('semester')}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.semester ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">Select semester</option>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
                {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters"
                    className={`w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.password ? 'border-red-300' : 'border-gray-200'}`} />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Re-enter password"
                    className={`w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'}`} />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">College ID Card * <span className="text-gray-400 font-normal">(max 5MB)</span></label>
                <input ref={idCardRef} type="file" accept="image/*,.pdf" onChange={handleIdCard} className="hidden" />
                <button type="button" onClick={() => idCardRef.current.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50 ${errors.idCard ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  {idCardPreview ? (
                    <div className="space-y-2">
                      {idCard?.type === 'application/pdf' ? (
                        <div className="text-emerald-600 text-sm font-medium">📄 {idCard.name}</div>
                      ) : (
                        <img src={idCardPreview} alt="ID Card" className="w-full h-24 object-cover rounded-lg" />
                      )}
                      <p className="text-xs text-gray-500">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload size={20} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500">Upload ID card</p>
                    </div>
                  )}
                </button>
                {errors.idCard && <p className="text-red-500 text-xs mt-1">{errors.idCard}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Photo * <span className="text-gray-400 font-normal">(Live Camera Capture)</span></label>
                <canvas ref={canvasRef} className="hidden" />
                
                {profilePreview ? (
                  <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 text-center">
                    <div className="relative inline-block">
                      <img src={profilePreview} alt="Profile Capture" className="w-24 h-24 object-cover rounded-full mx-auto border-2 border-emerald-500 shadow-md" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center border border-white">
                        <CheckCircle size={12} className="text-white" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-medium">Snapshot captured successfully!</p>
                    <button 
                      type="button" 
                      onClick={startCamera}
                      className="mt-3 px-4 py-2 border border-emerald-600 text-emerald-600 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition"
                    >
                      Retake Photo
                    </button>
                  </div>
                ) : cameraActive ? (
                  <div className="border border-emerald-200 bg-gray-900 rounded-xl p-3 text-center">
                    <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-black aspect-video max-h-40 mx-auto flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-2 border-dashed border-emerald-500/40 rounded-lg pointer-events-none flex items-center justify-center">
                        <div className="w-20 h-20 border border-dashed border-emerald-500/60 rounded-full" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 justify-center">
                      <button 
                        type="button" 
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                      >
                        <Camera size={14} /> Capture Photo
                      </button>
                      <button 
                        type="button" 
                        onClick={stopCamera}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50 ${errors.photo ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                        <Camera size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Capture Live Picture</p>
                        <p className="text-xs text-gray-400 mt-0.5">Use your webcam to take your profile picture</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={startCamera}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
                      >
                        Start Camera
                      </button>
                    </div>
                  </div>
                )}
                {errors.photo && <p className="text-red-500 text-xs mt-1">{errors.photo}</p>}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting registration…</>
              ) : 'Submit for Admin Review →'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-500 mb-4">
            Already have an account?{' '}
            <Link to="/student/login" className="text-emerald-600 font-semibold hover:underline">Login here</Link>
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
            <Link to="/faculty/register" className="hover:text-gray-600 transition">Faculty Registration</Link>
            <span>•</span>
            <Link to="/invigilator-login" className="hover:text-gray-600 transition">Invigilator access →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
