import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Shield, Lock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, changePassword, role } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      return setError('New password and confirm password do not match.')
    }

    if (newPassword.length < 6) {
      return setError('New password must be at least 6 characters long.')
    }

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      // Redirect user to their respective dashboard
      const targetRole = user?.role || role || 'student'
      navigate(`/${targetRole}/dashboard`)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-white selection:text-black">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm">
            <Shield size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">ProctorNet</span>
        </div>

        <Card className="border-[#27272A] bg-[#141416]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-base font-bold text-white">Action Required: Change Password</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Your account was created by system admin with a temporary password. You must set a new password to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[#27272A] border border-[#3F3F46] text-xs font-mono text-white flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Temporary / Current Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Pnet#1234"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">New Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Confirm New Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-9 text-xs mt-2 font-semibold">
                {loading ? 'Updating Password…' : 'Set New Password & Unlock Account'} <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
