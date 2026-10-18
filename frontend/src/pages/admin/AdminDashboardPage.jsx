import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ensureArray } from '@/lib/apiClient'
import { Users, BookOpen, ShieldAlert, Award, ArrowRight, ShieldCheck, CheckCircle2, Activity } from 'lucide-react'

export default function AdminDashboardPage() {
  const [exams, setExams] = useState([])
  const [users, setUsers] = useState([])
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const [examsRes, usersRes, approvalsRes] = await Promise.allSettled([
          api.get('/exams'),
          api.get('/users?limit=100'),
          api.get('/users/admin/approvals')
        ])
        if (!mounted) return
        if (examsRes.status === 'fulfilled') setExams(ensureArray(examsRes.value.data?.exams || examsRes.value.data))
        if (usersRes.status === 'fulfilled') setUsers(ensureArray(usersRes.value.data?.users || usersRes.value.data))
        if (approvalsRes.status === 'fulfilled') setApprovals(ensureArray(approvalsRes.value.data?.users || approvalsRes.value.data))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const totalStudents = users.filter(u => u.role === 'STUDENT').length
  const verifiedFaculty = users.filter(u => u.role === 'FACULTY' && u.status === 'ACTIVE').length
  const activeExams = exams.filter(e => e.status === 'ACTIVE' || e.status === 'PUBLISHED')
  const recentUsers = users.slice(0, 6)

  return (
    <DashboardShell title="Administrative Overview">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Total Students</CardTitle>
            <Users className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{totalStudents}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Enrolled candidate accounts</p>
          </CardContent>
        </Card>

        <Card className="border-[#fde68a] bg-[#fffbeb]/50 shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#b45309] uppercase tracking-[0.28px]">Pending ID Approvals</CardTitle>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-amber-900">{approvals.length}</div>
            <Link to="/admin/users" className="text-xs font-[420] text-[#5266eb] hover:underline flex items-center gap-1 mt-1">
              Review Queue <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Verified Faculty</CardTitle>
            <Award className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{verifiedFaculty}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Authorized test authors</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Active / Published Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{activeExams.length}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">{exams.length} Total Cohorts</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Status */}
      <div className="p-4 bg-[#ecfdf5]/80 border border-[#bbf7d0] rounded-[12px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-sans">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-[480] text-emerald-950">Institutional Examination Pipeline Operational</span>
          <span className="text-emerald-700 hidden md:inline font-[360]">• Cloud Verification Engine, Encrypted Storage & Realtime Cluster</span>
        </div>
        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-[420]">
          100% HEALTHY
        </Badge>
      </div>

      {/* Recent Onboarding Activity */}
      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden mt-6 font-sans">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-[#fbfbff] border-b border-[#e9eaf2]">
          <div>
            <CardTitle className="text-xs font-[480] text-[#28253b]">Recent Onboarding Activity</CardTitle>
            <p className="text-[11px] text-[#70707d] font-[360] mt-0.5">Latest provisioned and verified candidate accounts</p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1 text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent">
            <Link to="/admin/users">
              View All Users <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Institutional ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Onboarding Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d] font-[360]">Loading activity...</TableCell></TableRow>
              ) : recentUsers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d] font-[360]">No recent accounts recorded.</TableCell></TableRow>
              ) : (
                recentUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-[480] text-[#28253b] text-xs">{u.fullName}</div>
                      <div className="text-[11px] font-mono text-[#70707d]">{u.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-[480] text-[#5266eb]">{u.institutionId || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.role === 'STUDENT' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent text-[10px]' : 'bg-[#edecfb] text-[#554e7b] border-transparent text-[10px]'}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]' :
                        u.status === 'PENDING_APPROVAL' ? 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] text-[10px]' :
                        'bg-[#fbfbff] text-[#70707d] border-[#e9eaf2] text-[10px]'
                      }>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.status === 'PENDING_APPROVAL' ? (
                        <Button size="sm" asChild className="h-7 text-xs bg-[#5266eb] hover:bg-[#4353c7] text-white rounded-[32px] px-3 font-[420]">
                          <Link to="/admin/users">Verify</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-[#70707d] font-[360]">Ready</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
