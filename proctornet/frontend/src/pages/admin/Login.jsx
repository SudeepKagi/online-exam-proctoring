import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please enter both email and password.'); return }
    setLoading(true)
    const result = await login({ email: form.email.trim(), password: form.password }, 'admin')
    setLoading(false)
    if (result.success) navigate('/admin/dashboard')
    else setError(result.error)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-900 via-blue-700 to-blue-600 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute border border-white rounded-full"
              style={{ width: `${(i+1)*120}px`, height: `${(i+1)*120}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl">ProctorNet</span>
        </div>
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">Admin Control<br />Center</h1>
            <p className="text-blue-200 mt-3 text-lg">Manage faculty, students, exams, and platform settings from a unified dashboard.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['Faculty Approvals','Review & approve registrations'],['Exam Oversight','Monitor all active exams'],['Violation Center','Track security events'],['Platform Settings','Configure proctoring rules']].map(([t, d]) => (
              <div key={t} className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{t}</p>
                <p className="text-blue-200 text-xs mt-1">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-blue-300 text-xs">© 2025 ProctorNet — Academic Integrity Platform</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Back Link */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition mb-4">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center lg:hidden">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Login</h2>
                <p className="text-gray-500 text-sm mt-0.5">ProctorNet administration portal</p>
              </div>
            </div>



            {/* Error */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="admin-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="Enter admin email"
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <a href="#" className="text-xs text-blue-600 font-medium hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="admin-password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                ) : 'Login to Dashboard →'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
              <Link to="/student/login" className="hover:text-gray-600 transition">Student Login</Link>
              <span>•</span>
              <Link to="/faculty/login" className="hover:text-gray-600 transition">Faculty Login</Link>
              <span>•</span>
              <Link to="/invigilator-login" className="hover:text-gray-600 transition">Invigilator access →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
