import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Shield, Hash, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function StudentLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ usn: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.usn || !form.password) { setError('Please enter your USN and password.'); return }
    setLoading(true)
    const result = await login({ usn: form.usn.trim().toUpperCase(), password: form.password }, 'student')
    setLoading(false)
    if (result.success) navigate('/student/dashboard')
    else setError(result.error)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute border border-white rounded-full"
              style={{ width: `${(i+1)*140}px`, height: `${(i+1)*140}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
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
            <h1 className="text-4xl font-bold text-white leading-tight">Secure Exam<br />Environment</h1>
            <p className="text-emerald-200 mt-3 text-lg">Take your exams in a fully proctored, secure environment with real-time monitoring.</p>
          </div>
          <div className="space-y-3">
            {[['🔒 VPN Protection','Your internet is locked to exam-only during the session'],['📷 Face Verification','Continuous identity check throughout the exam'],['🛡️ Anti-Cheat System','Advanced violation detection and flagging'],['⚡ Auto-Save','Your answers are saved every 60 seconds automatically']].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-xl p-3.5">
                <span className="text-lg">{title.split(' ')[0]}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{title.split(' ').slice(1).join(' ')}</p>
                  <p className="text-emerald-200 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-emerald-300 text-xs">© 2025 ProctorNet — Academic Integrity Platform</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {/* Role switch */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
              <Link to="/faculty/login" className="flex-1 py-2 text-sm font-medium text-gray-500 text-center rounded-lg hover:text-gray-700 transition">Faculty</Link>
              <button className="flex-1 py-2 text-sm font-semibold bg-white rounded-lg shadow-sm text-emerald-600">Student</button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Student Login</h2>
              <p className="text-gray-500 text-sm mt-0.5">Sign in with your university USN</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">University Serial Number (USN)</label>
                <div className="relative">
                  <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="student-usn"
                    type="text"
                    value={form.usn}
                    onChange={set('usn')}
                    placeholder="1NM21CS001"
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 transition uppercase"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <a href="#" className="text-xs text-emerald-600 font-medium hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="student-password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 transition"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                ) : 'Login to Dashboard →'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-gray-500">
              New student?{' '}
              <Link to="/student/register" className="text-emerald-600 font-semibold hover:underline">Register here</Link>
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <Link to="/invigilator-login" className="text-xs text-gray-400 hover:text-gray-600 transition">
                Invigilator access →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
