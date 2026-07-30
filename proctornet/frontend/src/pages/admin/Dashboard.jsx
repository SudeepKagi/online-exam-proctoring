import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Shield, Users, BookOpen, AlertTriangle, ChevronRight, Activity } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ facultyCount: 14, studentCount: 450, examCount: 28, alertCount: 5 })
  const [loading, setLoading] = useState(false)

  return (
    <DashboardLayout title="Admin Console">
      <div className="flex flex-col gap-5 py-2">
        {/* Banner */}
        <div className="px-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 font-sans">System Administration</h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">System overview, user management, and security logs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="default" onClick={() => navigate('/admin/faculty')}>
              Manage Faculty
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/students')}>
              Manage Students
            </Button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 lg:px-6">
          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Total Faculty</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{stats.facultyCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Registered faculty members</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Total Students</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{stats.studentCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Enrolled candidates</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Total Exams</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{stats.examCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Total system exams</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Security Alerts</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{stats.alertCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Active flag incidents</CardContent>
          </Card>
        </div>

        {/* System Activity Table */}
        <div className="px-4 lg:px-6">
          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-3 border-b border-[#27272A] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">System Activity Log</CardTitle>
                <CardDescription className="text-xs text-slate-400 font-mono">Recent administrative and user actions.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/admin/audit-logs')}>
                View Logs <ChevronRight size={12} className="ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#27272A] bg-[#09090B]">
                    <TableHead className="text-xs text-slate-400">Timestamp</TableHead>
                    <TableHead className="text-xs text-slate-400">User / Actor</TableHead>
                    <TableHead className="text-xs text-slate-400">Action Performed</TableHead>
                    <TableHead className="text-xs text-slate-400">Status</TableHead>
                    <TableHead className="text-xs text-right text-slate-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { time: '10:42 AM', user: 'Admin User', action: 'Created new exam environment', status: 'SUCCESS' },
                    { time: '10:15 AM', user: 'Dr. Ramesh Kumar', action: 'Published CS301 Endsem Exam', status: 'SUCCESS' },
                    { time: '09:50 AM', user: 'System Proctor', action: 'Resolved camera alert for candidate 1NT23EC158', status: 'RESOLVED' },
                  ].map((log, idx) => (
                    <TableRow key={idx} className="border-b border-[#27272A]/60 hover:bg-[#18181A]">
                      <TableCell className="text-xs text-slate-400 font-mono">{log.time}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-100">{log.user}</TableCell>
                      <TableCell className="text-xs text-slate-300 font-mono">{log.action}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="font-mono text-[10px]">{log.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-7 text-[11px]">
                          View Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
