import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Hash, Lock, AlertCircle, Eye, EyeOff, Key, ArrowLeft } from 'lucide-react'
import api from '@/utils/api'

export default function InvigilatorLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ examId: '', invId: '', invPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.examId || !form.invId || !form.invPassword) { setError('All fields are required.'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/invigilator/login', {
        examId: form.examId.trim(),
        invId: form.invId.trim(),
        invPassword: form.invPassword
      })
      const { token, session } = res.data
      localStorage.setItem('inv_token', token)
      localStorage.setItem('inv_examId', session.examId)
      localStorage.setItem('inv_session', JSON.stringify(session))
      navigate(`/invigilator/exam/${session.examId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition mb-6">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ProctorNet</h1>
          <p className="text-gray-400 text-sm mt-1">Invigilator Access Portal</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-1">Invigilator Login</h2>
          <p className="text-gray-400 text-sm mb-6">Temporary session — valid for exam duration only.</p>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-900/30 border border-red-700/50 text-red-400 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Exam ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Exam ID</label>
              <div className="relative">
                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.examId} onChange={set('examId')} placeholder="Enter exam ID" autoComplete="off"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
            </div>

            {/* Invigilator ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Invigilator ID</label>
              <div className="relative">
                <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.invId} onChange={set('invId')} placeholder="Enter invigilator ID" autoComplete="off"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPw ? 'text' : 'password'} value={form.invPassword} onChange={set('invPassword')} placeholder="••••••••" autoComplete="new-password"
                  className="w-full pl-9 pr-9 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-4">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</>
              ) : 'Access Exam Dashboard →'}
            </button>
          </form>

          {/* Quick-switch anchors */}
          <div className="mt-6 pt-5 border-t border-gray-700 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <Link to="/student/login" className="hover:text-white transition">Student Login</Link>
            <span>•</span>
            <Link to="/faculty/login" className="hover:text-white transition">Faculty Login</Link>
            <span>•</span>
            <Link to="/admin/login" className="hover:text-white transition">Admin Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

