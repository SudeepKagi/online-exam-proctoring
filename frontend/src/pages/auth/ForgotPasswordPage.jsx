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
    <div className="min-h-screen bg-[#171721] text-[#ededf3] flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#5266eb]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Mercury 72px Bar */}
      <div className="w-full max-w-md mx-auto pt-4 flex items-center justify-between z-10 h-[72px]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-sm shadow-xs">P</div>
          <span className="font-[480] text-white text-base tracking-wide">ProctorNet</span>
        </Link>
        <Link to="/login" className="text-xs text-[#c3c3cc] hover:text-[#ededf3] flex items-center gap-1 font-[420] px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
        </Link>
      </div>

      {/* Main Card: Mercury Night-Raised Surface */}
      <div className="w-full max-w-md mx-auto my-auto py-8 z-10">
        <Card className="border-[#28253b] bg-[#1e1e2a] rounded-xl overflow-hidden text-[#ededf3] shadow-xs">
          <CardHeader className="border-b border-[#28253b] pb-4 text-center bg-[#171721]/50">
            <div className="w-12 h-12 rounded-full bg-[#5266eb]/15 border border-[#5266eb]/30 text-[#9cb4e8] flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-[480] text-[#ededf3]">Reset Password</CardTitle>
            <CardDescription className="text-xs text-[#c3c3cc] mt-1 font-[360]">
              {step === 1 ? 'Enter your institutional credentials to receive a reset code' : 'Enter the 6-digit verification code and your new password'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-800 text-xs text-red-300 rounded-xl font-[420] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3.5 bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 rounded-xl font-[420] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {step === 1 && !successMsg && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <FormField label="Institutional Role" required>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#171721] border border-[#28253b] rounded-full">
                    {['STUDENT', 'FACULTY', 'ADMIN', 'INVIGILATOR'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-1.5 text-xs font-[420] rounded-full transition cursor-pointer capitalize ${
                          role === r ? 'bg-[#5266eb] text-white shadow-xs' : 'text-[#c3c3cc] hover:text-[#ededf3]'
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
                    className="h-10 text-xs bg-[#171721] border-[#28253b] text-[#ededf3] rounded-xl placeholder:text-[#70707d]"
                  />
                </FormField>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Request Verification Code <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </form>
            )}

            {step === 2 && !successMsg && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {otpHint && (
                  <div className="p-3 bg-[#5266eb]/10 border border-[#5266eb]/25 rounded-xl text-xs text-[#9cb4e8]">
                    <span className="font-[480]">Evaluation Mode OTP: </span>
                    <span className="font-mono font-bold tracking-widest text-[#ededf3] ml-1">{otpHint}</span>
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
                    className="h-11 text-center font-mono text-base font-bold tracking-widest bg-[#171721] border-[#28253b] text-[#ededf3] rounded-xl"
                  />
                </FormField>

                <FormField label="New Password" required>
                  <PasswordInput
                    showStrength
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-10 text-xs bg-[#171721] border-[#28253b] text-[#ededf3] rounded-xl"
                  />
                </FormField>

                <FormField label="Confirm New Password" required>
                  <PasswordInput
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="h-10 text-xs bg-[#171721] border-[#28253b] text-[#ededf3] rounded-xl"
                  />
                </FormField>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="h-10 px-4 text-xs font-[420] rounded-full border-[#28253b] bg-[#171721] text-[#c3c3cc] hover:text-[#ededf3]"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-10 bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Reset Password & Log In <CheckCircle2 className="w-4 h-4" /></>}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-[#c3c3cc] pb-2 z-10 font-[360]">
        Institutional Identity Protection • ProctorNet Examination Platform
      </div>
    </div>
  )
}
