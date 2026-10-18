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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Total Students</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalStudents}</div>
            <p className="text-xs text-slate-500 mt-1">Enrolled candidate accounts</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-amber-700 uppercase">Pending ID Approvals</CardTitle>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-900">{approvals.length}</div>
            <Link to="/admin/users" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mt-1">
              Review Queue <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Verified Faculty</CardTitle>
            <Award className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{verifiedFaculty}</div>
            <p className="text-xs text-slate-500 mt-1">Authorized test authors</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Active / Published Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{activeExams.length}</div>
            <p className="text-xs text-slate-500 mt-1">{exams.length} Total Cohorts</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Status */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-emerald-900">Institutional Examination Pipeline Operational</span>
          <span className="text-emerald-700 hidden md:inline">• AWS Rekognition Engine, S3 Evidence Storage & Redis Socket.IO Clustered</span>
        </div>
        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-bold">
          100% HEALTHY
        </Badge>
      </div>

      {/* Recent Onboarding Activity */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-slate-50/50 border-b border-slate-100">
          <div>
            <CardTitle className="text-xs font-bold text-slate-900">Recent Onboarding Activity</CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">Latest provisioned and verified candidate accounts</p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1 text-xs rounded-xl">
            <Link to="/admin/users">
              View All Users <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/70">
                <TableHead className="text-xs font-semibold">Candidate</TableHead>
                <TableHead className="text-xs font-semibold">Institutional ID</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                <TableHead className="text-xs font-semibold">Onboarding Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">Loading activity...</TableCell></TableRow>
              ) : recentUsers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">No recent accounts recorded.</TableCell></TableRow>
              ) : (
                recentUsers.map((u) => (
                  <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50/60">
                    <TableCell>
                      <div className="font-bold text-slate-900 text-xs">{u.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{u.institutionId || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.role === 'STUDENT' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]' : 'bg-purple-50 text-purple-700 border-purple-200 text-[10px]'}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]' :
                        u.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]' :
                        'bg-slate-100 text-slate-700 border-slate-200 text-[10px]'
                      }>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.status === 'PENDING_APPROVAL' ? (
                        <Button size="sm" asChild className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                          <Link to="/admin/users">Verify</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Ready</span>
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
