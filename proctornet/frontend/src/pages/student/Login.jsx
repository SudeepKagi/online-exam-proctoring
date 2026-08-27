import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, Lock, User, AlertCircle, Eye, EyeOff, WifiOff, X } from 'lucide-react'
import AuthLayout from '@/components/common/AuthLayout'

export default function StudentLogin() {
  const [usn, setUsn] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorState, setErrorState] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorState(null)

    try {
      const result = await login(usn.trim(), password, 'student')
      if (result && !result.success) {
        const errorMsg = result.error || 'Invalid USN or password. Please check your credentials.'
        const isServer = errorMsg.toLowerCase().includes('server') || errorMsg.toLowerCase().includes('connect')
        const isRestricted = errorMsg.toLowerCase().includes('approval') || errorMsg.toLowerCase().includes('suspended') || errorMsg.toLowerCase().includes('rejected')
        setErrorState({
          type: isServer ? 'server' : isRestricted ? 'forbidden' : 'credentials',
          title: isServer ? 'Server Connection Error' : isRestricted ? 'Access Restricted' : 'Invalid Credentials',
          message: errorMsg
        })
        return
      }
      navigate('/student/dashboard')
    } catch (err) {
      const isServer = !err.response || err.response.status >= 500
      setErrorState({
        type: isServer ? 'server' : 'credentials',
        title: isServer ? 'Server Connection Error' : 'Invalid Credentials',
        message: err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to connect to server.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUsnChange = (e) => {
    setUsn(e.target.value)
    if (errorState) setErrorState(null)
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (errorState) setErrorState(null)
  }

  return (
    <AuthLayout
      role="student"
      title="Login with your USN"
      subtitle="Enter your assigned credentials to access scheduled exams."
      heroHeadline="Student Login"
      heroSubtitle="Sign in to access your proctored examinations and assessments."
      personImage="/login-student.jpg"
      switchRoleLink={{ label: 'Faculty Login', path: '/faculty/login' }}
      registerLink={null}
    >
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
        {errorState && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-3 transition-all ${
              errorState.type === 'server'
                ? 'bg-[#fffbeb] border border-[#fef3c7] text-[#92400e]'
                : 'bg-[#fef2f2] border border-[#fee2e2] text-[#991b1b]'
            }`}
          >
            {errorState.type === 'server' ? (
              <WifiOff size={17} className="text-[#d97706] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={17} className="text-[#ef4444] shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold mb-0.5">{errorState.title}</p>
              <p className="font-normal opacity-90 leading-relaxed">{errorState.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorState(null)}
              className="text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5 transition-opacity"
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#374151]">
            University Seat Number (USN)
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              name="usn"
              value={usn}
              onChange={handleUsnChange}
              placeholder="e.g. 1MS21CS001"
              required
              autoComplete="off"
              autoFocus
              className={`w-full pl-10 pr-4 py-3 bg-[#f8fafc] border rounded-xl text-sm font-normal text-[#18181b] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white transition-colors ${
                errorState?.type === 'credentials'
                  ? 'border-[#fca5a5] focus:border-[#ef4444]'
                  : 'border-[#e5e7eb] focus:border-[#2f80ed]'
              }`}
              aria-label="University Seat Number"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#374151]">
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className={`w-full pl-10 pr-11 py-3 bg-[#f8fafc] border rounded-xl text-sm font-normal text-[#18181b] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white transition-colors ${
                errorState?.type === 'credentials'
                  ? 'border-[#fca5a5] focus:border-[#ef4444]'
                  : 'border-[#e5e7eb] focus:border-[#2f80ed]'
              }`}
              aria-label="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#4b5563] cursor-pointer transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] disabled:opacity-50 text-white font-medium py-3.5 px-6 rounded-xl shadow-[0_4px_12px_rgba(47,128,237,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <span>{loading ? 'Signing In…' : 'Login'}</span>
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthLayout>
  )
}
