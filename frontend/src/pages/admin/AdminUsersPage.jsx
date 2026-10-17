import React, { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { UserPlus, Upload, FileSpreadsheet, Loader2 } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('STUDENT')
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

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/users?limit=200')
      setUsers(ensureArray(res.data?.users || res.data))
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to fetch users'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/users', form)
      setDialogOpen(false)
      setForm({ fullName: '', email: '', institutionId: '', password: '', role: activeTab })
      setMsg({ text: 'User account created successfully.', type: 'success' })
      loadUsers()
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
      loadUsers()
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
      setMsg({ text: `Account status updated for ${user.fullName}.`, type: 'success' })
      loadUsers()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to toggle status'), type: 'error' })
    }
  }

  const filtered = users.filter((u) => u.role === activeTab)

  return (
    <DashboardShell title="User Management">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm text-slate-500">Manage institutional roster, instructors, and invigilator roles.</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Excel Roster
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs" onClick={() => setForm((p) => ({ ...p, role: activeTab }))}>
                <UserPlus className="w-3.5 h-3.5" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email Address</Label>
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@univ.edu" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Institution / USN ID</Label>
                  <Input value={form.institutionId} onChange={(e) => setForm({ ...form, institutionId: e.target.value })} placeholder="1RV21CS001" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Temporary Password</Label>
                  <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Create User
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-lg text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="STUDENT" className="text-xs">Students ({users.filter(u => u.role === 'STUDENT').length})</TabsTrigger>
          <TabsTrigger value="FACULTY" className="text-xs">Faculty ({users.filter(u => u.role === 'FACULTY').length})</TabsTrigger>
          <TabsTrigger value="INVIGILATOR" className="text-xs">Invigilators ({users.filter(u => u.role === 'INVIGILATOR').length})</TabsTrigger>
        </TabsList>

        <Card className="border-slate-200 bg-white mt-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="text-xs font-semibold text-slate-600">Full Name</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Email Address</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Institutional ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-slate-500">Loading accounts...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-slate-500">No {activeTab.toLowerCase()} accounts registered.</TableCell></TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id} className="border-slate-100">
                      <TableCell className="font-medium text-slate-900 text-sm">{user.fullName}</TableCell>
                      <TableCell className="text-slate-600 text-sm font-mono">{user.email}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{user.institutionId || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs' : 'bg-red-50 text-red-700 border-red-200 text-xs'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="toggle-status-btn"
                          onClick={() => handleToggleStatus(user)}
                          className={`h-7 px-2 text-xs font-medium ${user.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                        >
                          {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>
    </DashboardShell>
  )
}
