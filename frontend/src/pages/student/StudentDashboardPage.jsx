import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { BookOpen, Clock, Calendar, CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react'

export default function StudentDashboardPage() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    let mounted = true
    const loadExams = async () => {
      try {
        const res = await apiClient.get('/exams/student/exams')
        if (mounted) setExams(ensureArray(res.data?.exams || res.data))
      } catch (err) {
        try {
          const fallback = await apiClient.get('/exams')
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
      {msg.text && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium">
          {msg.text}
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Available & Scheduled Examinations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-500">Loading your assessments...</div>
          ) : activeOrUpcoming.length === 0 ? (
            <Card className="col-span-full border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">No active examinations currently assigned to your account.</p>
            </Card>
          ) : (
            activeOrUpcoming.map((exam) => (
              <Card key={exam.id} className="border-slate-200 bg-white flex flex-col justify-between shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 leading-snug">{exam.title}</CardTitle>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {exam.courseCode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Duration: {exam.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Start: {new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                    <Link to={`/student/exams/${exam.id}/pre-check`}>
                      <ShieldCheck className="w-4 h-4" /> Start System & Identity Check
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Completed Evaluations & Past Records</h2>
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="text-xs font-semibold text-slate-600">Exam Title</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Course Code</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Completion Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-500">
                      No completed examination attempts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  completed.map((exam) => (
                    <TableRow key={exam.id} className="border-slate-100">
                      <TableCell className="font-medium text-slate-900 text-sm">{exam.title}</TableCell>
                      <TableCell className="text-slate-600 text-sm font-mono">{exam.courseCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          SUBMITTED
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 text-sm">{exam.score != null ? `${exam.score} pts` : 'Pending'}</TableCell>
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
