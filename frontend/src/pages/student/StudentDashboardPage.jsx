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
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-xl font-black tracking-tight">{user?.fullName || 'Welcome, Candidate'}</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified
            </span>
          </div>
          <p className="text-xs text-blue-200">
            Roll Number: <strong className="text-white font-mono">{user?.institutionId || '—'}</strong> • Department: <strong className="text-white">{meta.department || 'Computer Science'}</strong> • Semester: <strong className="text-white">{meta.semester ? `Sem ${meta.semester}` : '6'}</strong>
          </p>
        </div>
        <Link to="/settings" className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition">
          View Profile & Settings
        </Link>
      </div>

      {msg.text && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
          {msg.text}
        </div>
      )}

      {/* Available & Scheduled Examinations */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" /> Available & Scheduled Examinations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-slate-500">Loading your assessments...</div>
          ) : activeOrUpcoming.length === 0 ? (
            <Card className="col-span-full border-slate-200 bg-white p-8 text-center rounded-xl shadow-xs">
              <p className="text-xs text-slate-500">No active examinations currently assigned to your account.</p>
            </Card>
          ) : (
            activeOrUpcoming.map((exam) => (
              <Card key={exam.id} className="border-slate-200 bg-white flex flex-col justify-between shadow-xs rounded-xl overflow-hidden hover:shadow-md transition">
                <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 leading-snug">{exam.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                      {exam.courseCode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Duration: {exam.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Window: {new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl gap-1.5 shadow-xs h-10 cursor-pointer">
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
      <div className="mt-8">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed Evaluations & Score Breakdown
        </h3>
        <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50/70">
                  <TableHead className="text-xs font-semibold text-slate-600">Exam Title</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Course Code</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Result Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">
                      No completed examination attempts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  completed.map((exam) => (
                    <TableRow key={exam.id} className="border-slate-100 hover:bg-slate-50/60">
                      <TableCell className="font-bold text-slate-900 text-xs">{exam.title}</TableCell>
                      <TableCell className="text-slate-600 text-xs font-mono">{exam.courseCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                          SUBMITTED
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 text-xs">
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
