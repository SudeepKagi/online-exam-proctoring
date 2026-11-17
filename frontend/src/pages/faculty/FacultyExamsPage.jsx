import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { PlusCircle, Settings, BookOpen, CheckCircle2, HelpCircle, Users, KeyRound, Eye, ShieldCheck, Clock } from 'lucide-react'
import ExamWizardModal from '@/components/faculty/ExamWizardModal'
import ExamCredentialsModal from '@/components/faculty/ExamCredentialsModal'
import TableSkeleton from '@/components/common/TableSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function FacultyExamsPage() {
  usePageTitle('Faculty Workspace')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedExamForCreds, setSelectedExamForCreds] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [sebStatus, setSebStatus] = useState(null)

  const loadSebStatus = async () => {
    try {
      const res = await api.get('/exams/seb-status')
      setSebStatus(res.data)
    } catch {
      // ignore
    }
  }

  const loadExams = async () => {
    setLoading(true)
    try {
      const res = await api.get('/faculty/exams')
      setExams(ensureArray(res.data?.exams || res.data))
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to load exams'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExams()
    loadSebStatus()
  }, [])

  const handleExamCreated = (newExam, publishConfig) => {
    setMsg({
      text: `Exam "${newExam?.title || 'Assessment'}" published successfully with ${publishConfig?.invigilatorId || 'Invigilator'} credentials generated!`,
      type: 'success'
    })
    loadExams()
  }

  const publishedCount = exams.filter(e => e.status === 'PUBLISHED' || e.status === 'ACTIVE').length
  const totalQuestions = exams.reduce((acc, e) => acc + (e.questions?.length || 0), 0)

  return (
    <DashboardShell title="Faculty Examination Workspace">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Total Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{exams.length}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Authored examinations</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Published / Live</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#5266eb]">{publishedCount}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Ready for candidate entry</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Questions Authored</CardTitle>
            <HelpCircle className="w-4 h-4 text-[#554e7b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{totalQuestions || 'Active'}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Standardized MCQ pool</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Proctoring Mode</CardTitle>
            <Users className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">Camera &amp; SEB</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Facial verification &amp; kiosk lockdown</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 font-sans">
        <div>
          <h2 className="text-sm font-[480] text-[#28253b]">Your Authored Examination Cohorts</h2>
          <p className="text-xs text-[#70707d] font-[360]">Design assessments, run AI question synthesis, and generate proctor access pins.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setWizardOpen(true)}
          className="gap-1.5 text-xs px-5 h-10 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" /> + Create Assessment (AI Exam Wizard)
        </Button>
      </div>

      {msg.text && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
          {msg.text}
        </div>
      )}

      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden font-sans">
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Title</TableHead>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Schedule Window</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={4} cols={6} />
                ) : exams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={BookOpen}
                        title="No assessments authored yet"
                        description="Click + Create Assessment above to launch the 5-step AI authoring wizard."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  exams.map((exam) => {
                    const now = Date.now()
                    const start = exam.startTime ? new Date(exam.startTime).getTime() : 0
                    const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity
                    let lifecycle = 'DRAFT'
                    if (exam.status !== 'DRAFT') {
                      if (now > end || exam.status === 'COMPLETED') lifecycle = 'ENDED'
                      else if (now >= start) lifecycle = 'LIVE'
                      else lifecycle = 'SCHEDULED'
                    }
                    const isImmutable = lifecycle === 'LIVE' || lifecycle === 'ENDED' || (exam.attemptCount > 0)

                    return (
                      <TableRow key={exam.id}>
                        <TableCell className="font-[480] text-[#28253b] text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{exam.title}</span>
                            {exam?.proctoringConfig?.sebRequired && (
                              <Badge variant="outline" className={`text-[10px] font-[420] border-0 inline-flex items-center gap-1 ${
                                sebStatus?.effectiveMode === 'enforce' ? 'bg-[#edecfb] text-[#5266eb]' : 'bg-[#edecfb] text-[#554e7b]'
                              }`}>
                                <ShieldCheck className="w-3 h-3" />
                                {sebStatus?.effectiveMode === 'enforce'
                                  ? 'Secure browser'
                                  : 'Secure browser: required, NOT enforced yet (students can still use a normal browser)'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-[#554e7b] text-xs font-mono">{exam.courseCode}</TableCell>
                        <TableCell className="text-[#554e7b] text-xs">
                          {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-[#554e7b] text-xs">{exam.durationMinutes}m</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-[420] border-0 ${
                            lifecycle === 'LIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                            lifecycle === 'SCHEDULED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                            lifecycle === 'ENDED' ? 'bg-[#edecfb] text-[#554e7b]' :
                            'bg-[#fbfbff] text-[#70707d]'
                          }`}>
                            {lifecycle}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedExamForCreds(exam)}
                            className="h-8 text-xs gap-1 rounded-[40px] px-2.5 text-[#554e7b] hover:text-[#5266eb]"
                            title="View Invigilator Access Credentials"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#5266eb]" />
                            <span className="hidden sm:inline">Invigilator Key</span>
                          </Button>
                          <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1 rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent font-[420]">
                            <Link to={`/faculty/exams/${exam.id}`}>
                              {isImmutable ? (
                                <><Eye className="w-3.5 h-3.5 text-[#5266eb]" /> View</>
                              ) : (
                                <><Settings className="w-3.5 h-3.5 text-[#5266eb]" /> Manage</>
                              )}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Responsive Card View (sm screens) */}
          <div className="block md:hidden divide-y divide-[#c3c3cc]/20">
            {loading ? (
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[#edecfb] rounded-full w-3/4 animate-pulse" />
                <div className="h-3 bg-[#fbfbff] rounded-full w-1/2 animate-pulse" />
                <div className="h-8 bg-[#edecfb] rounded-full w-24 animate-pulse" />
              </div>
            ) : exams.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No assessments authored yet"
                description="Click + Create Assessment above to launch the 5-step AI authoring wizard."
              />
            ) : (
              exams.map((exam) => {
                const now = Date.now()
                const start = exam.startTime ? new Date(exam.startTime).getTime() : 0
                const end = exam.endTime ? new Date(exam.endTime).getTime() : Infinity
                let lifecycle = 'DRAFT'
                if (exam.status !== 'DRAFT') {
                  if (now > end || exam.status === 'COMPLETED') lifecycle = 'ENDED'
                  else if (now >= start) lifecycle = 'LIVE'
                  else lifecycle = 'SCHEDULED'
                }
                const isImmutable = lifecycle === 'LIVE' || lifecycle === 'ENDED' || (exam.attemptCount > 0)

                return (
                  <div key={exam.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-[480] text-[#28253b]">{exam.title}</h4>
                        <span className="text-[11px] font-mono text-[#554e7b]">{exam.courseCode}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-[420] border-0 ${
                        lifecycle === 'LIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                        lifecycle === 'SCHEDULED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                        lifecycle === 'ENDED' ? 'bg-[#edecfb] text-[#554e7b]' :
                        'bg-[#fbfbff] text-[#70707d]'
                      }`}>
                        {lifecycle}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#554e7b]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {exam.durationMinutes}m
                      </span>
                      <span>
                        {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {exam?.proctoringConfig?.sebRequired && (
                      <div>
                        <Badge variant="outline" className={`text-[10px] font-[420] border-0 inline-flex items-center gap-1 ${
                          sebStatus?.effectiveMode === 'enforce' ? 'bg-[#edecfb] text-[#5266eb]' : 'bg-[#edecfb] text-[#554e7b]'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          {sebStatus?.effectiveMode === 'enforce'
                            ? 'Secure browser'
                            : 'Secure browser: required, NOT enforced yet (students can still use a normal browser)'}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedExamForCreds(exam)}
                        className="h-8 text-xs gap-1 rounded-[40px] px-2.5 text-[#554e7b] hover:text-[#5266eb] flex-1 justify-center bg-[rgba(82,102,235,0.05)]"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#5266eb]" /> Invigilator Key
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-8 text-xs gap-1 rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent font-[420] flex-1 justify-center"
                      >
                        <Link to={`/faculty/exams/${exam.id}`}>
                          {isImmutable ? (
                            <><Eye className="w-3.5 h-3.5 text-[#5266eb]" /> View</>
                          ) : (
                            <><Settings className="w-3.5 h-3.5 text-[#5266eb]" /> Manage</>
                          )}
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <ExamWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onExamCreated={handleExamCreated}
        existingExams={exams}
      />

      <ExamCredentialsModal
        isOpen={!!selectedExamForCreds}
        onClose={() => setSelectedExamForCreds(null)}
        exam={selectedExamForCreds}
      />
    </DashboardShell>
  )
}
