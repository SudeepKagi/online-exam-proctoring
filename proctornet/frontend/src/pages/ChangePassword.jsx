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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-150">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Shield size={18} />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">ProctorNet</span>
        </div>

        <Card className="shadow-[0_4px_8px_-2px_rgba(16,24,40,0.08),0_2px_4px_-2px_rgba(16,24,40,0.04)]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg font-bold text-foreground">Action Required: Change Password</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Your account was created with a temporary password. You must set a new password to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#b91c1c] flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Temporary / Current Password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Pnet#1234"
                    required
                    className="pl-10 text-xs"
                    aria-label="Current password"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">New Password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="pl-10 text-xs"
                    aria-label="New password"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Confirm New Password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="pl-10 text-xs"
                    aria-label="Confirm new password"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 text-xs mt-2 font-bold">
                {loading ? 'Updating Password…' : 'Set New Password & Unlock Account'} <ArrowRight size={15} className="ml-1.5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
