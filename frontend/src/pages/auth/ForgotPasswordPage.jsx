import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
import { api, errorMessage } from '@/lib/apiClient'
import { ShieldCheck, ArrowRight, ArrowLeft, KeyRound, CheckCircle2, AlertCircle, RefreshCw, Mail, Lock } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('STUDENT')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpHint, setOtpHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) {
      setError('Please enter your registered Email or USN/Employee ID.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/forgot-password', {
        identifier: identifier.trim(),
        role
      })
      if (res.data?.resetOtpPreview) {
        setOtpHint(res.data.resetOtpPreview)
        setOtp(res.data.resetOtpPreview)
      }
      setStep(2)
    } catch (err) {
      setError(errorMessage(err, 'Failed to request password reset code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword
      })
      setSuccessMsg('Your password has been reset successfully! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2200)
    } catch (err) {
      setError(errorMessage(err, 'Failed to reset password. Please verify the code and retry.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-md mx-auto pt-4 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">P</div>
          <span className="font-extrabold text-white text-base tracking-tight">ProctorNet</span>
        </Link>
        <Link to="/login" className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8 z-10">
        <Card className="border-slate-800 bg-slate-950/85 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden text-slate-100">
          <CardHeader className="border-b border-slate-800/80 pb-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-black text-white">Reset Password</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              {step === 1 ? 'Enter your institutional credentials to receive a reset code' : 'Enter the 6-digit verification code and your new password'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 text-xs text-red-300 rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 rounded-xl font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {step === 1 && !successMsg && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <FormField label="Institutional Role" required>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    {['STUDENT', 'FACULTY', 'ADMIN', 'INVIGILATOR'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer capitalize ${
                          role === r ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {r.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label={role === 'STUDENT' ? 'Student USN or Email' : role === 'FACULTY' ? 'Employee ID or Email' : 'Email Address'} required hint="The identifier linked to your ProctorNet account">
                  <Input
                    required
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={role === 'STUDENT' ? 'e.g., 1BM22CS104 or student@univ.edu' : 'e.g., staff@univ.edu'}
                    className="h-10 text-xs bg-slate-900 border-slate-800 text-white rounded-xl placeholder:text-slate-500"
                  />
                </FormField>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Request Verification Code <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </form>
            )}

            {step === 2 && !successMsg && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {otpHint && (
                  <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs text-blue-300">
                    <span className="font-bold">Evaluation Mode OTP: </span>
                    <span className="font-mono font-bold tracking-widest text-white ml-1">{otpHint}</span>
                  </div>
                )}

                <FormField label="6-Digit Verification Code" required hint="Valid for 15 minutes">
                  <Input
                    required
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="h-11 text-center font-mono text-base font-bold tracking-widest bg-slate-900 border-slate-800 text-white rounded-xl"
                  />
                </FormField>

                <FormField label="New Password" required>
                  <PasswordInput
                    showStrength
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-10 text-xs bg-slate-900 border-slate-800 text-white rounded-xl"
                  />
                </FormField>

                <FormField label="Confirm New Password" required>
                  <PasswordInput
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="h-10 text-xs bg-slate-900 border-slate-800 text-white rounded-xl"
                  />
                </FormField>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="h-11 px-4 text-xs font-semibold rounded-xl border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Reset Password & Log In <CheckCircle2 className="w-4 h-4" /></>}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-slate-500 pb-2 z-10">
        Institutional Identity Protection • ProctorNet Examination Platform
      </div>
    </div>
  )
}
