import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import ExamQuestionsTab from '@/components/faculty/ExamQuestionsTab'
import ExamInvigilatorsTab from '@/components/faculty/ExamInvigilatorsTab'
import ExamSettingsModal from '@/components/faculty/ExamSettingsModal'
import { ArrowLeft, Send, Download, UserCheck } from 'lucide-react'

export default function ExamManagePage() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempts, setAttempts] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadExam = async () => {
    try {
      const [examRes, attemptsRes] = await Promise.allSettled([
        api.get(`/exams/${id}`),
        api.get(`/exams/${id}/attempts`),
      ])
      if (examRes.status === 'fulfilled') {
        const data = examRes.value.data?.exam || examRes.value.data
        setExam(data)
        setQuestions(ensureArray(data?.questions))
      }
      if (attemptsRes.status === 'fulfilled') {
        setAttempts(ensureArray(attemptsRes.value.data?.attempts || attemptsRes.value.data))
      }
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to load exam'), type: 'error' })
    }
  }

  useEffect(() => { loadExam() }, [id])

  const handlePublish = async () => {
    if (questions.length === 0) {
      setMsg({ text: 'Cannot publish exam without questions.', type: 'error' })
      return
    }
    try {
      await api.post(`/exams/${id}/publish`)
      setMsg({ text: 'Exam published successfully! Students can now access when window opens.', type: 'success' })
      loadExam()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Publish failed'), type: 'error' })
    }
  }

  return (
    <DashboardShell title={exam?.title || 'Manage Examination'}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-slate-600">
          <Link to="/faculty/exams"><ArrowLeft className="w-3.5 h-3.5" /> Back to My Exams</Link>
        </Button>
        <div className="flex items-center gap-2">
          {exam && <ExamSettingsModal exam={exam} onUpdated={(t) => { setMsg({ text: t, type: 'success' }); loadExam() }} />}
          {exam?.status === 'DRAFT' && (
            <Button size="sm" onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold rounded-xl shadow-xs">
              <Send className="w-3.5 h-3.5" /> Publish Exam
            </Button>
          )}
        </div>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl">
          <TabsTrigger value="questions" className="text-xs font-bold">Question Bank ({questions.length})</TabsTrigger>
          <TabsTrigger value="invigilators" className="text-xs font-bold flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Invigilators & Credentials
          </TabsTrigger>
          <TabsTrigger value="results" className="text-xs font-bold">Assessment Results ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <ExamQuestionsTab
            examId={id}
            questions={questions}
            onRefresh={loadExam}
            onNotify={(text, type) => setMsg({ text, type })}
          />
        </TabsContent>

        <TabsContent value="invigilators" className="mt-4">
          <ExamInvigilatorsTab examId={id} onStatusUpdate={(t) => setMsg({ text: t, type: 'success' })} />
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900">Student Attempts & Deterministic Grading</CardTitle>
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs rounded-xl">
                <a href={`/api/v1/exams/${id}/results/export`} target="_blank" rel="noreferrer">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50/70">
                    <TableHead className="text-xs font-semibold">Student</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs text-slate-500">No student attempts recorded for this exam yet.</TableCell></TableRow>
                  ) : (
                    attempts.map((att) => (
                      <TableRow key={att.id} className="border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-900">{att.studentName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] bg-slate-50">{att.status}</Badge></TableCell>
                        <TableCell className="text-xs font-bold">{att.score != null ? `${att.score} pts` : 'In Progress'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
