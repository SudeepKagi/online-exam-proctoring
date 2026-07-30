import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { Plus, BookOpen, Users, BarChart2, ChevronRight, User, Mail, Phone, Building, Briefcase, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function FacultyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/faculty/exams')
      .then(r => setExams(r.data.exams || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const activeExams = exams.filter(e => e.status === 'ACTIVE' || e.status === 'PUBLISHED')

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-5 py-2">
        {/* Header Banner */}
        <div className="px-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100 font-sans">Faculty Overview</h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">Manage your exams, student results, and question pools.</p>
          </div>
          <Button variant="default" onClick={() => navigate('/faculty/exams/create')}>
            <Plus size={14} className="mr-1.5" /> Create New Exam
          </Button>
        </div>

        {/* Faculty Personal Info Card */}
        <div className="px-4 lg:px-6">
          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-3 border-b border-[#27272A] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Personal & Professional Profile
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">Institutional instructor credentials and department assignment.</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                <CheckCircle2 size={12} className="mr-1" /> FACULTY INSTRUCTOR
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" /> Full Name
                </span>
                <p className="font-semibold text-slate-100 mt-1">{user?.name || 'Dr. John Smith'}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Briefcase size={12} className="text-slate-400" /> Employee ID
                </span>
                <p className="font-semibold font-mono text-slate-100 mt-1">{user?.employeeId || 'EMP101'}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400" /> Institutional Email
                </span>
                <p className="font-semibold text-slate-100 truncate mt-1">{user?.email || 'john.smith@college.edu'}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building size={12} className="text-slate-400" /> Department & Contact
                </span>
                <p className="font-semibold text-slate-100 mt-1">{user?.department || 'CSE'} • {user?.phone || '9988776655'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 lg:px-6">
          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Total Exams</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{exams.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Created assessments</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Active Exams</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">{activeExams.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Currently in progress</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Registered Students</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">120</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Assigned candidates</CardContent>
          </Card>

          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Average Class Score</CardDescription>
              <CardTitle className="text-3xl font-bold font-mono text-white mt-1">78%</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] font-mono text-slate-400">Evaluated overall score</CardContent>
          </Card>
        </div>

        {/* Exams Table */}
        <div className="px-4 lg:px-6">
          <Card className="border-[#27272A] bg-[#141416]">
            <CardHeader className="pb-3 border-b border-[#27272A] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">My Exam Roster</CardTitle>
                <CardDescription className="text-xs text-slate-400">Recent exams created for your department.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/faculty/exams')}>
                View All <ChevronRight size={12} className="ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">Loading exams…</div>
              ) : exams.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">No exams created yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#27272A] bg-[#09090B]">
                      <TableHead className="text-xs text-slate-400">Exam Title</TableHead>
                      <TableHead className="text-xs text-slate-400">Subject</TableHead>
                      <TableHead className="text-xs text-slate-400">Duration</TableHead>
                      <TableHead className="text-xs text-slate-400">Status</TableHead>
                      <TableHead className="text-xs text-right text-slate-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.slice(0, 5).map((exam) => (
                      <TableRow key={exam.id || exam._id} className="border-b border-[#27272A]/60 hover:bg-[#18181A]">
                        <TableCell className="text-xs font-semibold text-slate-100">{exam.title}</TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">{exam.subject || 'CS301'}</TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">{exam.duration || 60} min</TableCell>
                        <TableCell>
                          <Badge variant={exam.status === 'ACTIVE' ? 'default' : 'secondary'} className="font-mono text-[10px]">
                            {exam.status || 'SCHEDULED'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => navigate(`/faculty/exams/${exam.id || exam._id}`)}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
