import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import {
  getSavedReadinessResult,
  saveReadinessResult,
  evaluateClockSkew,
  evaluateLatency,
  evaluateOperatingSystem
} from '@/lib/systemCheck'
import { BookOpen, Clock, Calendar, CheckCircle2, ShieldCheck, AlertCircle, Laptop, Camera, Wifi, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import { CardListSkeleton, TableSkeleton } from '@/components/common/TableSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function StudentDashboardPage() {
  usePageTitle('Student Portal')
  const { user } = useAuth()
  const location = useLocation()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [readiness, setReadiness] = useState(() => getSavedReadinessResult())
  const [isTestingComputer, setIsTestingComputer] = useState(false)
  const [computerCheckFeedback, setComputerCheckFeedback] = useState('')

  const runComputerCheck = async () => {
    setIsTestingComputer(true)
    setComputerCheckFeedback('')
    let cameraOk = false
    let internetOk = false
    let clockOk = false
    const issues = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      cameraOk = true
    } catch (_) {
      issues.push('Camera blocked — please allow camera access in your browser settings')
    }

    try {
      const start = performance.now()
      const cfg = await api.get('/config').catch(() => ({ data: { serverTime: new Date().toISOString() } }))
      const latency = performance.now() - start
      internetOk = latency < 2500
      if (!internetOk) issues.push('Internet connection is slow')

      const serverTime = cfg.data?.serverTime || new Date().toISOString()
      const clockEval = evaluateClockSkew(Date.now(), serverTime)
      clockOk = clockEval.passed
      if (clockEval.warning) {
        issues.push(clockEval.message)
      }
    } catch (_) {
      issues.push('Unable to reach examination server')
    }

    const osEval = evaluateOperatingSystem(false)
    const computerOk = osEval.compatible

    const allPassed = cameraOk && internetOk && clockOk && computerOk
    const result = {
      passed: allPassed,
      camera: cameraOk,
      internet: internetOk,
      clock: clockOk,
      computer: computerOk,
      issues,
      timestamp: Date.now()
    }

    saveReadinessResult(result)
    setReadiness(result)
    setIsTestingComputer(false)
    if (allPassed) {
      setComputerCheckFeedback("You're ready ✓")
    }
  }

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

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/student/secure-browser"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-[420] bg-white hover:bg-[#edecfb] text-[#5266eb] border border-[#5266eb]/20 shadow-xs transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Browser Setup</span>
          </Link>
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

      {/* Check your computer card */}
      <Card className="mt-4 border-[#e9eaf2] bg-white rounded-[16px] p-5 shadow-[0_1px_3px_rgba(40,37,59,0.04)] font-sans">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-[#5266eb]" />
              <h3 className="text-sm font-[480] text-[#28253b]">Check your computer</h3>
              {readiness?.passed || computerCheckFeedback.includes("You're ready") ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-[480] bg-[#edecfb] text-[#5266eb] px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> You&apos;re ready ✓
                </span>
              ) : readiness?.issues?.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-[480] bg-[#edecfb] text-[#8a6a26] px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Check needed
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
              {readiness?.passed || computerCheckFeedback.includes("You're ready")
                ? "Your camera, internet connection, and clock are verified for upcoming exams."
                : readiness?.issues?.length > 0
                  ? "Some items need attention before your exams: " + readiness.issues.join('. ')
                  : "Run a quick check of your camera, internet, and clock to make sure you're ready for exam day."}
            </p>
          </div>
          <Button
            type="button"
            onClick={runComputerCheck}
            disabled={isTestingComputer}
            variant="secondary"
            size="sm"
            className="shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTestingComputer ? 'animate-spin' : ''}`} />
            {isTestingComputer ? 'Checking...' : (readiness?.passed ? 'Check again' : 'Check your computer')}
          </Button>
        </div>
      </Card>

      {/* Available & Scheduled Examinations */}
      <div className="mt-6 font-sans">
        <h3 className="text-sm font-[480] text-[#28253b] mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#5266eb]" /> Available &amp; Scheduled Examinations
        </h3>
        {loading ? (
          <CardListSkeleton count={3} />
        ) : activeOrUpcoming.length === 0 ? (
          <Card className="border-[#e9eaf2] bg-white rounded-[16px] shadow-xs">
            <EmptyState
              icon={BookOpen}
              title="No active examinations"
              description="No active or scheduled assessments are currently assigned to your account."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrUpcoming.map((exam) => {
              const start = exam.startTime ? new Date(exam.startTime).getTime() : 0
              const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity
              const isFuture = currentTime < start
              const isEnded = currentTime > end

              return (
                <Card key={exam.id} className="border-[#e9eaf2] bg-white flex flex-col justify-between shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px] overflow-hidden hover:border-[#5266eb]/40 transition">
                  <CardHeader className="pb-3 bg-[#fbfbff] border-b border-[#e9eaf2]">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-[480] text-[#28253b] leading-snug">{exam.title}</CardTitle>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {exam?.proctoringConfig?.sebRequired && (
                          <Link to="/student/secure-browser" title="Test or verify your Safe Exam Browser setup">
                            <Badge variant="outline" className="text-[10px] font-[420] bg-[#edecfb] hover:bg-[#edecfb]/80 text-[#5266eb] border-0 flex items-center gap-1 cursor-pointer">
                              <ShieldCheck className="w-3 h-3" /> Secure browser
                            </Badge>
                          </Link>
                        )}
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent">
                          {exam.courseCode}
                        </Badge>
                      </div>
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
                      <Button asChild variant="secondary" className="w-full">
                        <Link to={`/student/exams/${exam.id}/start`}>
                          <Clock className="w-4 h-4 text-[#5266eb]" /> Opens at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Link>
                      </Button>
                    ) : isEnded ? (
                      <Button disabled variant="secondary" className="w-full opacity-70">
                        Examination Window Closed
                      </Button>
                    ) : (
                      <Button asChild variant="primary" className="w-full">
                        <Link to={`/student/exams/${exam.id}/start`}>
                          <ShieldCheck className="w-4 h-4" /> Start Exam
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
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
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={2} cols={5} />
                ) : completed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={CheckCircle2}
                        title="No completed assessments"
                        description="Completed examination attempts and grade breakdowns will appear here."
                      />
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
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-[420]">
                          <Link to={exam.attemptId ? `/student/results/${exam.attemptId}` : `/student/exams/${exam.id}/results`}>
                            View Results <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
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
