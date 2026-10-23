import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { PlusCircle, Settings, BookOpen, CheckCircle2, HelpCircle, Users, KeyRound, Eye } from 'lucide-react'
import ExamWizardModal from '@/components/faculty/ExamWizardModal'
import ExamCredentialsModal from '@/components/faculty/ExamCredentialsModal'

export default function FacultyExamsPage() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedExamForCreds, setSelectedExamForCreds] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

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

  useEffect(() => { loadExams() }, [])

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
            <div className="text-2xl font-[480] text-[#28253b]">Pure Browser</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Screen snapshots & monitoring</p>
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
          className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-5 h-10 shadow-xs cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" /> + 4-Step AI Exam Wizard
        </Button>
      </div>

      {msg.text && (
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
          {msg.text}
        </div>
      )}

      <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden font-sans">
        <CardContent className="p-0">
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
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-[#70707d] font-[360]">Loading exams...</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-[#70707d] font-[360]">No exams authored yet. Click "+ 4-Step AI Exam Wizard" to begin.</TableCell></TableRow>
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
                      <TableCell className="font-[480] text-[#28253b] text-xs">{exam.title}</TableCell>
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
        </CardContent>
      </Card>

      <ExamWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onExamCreated={handleExamCreated}
      />

      <ExamCredentialsModal
        isOpen={!!selectedExamForCreds}
        onClose={() => setSelectedExamForCreds(null)}
        exam={selectedExamForCreds}
      />
    </DashboardShell>
  )
}
