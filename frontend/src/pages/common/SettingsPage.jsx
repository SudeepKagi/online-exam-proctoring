import React, { useState } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage } from '@/lib/apiClient'
import { CheckCircle2, ShieldCheck, KeyRound, User, Loader2, Save, FileText, Camera } from 'lucide-react'

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const isStudent = user?.role === 'STUDENT'
  const meta = (user?.profileMetadata && typeof user?.profileMetadata === 'object') ? user?.profileMetadata : {}

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: meta.phone || '',
    department: meta.department || user?.department || '',
    semester: meta.semester || '',
    designation: meta.designation || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: '' })

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setMsg({ text: 'New passwords do not match.', type: 'error' })
      setSaving(false)
      return
    }

    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        department: form.department,
        semester: form.semester,
        designation: form.designation,
      }
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword
        payload.newPassword = form.newPassword
      }

      const res = await api.put('/auth/settings', payload)
      if (res.data?.user) {
        updateUser(res.data.user)
      }
      setMsg({ text: 'Profile & account settings saved successfully.', type: 'success' })
      setForm(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to update settings'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell title="Account & Identity Settings">
      <div className="max-w-4xl space-y-6 font-sans">
        {msg.text && (
          <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
            {msg.text}
          </div>
        )}

        {/* Identity & Verification Status Card */}
        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden">
          <CardHeader className="bg-[#fbfbff] border-b border-[#e9eaf2] pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-[480] text-[#28253b] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#5266eb]" />
                  Institutional Identity Verification
                </CardTitle>
                <CardDescription className="text-xs font-[360] text-[#554e7b]">
                  Government & College ID biometrics verified by administration.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-[#edecfb] text-[#554e7b] border-0 text-xs font-[420]">
                {user?.status || 'ACTIVE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#fbfbff] border border-[#e9eaf2] rounded-[12px] space-y-1">
              <span className="text-[#554e7b] block text-[10px] font-[500] uppercase tracking-[0.28px]">Account Role</span>
              <span className="font-[480] text-[#28253b]">{user?.role}</span>
            </div>
            <div className="p-3 bg-[#fbfbff] border border-[#e9eaf2] rounded-[12px] space-y-1">
              <span className="text-[#554e7b] block text-[10px] font-[500] uppercase tracking-[0.28px]">{isStudent ? 'Roll No / USN' : 'Employee ID'}</span>
              <span className="font-mono font-[480] text-[#5266eb]">{user?.institutionId || '—'}</span>
            </div>
            <div className="p-3 bg-[#fbfbff] border border-[#e9eaf2] rounded-[12px] space-y-1">
              <span className="text-[#554e7b] block text-[10px] font-[500] uppercase tracking-[0.28px]">Registered Email</span>
              <span className="font-mono text-[#28253b] truncate block">{user?.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Profile & Password Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
            <CardHeader className="border-b border-[#e9eaf2] pb-3">
              <CardTitle className="text-sm font-[480] text-[#28253b]">Personal & Academic Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full Name">
                  <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="h-9 text-xs" />
                </FormField>
                <FormField label="Contact Phone">
                  <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="h-9 text-xs" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Department">
                  <Input value={form.department} onChange={(e) => handleChange('department', e.target.value)} className="h-9 text-xs" />
                </FormField>
                {isStudent ? (
                  <FormField label="Semester">
                    <Input value={form.semester} onChange={(e) => handleChange('semester', e.target.value)} className="h-9 text-xs" />
                  </FormField>
                ) : (
                  <FormField label="Designation">
                    <Input value={form.designation} onChange={(e) => handleChange('designation', e.target.value)} className="h-9 text-xs" />
                  </FormField>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
            <CardHeader className="border-b border-[#e9eaf2] pb-3">
              <CardTitle className="text-sm font-[480] text-[#28253b] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#5266eb]" /> Change Security Password
              </CardTitle>
              <CardDescription className="text-xs font-[360] text-[#554e7b]">Leave blank if you do not want to alter your password.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <FormField label="Current Password">
                <PasswordInput value={form.currentPassword} onChange={(e) => handleChange('currentPassword', e.target.value)} placeholder="Enter current password" />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="New Password">
                  <PasswordInput showStrength value={form.newPassword} onChange={(e) => handleChange('newPassword', e.target.value)} placeholder="Min 6 characters" />
                </FormField>
                <FormField label="Confirm New Password">
                  <PasswordInput value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} placeholder="Repeat new password" />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 px-6 rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  )
}
