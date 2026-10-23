import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { BookOpen, Clock, Calendar, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [currentTime, setCurrentTime] = useState(Date.now())

  const meta = (user?.profileMetadata && typeof user?.profileMetadata === 'object') ? user?.profileMetadata : {}

  useEffect(() => {
    if (location.state?.errorMsg) {
      setMsg({ text: location.state.errorMsg, type: 'error' })
    }
  }, [location.state])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

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
      {/* Welcome Banner - Mercury Light World */}
      <div className="bg-gradient-to-r from-[#edecfb] via-[#fbfbff] to-white border border-[#e9eaf2] rounded-[16px] p-6 text-[#28253b] shadow-[0_1px_3px_rgba(40,37,59,0.04)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-xl font-[480] tracking-wide text-[#28253b]">{user?.fullName || 'Welcome, Student'}</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-[420] bg-white text-[#5266eb] border border-[#5266eb]/20 px-2.5 py-0.5 rounded-full shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified
            </span>
          </div>
          <p className="text-xs text-[#554e7b] font-[360]">
            Roll Number: <strong className="text-[#28253b] font-mono font-[480]">{user?.institutionId || '—'}</strong> • Department: <strong className="text-[#28253b] font-[480]">{meta.department || 'Computer Science'}</strong> • Semester: <strong className="text-[#28253b] font-[480]">{meta.semester ? `Sem ${meta.semester}` : '6'}</strong>
          </p>
        </div>
        <Link to="/settings" className="px-4 py-2 rounded-[40px] bg-white hover:bg-[#fbfbff] border border-[#e9eaf2] text-xs font-[420] text-[#28253b] shadow-xs transition-colors cursor-pointer">
          View Profile & Settings
        </Link>
      </div>

      {msg.text && (
        <div className="mt-4 p-3 bg-[#edecfb] text-[#28253b] rounded-[12px] text-xs font-[420] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#5266eb] shrink-0" />
          <span>{msg.text}</span>
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
            activeOrUpcoming.map((exam) => {
              const start = exam.startTime ? new Date(exam.startTime).getTime() : 0
              const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity
              const isFuture = currentTime < start
              const isEnded = currentTime > end

              return (
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

                    {isFuture ? (
                      <Button disabled className="w-full bg-[#edecfb] text-[#554e7b] opacity-80 text-xs font-[420] rounded-[32px] gap-1.5 h-10 border-0 cursor-not-allowed">
                        <Clock className="w-4 h-4 text-[#5266eb]" /> Opens at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Button>
                    ) : isEnded ? (
                      <Button disabled className="w-full bg-[#edecfb] text-[#554e7b] opacity-70 text-xs font-[420] rounded-[32px] gap-1.5 h-10 border-0 cursor-not-allowed">
                        Examination Window Closed
                      </Button>
                    ) : (
                      <Button asChild className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] gap-1.5 shadow-xs h-10 cursor-pointer">
                        <Link to={`/student/exams/${exam.id}/pre-check`}>
                          <ShieldCheck className="w-4 h-4" /> Launch Pre-Exam Check
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Completed Evaluations */}
      <div className="mt-8 font-sans">
        <h3 className="text-sm font-[480] text-[#28253b] mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#5266eb]" /> Completed Evaluations & Score Breakdown
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
                        <Badge variant="outline" className="bg-[#edecfb] text-[#5266eb] border-0 text-[10px] font-[420]">
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
