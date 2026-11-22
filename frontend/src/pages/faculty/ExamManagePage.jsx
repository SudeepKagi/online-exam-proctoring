import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { AsyncStateView } from '@/components/common/AsyncStateView'
import { mapClientError } from '@/lib/clientErrorMapper'
import ExamQuestionsTab from '@/components/faculty/ExamQuestionsTab'
import ExamInvigilatorsTab from '@/components/faculty/ExamInvigilatorsTab'
import ExamReadinessTab from '@/components/faculty/ExamReadinessTab'
import IncidentReviewModal from '@/components/faculty/IncidentReviewModal'
import ExamSettingsModal from '@/components/faculty/ExamSettingsModal'
import ExamViolationsTab from '@/components/faculty/ExamViolationsTab'
import EmptyState from '@/components/common/EmptyState'
import { ArrowLeft, Send, Download, UserCheck, ShieldCheck, ShieldAlert, AlertTriangle, Eye, Laptop } from 'lucide-react'

export default function ExamManagePage() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempts, setAttempts] = useState([])
  const [reviewModalAttemptId, setReviewModalAttemptId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [sebStatus, setSebStatus] = useState(null)
  const [hasInvigilator, setHasInvigilator] = useState(true)
  const [loading, setLoading] = useState(true)
  const [examError, setExamError] = useState(null)
  const [isPublishing, setIsPublishing] = useState(false)

  const loadExam = useCallback(async (signal) => {
    setLoading(true)
    setExamError(null)
    try {
      const [examRes, attemptsRes, sebRes, assignmentsRes] = await Promise.allSettled([
        api.get(`/exams/${id}`, { signal }),
        api.get(`/exams/${id}/attempts`, { signal }),
        api.get('/exams/seb-status', { signal }),
        api.get(`/exams/${id}/assignments`, { signal })
      ])
      if (examRes.status === 'fulfilled') {
        const data = examRes.value.data?.exam || examRes.value.data
        setExam(data)
        setQuestions(ensureArray(data?.questions))
      } else {
        throw examRes.reason
      }
      if (attemptsRes.status === 'fulfilled') {
        setAttempts(ensureArray(attemptsRes.value.data?.attempts || attemptsRes.value.data))
      }
      if (sebRes.status === 'fulfilled') {
        setSebStatus(sebRes.value.data)
      }
      if (assignmentsRes.status === 'fulfilled') {
        const assignments = ensureArray(assignmentsRes.value.data?.assignments || assignmentsRes.value.data)
        const invCount = assignments.filter((a) => a.assignedRole === 'INVIGILATOR').length
        setHasInvigilator(invCount > 0)
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return
      const mapped = mapClientError(err, 'retry')
      setExamError(mapped)
      setMsg({ text: mapped.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    loadExam(controller.signal)
    return () => { controller.abort() }
  }, [loadExam])

  const handlePublish = async () => {
    if (isPublishing) return
    if (questions.length === 0) {
      setMsg({ text: 'Cannot publish exam without questions.', type: 'error' })
      return
    }
    setIsPublishing(true)
    try {
      await api.post(`/exams/${id}/publish`)
      setMsg({ text: 'Exam published successfully! Students can now access when window opens.', type: 'success' })
      loadExam()
    } catch (err) {
      const mapped = mapClientError(err, 'retry')
      setMsg({ text: mapped.message, type: 'error' })
    } finally {
      setIsPublishing(false)
    }
  }

  const now = Date.now()
  const start = exam?.startTime ? new Date(exam.startTime).getTime() : 0
  const end = exam?.endTime ? new Date(exam.endTime).getTime() : Infinity
  let lifecycle = 'DRAFT'
  if (exam?.status !== 'DRAFT') {
    if (now > end || exam?.status === 'COMPLETED') lifecycle = 'ENDED'
    else if (now >= start) lifecycle = 'LIVE'
    else lifecycle = 'SCHEDULED'
  }
  const isReadOnly = lifecycle === 'LIVE' || lifecycle === 'ENDED' || attempts.length > 0

  if (loading && !exam) {
    return (
      <DashboardShell title="Manage Examination">
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-[16px] shadow-xs text-center font-sans">
          <div className="w-10 h-10 border-2 border-[#5266eb] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs text-[#554e7b] font-[420]">Loading examination workspace...</p>
        </div>
      </DashboardShell>
    )
  }

  if (examError && !exam) {
    return (
      <DashboardShell title="Manage Examination">
        <div className="max-w-xl mx-auto my-12 font-sans">
          <AsyncStateView
            state={examError?.code === 'NETWORK_ERROR' ? 'offline' : 'error'}
            error={examError || { title: 'Assessment Unavailable', message: 'The assessment could not be loaded.' }}
            onRetry={() => loadExam()}
          />
          <div className="mt-4 text-center">
            <Button variant="outline" asChild className="rounded-[40px] px-6">
              <Link to="/faculty/exams"><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to My Exams</Link>
            </Button>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title={exam?.title || 'Manage Examination'}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b]">
          <Link to="/faculty/exams"><ArrowLeft className="w-3.5 h-3.5" /> Back to My Exams</Link>
        </Button>
        <div className="flex items-center gap-2">
          {exam?.proctoringConfig?.sebRequired && (
            <Badge variant="outline" className={`text-[10px] font-[420] border-0 inline-flex items-center gap-1 h-7 px-2.5 ${
              sebStatus?.effectiveMode === 'enforce' ? 'bg-[#edecfb] text-[#5266eb]' : 'bg-[#edecfb] text-[#554e7b]'
            }`}>
              <ShieldCheck className="w-3 h-3" />
              {sebStatus?.effectiveMode === 'enforce'
                ? 'Secure browser'
                : 'Secure browser: required, NOT enforced yet (students can still use a normal browser)'}
            </Badge>
          )}
          {exam && <ExamSettingsModal exam={exam} isReadOnly={isReadOnly} lifecycle={lifecycle} onUpdated={(t) => { setMsg({ text: t, type: 'success' }); loadExam() }} />}
          {exam?.status === 'DRAFT' && !isReadOnly && (
            <Button size="sm" onClick={handlePublish} className="gap-1.5 h-9 px-4 cursor-pointer">
              <Send className="w-3.5 h-3.5" /> Publish Exam
            </Button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-white text-[#5266eb] border-0 font-[480]">
              {lifecycle === 'LIVE' ? 'EXAM LIVE' : lifecycle === 'ENDED' ? 'EXAM ENDED' : 'ATTEMPTS EXIST'}
            </Badge>
            <span>
              {attempts.length > 0
                ? 'Student attempts have already been initiated. Question pool and exam configuration are immutable.'
                : `Exam window is currently ${lifecycle.toLowerCase()}. Question edits and deletion are disabled for integrity.`}
            </span>
          </div>
        </div>
      )}

      {!hasInvigilator && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#554e7b] border-0 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#5266eb] shrink-0" />
          <span>No invigilator assigned, violations are logged but nobody can suspend in real time.</span>
        </div>
      )}

      {msg.text && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
          {msg.text}
        </div>
      )}

      <Tabs defaultValue="questions" className="w-full font-sans">
        <TabsList>
          <TabsTrigger value="questions">Question Bank ({questions.length})</TabsTrigger>
          <TabsTrigger value="invigilators" className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Invigilators & Credentials
          </TabsTrigger>
          <TabsTrigger value="readiness" data-testid="tab-readiness" className="flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5" /> Student Readiness
          </TabsTrigger>
          <TabsTrigger value="violations" data-testid="tab-violations" className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Violations
          </TabsTrigger>
          <TabsTrigger value="results">Assessment Results ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <ExamQuestionsTab
            examId={id}
            questions={questions}
            isReadOnly={isReadOnly}
            onRefresh={loadExam}
            onNotify={(text, type) => setMsg({ text, type })}
          />
        </TabsContent>

        <TabsContent value="invigilators" className="mt-4">
          <ExamInvigilatorsTab examId={id} onStatusUpdate={(t) => setMsg({ text: t, type: 'success' })} />
        </TabsContent>

        <TabsContent value="readiness" className="mt-4">
          <ExamReadinessTab examId={id} exam={exam} />
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <ExamViolationsTab examId={id} />
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <Card className="border-0 bg-white shadow-xs rounded-[16px] overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 bg-[#fbfbff] border-b border-[#f0f0f5]">
              <div>
                <CardTitle className="text-xs font-[480] text-[#28253b]">Student Attempts, Integrity Flags & Grading</CardTitle>
                <p className="text-[11px] text-[#70707d] font-[360] mt-0.5">
                  Automated grading with invigilator review flags and incident auditing
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent">
                  <a href={`/api/v1/exams/${id}/incidents/export`} target="_blank" rel="noreferrer">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#5266eb]" /> Export All Incidents
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent">
                  <a href={`/api/v1/exams/${id}/results/export`} target="_blank" rel="noreferrer">
                    <Download className="w-3.5 h-3.5" /> Export Results CSV
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Attempt Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Integrity &amp; Review Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState
                            title="No student attempts recorded"
                            description="No student attempts have been initiated or submitted for this assessment yet."
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                    attempts.map((att) => {
                      const isFlagged = Boolean(att.isFlagged) || (att.violationCount > 0) || att.reviewStatus === 'CONFIRMED'
                      return (
                        <TableRow key={att.id} data-testid={`attempt-row-${att.id}`}>
                          <TableCell>
                            <div>
                              <div className="text-xs font-[480] text-[#28253b]">{att.studentName}</div>
                              <div className="text-[11px] text-[#70707d] font-[360]">{att.email} • USN: {att.usn || '—'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-[420] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent">
                              {att.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-[480] text-[#28253b]">
                            {att.score != null ? `${att.score} pts` : 'In Progress'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isFlagged ? (
                                <Badge variant="outline" className="text-[10px] font-[480] bg-[#fff3e0] text-[#e65100] border-0 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Flagged ({att.violationCount || 0})
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-[#70707d] font-[360]">Clean (0 incidents)</span>
                              )}

                              {att.reviewStatus && att.reviewStatus !== 'PENDING' && (
                                <Badge variant="outline" className="text-[10px] font-[420] bg-[#edecfb] text-[#5266eb] border-0">
                                  {att.reviewStatus}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`review-btn-${att.id}`}
                              onClick={() => setReviewModalAttemptId(att.id)}
                              className="text-xs h-8 px-3 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Review Incidents
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Incident Review Modal (§Task 8) */}
      <IncidentReviewModal
        attemptId={reviewModalAttemptId}
        isOpen={Boolean(reviewModalAttemptId)}
        onClose={() => setReviewModalAttemptId(null)}
        onReviewSaved={() => loadExam()}
      />
    </DashboardShell>
  )
}
