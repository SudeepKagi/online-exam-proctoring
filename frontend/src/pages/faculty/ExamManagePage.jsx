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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b]">
          <Link to="/faculty/exams"><ArrowLeft className="w-3.5 h-3.5" /> Back to My Exams</Link>
        </Button>
        <div className="flex items-center gap-2">
          {exam && <ExamSettingsModal exam={exam} onUpdated={(t) => { setMsg({ text: t, type: 'success' }); loadExam() }} />}
          {exam?.status === 'DRAFT' && (
            <Button size="sm" onClick={handlePublish} className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] h-9 px-4 shadow-xs cursor-pointer">
              <Send className="w-3.5 h-3.5" /> Publish Exam
            </Button>
          )}
        </div>
      </div>

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
          <TabsTrigger value="results">Assessment Results ({attempts.length})</TabsTrigger>
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
          <Card className="border-[#e9eaf2] bg-white shadow-xs rounded-[12px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-[#fbfbff] border-b border-[#e9eaf2]">
              <CardTitle className="text-xs font-[480] text-[#28253b]">Student Attempts & Deterministic Grading</CardTitle>
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs font-[420] rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent">
                <a href={`/api/v1/exams/${id}/results/export`} target="_blank" rel="noreferrer">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs text-[#70707d] font-[360]">No student attempts recorded for this exam yet.</TableCell></TableRow>
                  ) : (
                    attempts.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="text-xs font-[480] text-[#28253b]">{att.studentName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-[420] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent">{att.status}</Badge></TableCell>
                        <TableCell className="text-xs font-[480] text-[#28253b]">{att.score != null ? `${att.score} pts` : 'In Progress'}</TableCell>
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
