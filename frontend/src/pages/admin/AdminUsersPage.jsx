import React, { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import AdminApprovalsTab from '@/components/admin/AdminApprovalsTab'
import UserTable from '@/components/admin/UserTable'
import { UserPlus, Upload, Loader2, ShieldAlert } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [approvalsCount, setApprovalsCount] = useState(0)
  const [activeTab, setActiveTab] = useState('APPROVALS')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xs text-slate-500">Provision candidate accounts, upload class rosters, and verify onboarding biometrics.</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs rounded-xl">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Excel Roster
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs rounded-xl">
                <UserPlus className="w-3.5 h-3.5" /> Provision Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md font-sans">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Provision New User Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Account Role</Label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-9 text-xs border border-slate-300 rounded-lg px-2 bg-white"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="FACULTY">Faculty</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Full Name</Label>
                  <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Alex Rivera" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Email Address</Label>
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alex@univ.edu" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">USN / Employee ID</Label>
                  <Input value={form.institutionId} onChange={(e) => setForm({ ...form, institutionId: e.target.value })} placeholder="1RV21CS042" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Temporary Password</Label>
                  <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temp@123" className="h-9 text-xs" />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-10 rounded-xl mt-2">
                  Create Provisioned Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl">
          <TabsTrigger value="APPROVALS" className="text-xs flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            Pending Approvals
            {approvalsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                {approvalsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="STUDENT" className="text-xs font-semibold">Students ({users.filter(u => u.role === 'STUDENT').length})</TabsTrigger>
          <TabsTrigger value="FACULTY" className="text-xs font-semibold">Faculty ({users.filter(u => u.role === 'FACULTY').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="APPROVALS" className="mt-4">
          <AdminApprovalsTab onStatusUpdate={(text) => { setMsg({ text, type: 'success' }); loadData() }} />
        </TabsContent>

        <TabsContent value="STUDENT" className="mt-4">
          <UserTable users={filtered} loading={loading} onToggle={handleToggleStatus} />
        </TabsContent>

        <TabsContent value="FACULTY" className="mt-4">
          <UserTable users={filtered} loading={loading} onToggle={handleToggleStatus} />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
