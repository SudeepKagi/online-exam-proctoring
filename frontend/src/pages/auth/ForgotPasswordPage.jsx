import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
import { api, errorMessage } from '@/lib/apiClient'
import { ArrowRight, ArrowLeft, KeyRound, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

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
      setSuccessMsg('Your password has been reset successfully! Redirecting to sign in...')
      setTimeout(() => navigate('/login'), 2200)
    } catch (err) {
      setError(errorMessage(err, 'Failed to reset password. Please verify the code and retry.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Subtle Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#5266eb]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-md mx-auto pt-4 flex items-center justify-between z-10 h-[72px]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-sm shadow-xs">P</div>
          <span className="font-[480] text-[#28253b] text-base tracking-wide">ProctorNet</span>
        </Link>
        <Link to="/login" className="text-xs text-[#554e7b] hover:text-[#28253b] flex items-center gap-1 font-[420] px-3.5 py-1.5 rounded-full bg-white border border-[#e9eaf2] shadow-xs transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8 z-10">
        <Card className="border-[#e9eaf2] bg-white rounded-xl overflow-hidden text-[#28253b] shadow-[0_4px_24px_rgba(40,37,59,0.06)]">
          <CardHeader className="border-b border-[#e9eaf2] pb-4 text-center bg-[#fbfbff]">
            <div className="w-12 h-12 rounded-full bg-[#edecfb] border border-[#5266eb]/20 text-[#5266eb] flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-[480] text-[#28253b]">Reset Password</CardTitle>
            <CardDescription className="text-xs text-[#554e7b] mt-1 font-[360]">
              {step === 1 ? 'Enter your institutional credentials to receive a reset code' : 'Enter the 6-digit verification code and your new password'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-[420] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl font-[420] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {step === 1 && !successMsg && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <FormField label="Institutional Role" required>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-white border border-[#e9eaf2] rounded-full shadow-xs">
                    {['STUDENT', 'FACULTY', 'ADMIN', 'INVIGILATOR'].map((r) => ( // terms-ok: internal role check
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-1.5 text-xs font-[420] rounded-full transition cursor-pointer capitalize ${
                          role === r ? 'bg-[#5266eb] text-white shadow-xs' : 'text-[#554e7b] hover:text-[#28253b]'
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
                    className="h-10 text-xs bg-white border-[#c3c3cc]/70 focus:border-[#5266eb] text-[#28253b] rounded-xl placeholder:text-[#70707d]"
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
                  <div className="p-3 bg-[#edecfb] border border-[#5266eb]/20 rounded-xl text-xs text-[#5266eb]">
                    <span className="font-[480]">Evaluation Mode OTP: </span>
                    <span className="font-mono font-bold tracking-widest text-[#28253b] ml-1">{otpHint}</span>
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
                    className="h-11 text-center font-mono text-base font-bold tracking-widest bg-white border-[#c3c3cc]/70 focus:border-[#5266eb] text-[#28253b] rounded-xl"
                  />
                </FormField>

                <FormField label="New Password" required>
                  <PasswordInput
                    showStrength
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-10 text-xs bg-white border-[#c3c3cc]/70 focus:border-[#5266eb] text-[#28253b] rounded-xl"
                  />
                </FormField>

                <FormField label="Confirm New Password" required>
                  <PasswordInput
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="h-10 text-xs bg-white border-[#c3c3cc]/70 focus:border-[#5266eb] text-[#28253b] rounded-xl"
                  />
                </FormField>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="h-10 px-4 text-xs font-[420] rounded-full border-[#e9eaf2] bg-white text-[#554e7b] hover:text-[#28253b]"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-10 bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Reset Password & Sign In <CheckCircle2 className="w-4 h-4" /></>}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-[#554e7b] pb-2 z-10 font-[360]">
        Institutional Identity Protection • ProctorNet Examination Platform
      </div>
    </div>
  )
}
