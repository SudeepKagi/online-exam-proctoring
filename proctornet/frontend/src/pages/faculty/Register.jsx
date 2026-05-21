import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff, User, Hash, Phone, Upload, CheckCircle, ArrowLeft } from 'lucide-react'
import api from '@/utils/api'

const DEPARTMENTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer']

export default function FacultyRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    department: '', designation: '', employeeId: '', phone: '',
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
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!form.department) e.department = 'Select a department'
    if (!form.designation) e.designation = 'Select a designation'
    if (!form.employeeId.trim()) e.employeeId = 'Employee ID is required'
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
        name: form.name,
        email: form.email,
        password: form.password,
        department: form.department,
        designation: form.designation,
        employeeId: form.employeeId,
        phone: form.phone,
        idCardBase64: idCardPreview,
        profilePhotoBase64: profilePreview
      }
      await api.post('/auth/faculty/register', payload)
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
          <p className="text-gray-600 mb-6">Your ID card is under review. Admin will approve your account within 24 hours. You'll receive an email notification once approved.</p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-semibold text-blue-800">What happens next?</p>
            <p className="text-xs text-blue-700">1. Admin reviews your ID card and details</p>
            <p className="text-xs text-blue-700">2. You receive an approval email</p>
            <p className="text-xs text-blue-700">3. Log in to access your faculty dashboard</p>
          </div>
          <Link to="/faculty/login" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition">
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

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/faculty/login" className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">ProctorNet</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900">Faculty Registration</h1>
            <p className="text-gray-500 text-sm mt-1">Submit your details for admin review. Approval takes 24 hours.</p>
          </div>

          {errors.submit && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{errors.submit}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.name} onChange={set('name')} placeholder="Dr. John Smith"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.name ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={form.email} onChange={set('email')} placeholder="faculty@university.edu"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.email ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Department + Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department *</label>
                <select value={form.department} onChange={set('department')}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.department ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation *</label>
                <select value={form.designation} onChange={set('designation')}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.designation ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.designation && <p className="text-red-500 text-xs mt-1">{errors.designation}</p>}
              </div>
            </div>

            {/* Employee ID + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee ID *</label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.employeeId} onChange={set('employeeId')} placeholder="EMP001"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.employeeId ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.employeeId && <p className="text-red-500 text-xs mt-1">{errors.employeeId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 9876543210"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.phone ? 'border-red-300' : 'border-gray-200'}`} />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters"
                    className={`w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.password ? 'border-red-300' : 'border-gray-200'}`} />
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
                    className={`w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'}`} />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* File uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* ID Card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">College ID Card * <span className="text-gray-400 font-normal">(image/PDF, max 5MB)</span></label>
                <input ref={idCardRef} type="file" accept="image/*,.pdf" onChange={handleIdCard} className="hidden" />
                <button type="button" onClick={() => idCardRef.current.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition hover:border-indigo-400 hover:bg-indigo-50 ${errors.idCard ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  {idCardPreview ? (
                    <div className="space-y-2">
                      {idCard?.type === 'application/pdf' ? (
                        <div className="text-indigo-600 text-sm font-medium">📄 {idCard.name}</div>
                      ) : (
                        <img src={idCardPreview} alt="ID Card" className="w-full h-24 object-cover rounded-lg" />
                      )}
                      <p className="text-xs text-gray-500">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload size={20} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500">Click to upload ID card</p>
                    </div>
                  )}
                </button>
                {errors.idCard && <p className="text-red-500 text-xs mt-1">{errors.idCard}</p>}
              </div>

              {/* Profile Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Photo * <span className="text-gray-400 font-normal">(image only, max 2MB)</span></label>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                <button type="button" onClick={() => photoRef.current.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition hover:border-indigo-400 hover:bg-indigo-50 ${errors.photo ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  {profilePreview ? (
                    <div className="space-y-2">
                      <img src={profilePreview} alt="Profile" className="w-16 h-16 object-cover rounded-full mx-auto border-2 border-indigo-200" />
                      <p className="text-xs text-gray-500">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload size={20} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500">Click to upload photo</p>
                    </div>
                  )}
                </button>
                {errors.photo && <p className="text-red-500 text-xs mt-1">{errors.photo}</p>}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting registration…</>
              ) : 'Submit for Admin Review →'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-500 mb-4">
            Already have an account?{' '}
            <Link to="/faculty/login" className="text-indigo-600 font-semibold hover:underline">Login here</Link>
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
            <Link to="/student/register" className="hover:text-gray-600 transition">Student Registration</Link>
            <span>•</span>
            <Link to="/invigilator-login" className="hover:text-gray-600 transition">Invigilator access →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
