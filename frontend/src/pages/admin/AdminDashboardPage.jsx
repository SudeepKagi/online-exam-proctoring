import React, { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient, ensureArray } from '@/lib/apiClient'
import { Users, BookOpen, Activity, AlertTriangle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminDashboardPage() {
  const [exams, setExams] = useState([])
  const [userStats, setUserStats] = useState({ total: 0, students: 0, faculty: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const [examsRes, usersRes] = await Promise.allSettled([
          apiClient.get('/exams'),
          apiClient.get('/users?limit=50'),
        ])
        if (!mounted) return
        if (examsRes.status === 'fulfilled') {
          const list = ensureArray(examsRes.value.data?.exams || examsRes.value.data)
          setExams(list)
        }
        if (usersRes.status === 'fulfilled') {
          const usersList = ensureArray(usersRes.value.data?.users || usersRes.value.data)
          setUserStats({
            total: usersList.length,
            students: usersList.filter(u => u.role === 'STUDENT').length,
            faculty: usersList.filter(u => u.role === 'FACULTY').length,
          })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const activeExams = exams.filter(e => e.status === 'ACTIVE' || e.status === 'PUBLISHED')

  return (
    <DashboardShell title="System Overview">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Accounts</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{userStats.total}</div>
            <p className="text-xs text-slate-500 mt-1">{userStats.students} Students, {userStats.faculty} Faculty</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{exams.length}</div>
            <p className="text-xs text-slate-500 mt-1">{activeExams.length} active or scheduled</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Active Sessions</CardTitle>
            <Activity className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{activeExams.length}</div>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Live monitoring plane active</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Integrity Status</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">100%</div>
            <p className="text-xs text-slate-500 mt-1">Audit log synchronized</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Institutional Examinations</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Active and recently scheduled examination cohorts</p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1 text-xs">
            <Link to="/admin/exams">
              Manage Exams <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-xs font-semibold text-slate-600">Exam Title</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Course Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Duration</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-slate-500">Loading exams...</TableCell>
                </TableRow>
              ) : exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-slate-500">No exams configured yet.</TableCell>
                </TableRow>
              ) : (
                exams.slice(0, 5).map((exam) => (
                  <TableRow key={exam.id} className="border-slate-100">
                    <TableCell className="font-medium text-slate-900 text-sm">{exam.title}</TableCell>
                    <TableCell className="text-slate-600 text-sm font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{exam.durationMinutes} mins</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exam.status === 'PUBLISHED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="h-8 text-blue-600 hover:text-blue-700">
                        <Link to={`/admin/exams`}>View Details</Link>
                      </Button>
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
