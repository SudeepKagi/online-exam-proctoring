import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { BookOpen, Clock, Calendar, CheckCircle2, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react'

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const meta = (user?.profileMetadata && typeof user?.profileMetadata === 'object') ? user?.profileMetadata : {}

  useEffect(() => {
    let mounted = true
    const loadExams = async () => {
      try {
        const res = await api.get('/student/exams')
        if (mounted) setExams(ensureArray(res.data?.exams || res.data))
      } catch (err) {
        try {
          const fallback = await api.get('/exams')
          if (mounted) setExams(ensureArray(fallback.data?.exams || fallback.data))
        } catch (e) {
          if (mounted) setMsg({ text: errorMessage(e, 'Failed to fetch assigned exams'), type: 'error' })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadExams()
    return () => { mounted = false }
  }, [])

  const activeOrUpcoming = exams.filter((e) => (e.status === 'PUBLISHED' || e.status === 'ACTIVE') && e.attemptStatus !== 'SUBMITTED')
  const completed = exams.filter((e) => e.status === 'COMPLETED' || e.attemptStatus === 'SUBMITTED')

  return (
    <DashboardShell title="Student Examination Portal">
      {/* Welcome Banner - Mercury Night World */}
      <div className="bg-[#171721] border border-[#1e1e2a] rounded-[16px] p-6 text-[#ededf3] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-xl font-[480] tracking-wide text-[#ededf3]">{user?.fullName || 'Welcome, Candidate'}</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-[420] bg-[rgba(156,180,232,0.15)] text-[#9cb4e8] border border-[#9cb4e8]/30 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified
            </span>
          </div>
          <p className="text-xs text-[#c3c3cc] font-[360]">
            Roll Number: <strong className="text-[#ededf3] font-mono font-[480]">{user?.institutionId || '—'}</strong> • Department: <strong className="text-[#ededf3] font-[480]">{meta.department || 'Computer Science'}</strong> • Semester: <strong className="text-[#ededf3] font-[480]">{meta.semester ? `Sem ${meta.semester}` : '6'}</strong>
          </p>
        </div>
        <Link to="/settings" className="px-4 py-2 rounded-[40px] bg-[rgba(175,178,206,0.18)] hover:bg-[rgba(175,178,206,0.28)] border border-[rgba(175,178,206,0.36)] text-xs font-[420] text-[#ededf3] transition-colors cursor-pointer">
          View Profile & Settings
        </Link>
      </div>

      {msg.text && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-[12px] text-xs font-[420]">
          {msg.text}
        </div>
      )}

      {/* Available & Scheduled Examinations */}
      <div className="mt-6 font-sans">
        <h3 className="text-sm font-[480] text-[#28253b] mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#5266eb]" /> Available & Scheduled Examinations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-[#70707d] font-[360]">Loading your assessments...</div>
          ) : activeOrUpcoming.length === 0 ? (
            <Card className="col-span-full border-[#e9eaf2] bg-white p-8 text-center rounded-[12px] shadow-xs">
              <p className="text-xs text-[#70707d] font-[360]">No active examinations currently assigned to your account.</p>
            </Card>
          ) : (
            activeOrUpcoming.map((exam) => (
              <Card key={exam.id} className="border-[#e9eaf2] bg-white flex flex-col justify-between shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px] overflow-hidden hover:border-[#5266eb]/40 transition">
                <CardHeader className="pb-3 bg-[#fbfbff] border-b border-[#e9eaf2]">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-sm font-[480] text-[#28253b] leading-snug">{exam.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px] font-[420] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent">
                      {exam.courseCode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="space-y-1.5 text-xs text-[#554e7b] font-[360]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#70707d]" />
                      <span>Duration: {exam.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#70707d]" />
                      <span>Window: {new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] gap-1.5 shadow-xs h-10 cursor-pointer">
                    <Link to={`/student/exams/${exam.id}/pre-check`}>
                      <ShieldCheck className="w-4 h-4" /> Launch Pre-Exam Check
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Completed Evaluations */}
      <div className="mt-8 font-sans">
        <h3 className="text-sm font-[480] text-[#28253b] mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed Evaluations & Score Breakdown
        </h3>
        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Title</TableHead>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-[#70707d] font-[360]">
                      No completed examination attempts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  completed.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-[480] text-[#28253b] text-xs">{exam.title}</TableCell>
                      <TableCell className="text-[#554e7b] text-xs font-mono">{exam.courseCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-[420]">
                          SUBMITTED
                        </Badge>
                      </TableCell>
                      <TableCell className="font-[480] text-[#28253b] text-xs">
                        {exam.score != null ? `${exam.score} pts` : 'Evaluated'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
