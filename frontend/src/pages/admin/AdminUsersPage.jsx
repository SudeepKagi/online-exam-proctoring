import React, { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import AdminApprovalsTab from '@/components/admin/AdminApprovalsTab'
import UserTable from '@/components/admin/UserTable'
import UserVerificationModal from '@/components/admin/UserVerificationModal'
import { UserPlus, Upload, Loader2, ShieldAlert } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [approvalsCount, setApprovalsCount] = useState(0)
  const [activeTab, setActiveTab] = useState('APPROVALS')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [verificationUser, setVerificationUser] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    institutionId: '',
    password: '',
    role: 'STUDENT',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, approvalsRes] = await Promise.all([
        apiClient.get('/users?limit=300'),
        apiClient.get('/users/admin/approvals').catch(() => ({ data: [] }))
      ])
      const userList = ensureArray(usersRes.data?.users || usersRes.data)
      const pendingList = ensureArray(approvalsRes.data?.users || approvalsRes.data?.pendingUsers || approvalsRes.data)
      setUsers(userList)
      setApprovalsCount(pendingList.length)
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to fetch users'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/users', form)
      setDialogOpen(false)
      setForm({ fullName: '', email: '', institutionId: '', password: '', role: 'STUDENT' })
      setMsg({ text: 'User account created with PENDING_SETUP status.', type: 'success' })
      loadData()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Creation failed'), type: 'error' })
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg({ text: '', type: '' })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post('/users/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMsg({ text: `Imported ${res.data?.importedCount || 0} user(s) successfully.`, type: 'success' })
      loadData()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Excel import failed'), type: 'error' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleToggleStatus = async (user) => {
    try {
      const endpoint = user.status === 'ACTIVE' ? `/users/${user.id}/suspend` : `/users/${user.id}/unsuspend`
      await apiClient.patch(endpoint)
      setMsg({ text: `Status updated for ${user.fullName}.`, type: 'success' })
      loadData()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to update status'), type: 'error' })
    }
  }

  const filtered = users.filter((u) => u.role === activeTab)

  return (
    <DashboardShell title="User Management & Approvals">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
        <div>
          <h2 className="text-xs text-[#70707d] font-[360]">Provision candidate accounts, upload rosters, and inspect onboarding biometrics.</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs font-[420] rounded-[40px] px-3.5 h-9 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent cursor-pointer">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Excel Roster
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-4 h-9 shadow-xs cursor-pointer">
                <UserPlus className="w-3.5 h-3.5" /> Provision Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md font-sans">
              <DialogHeader>
                <DialogTitle className="text-base font-[480] text-[#28253b]">Provision New User Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <FormField label="Account Role" required>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-10 text-xs text-[#28253b] font-[420] border border-[#c3c3cc]/60 rounded-xl px-3 bg-white outline-none focus:border-[#5266eb]"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="FACULTY">Faculty</option>
                  </select>
                </FormField>
                <FormField label="Full Name" required>
                  <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Alex Rivera" className="h-9 text-xs" />
                </FormField>
                <FormField label="Email Address" required>
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alex@univ.edu" className="h-9 text-xs" />
                </FormField>
                <FormField label="USN / Employee ID" hint="Registration or Staff ID">
                  <Input value={form.institutionId} onChange={(e) => setForm({ ...form, institutionId: e.target.value })} placeholder="1RV21CS042" className="h-9 text-xs font-mono uppercase" />
                </FormField>
                <FormField label="Temporary Password" required>
                  <PasswordInput showStrength required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temp@123" />
                </FormField>
                <Button type="submit" className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] mt-2 cursor-pointer">
                  Create Provisioned Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-[12px] text-xs font-[420] ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full font-sans">
        <TabsList>
          <TabsTrigger value="APPROVALS" className="text-xs flex items-center gap-1.5 cursor-pointer">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            Pending Approvals
            {approvalsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                {approvalsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="STUDENT" className="cursor-pointer">Students ({users.filter(u => u.role === 'STUDENT').length})</TabsTrigger>
          <TabsTrigger value="FACULTY" className="cursor-pointer">Faculty ({users.filter(u => u.role === 'FACULTY').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="APPROVALS" className="mt-4">
          <AdminApprovalsTab onStatusUpdate={(text) => { setMsg({ text, type: 'success' }); loadData() }} />
        </TabsContent>

        <TabsContent value="STUDENT" className="mt-4">
          <UserTable users={filtered} loading={loading} onToggle={handleToggleStatus} onVerify={setVerificationUser} />
        </TabsContent>

        <TabsContent value="FACULTY" className="mt-4">
          <UserTable users={filtered} loading={loading} onToggle={handleToggleStatus} onVerify={setVerificationUser} />
        </TabsContent>
      </Tabs>

      <UserVerificationModal
        user={verificationUser}
        open={Boolean(verificationUser)}
        onOpenChange={(open) => !open && setVerificationUser(null)}
        onSuccess={(text) => { setMsg({ text, type: 'success' }); loadData() }}
      />
    </DashboardShell>
  )
}
