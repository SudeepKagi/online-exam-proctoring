import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { PlusCircle, ArrowLeft, Send, Trash2, Upload, Download, Loader2 } from 'lucide-react'

export default function ExamManagePage() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempts, setAttempts] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ questionText: '', option0: '', option1: '', option2: '', option3: '', correctOptionIndex: 0, marks: 1 })
  const fileInputRef = React.useRef(null)

  const loadExam = async () => {
    try {
      const [examRes, attemptsRes] = await Promise.allSettled([
        apiClient.get(`/exams/${id}`),
        apiClient.get(`/exams/${id}/attempts`),
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

  const handleUploadQuestions = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post(`/exams/${id}/questions/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMsg({ text: `Imported ${res.data?.count || 0} questions successfully.`, type: 'success' })
      loadExam()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to upload questions'), type: 'error' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExportCsv = () => {
    const baseURL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1'
    window.open(`${baseURL}/exams/${id}/results/export`, '_blank')
  }

  const handleAddQuestion = async (e) => {
    e.preventDefault()
    try {
      const options = [form.option0, form.option1, form.option2, form.option3]
      await apiClient.post(`/exams/${id}/questions`, {
        questionText: form.questionText, options, correctOptionIndex: parseInt(form.correctOptionIndex, 10), marks: parseFloat(form.marks),
      })
      setDialogOpen(false)
      setForm({ questionText: '', option0: '', option1: '', option2: '', option3: '', correctOptionIndex: 0, marks: 1 })
      setMsg({ text: 'Question added successfully.', type: 'success' })
      loadExam()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to add question'), type: 'error' })
    }
  }

  const handlePublish = async () => {
    try {
      await apiClient.post(`/exams/${id}/publish`)
      setMsg({ text: 'Exam published successfully.', type: 'success' })
      loadExam()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Publish failed'), type: 'error' })
    }
  }

  const handleDeleteQuestion = async (qId) => {
    try {
      await apiClient.delete(`/exams/${id}/questions/${qId}`)
      loadExam()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Delete failed'), type: 'error' })
    }
  }

  return (
    <DashboardShell title={exam?.title || 'Manage Examination'}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-slate-600">
          <Link to="/faculty/exams"><ArrowLeft className="w-3.5 h-3.5" /> Back to My Exams</Link>
        </Button>
        {exam?.status === 'DRAFT' && (
          <Button size="sm" onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" /> Publish Examination
          </Button>
        )}
      </div>

      {msg.text && (
        <div className={`p-3 rounded-lg text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="questions" className="text-xs">Question Bank ({questions.length})</TabsTrigger>
          <TabsTrigger value="results" className="text-xs">Assessment Results</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">Add multiple choice items with assigned points.</p>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadQuestions} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload Questions Excel
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs">
                    <PlusCircle className="w-3.5 h-3.5" /> Add MCQ Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>New Multiple Choice Question</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddQuestion} className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Question Prompt</Label>
                      <Input required value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} placeholder="Enter question..." />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((idx) => (
                        <div key={idx} className="space-y-1">
                          <Label className="text-xs">Option {String.fromCharCode(65 + idx)}</Label>
                          <Input required value={form[`option${idx}`]} onChange={(e) => setForm({ ...form, [`option${idx}`]: e.target.value })} placeholder={`Opt ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Correct Option</Label>
                        <select className="w-full border border-slate-300 rounded-md p-1.5 text-xs bg-white" value={form.correctOptionIndex} onChange={(e) => setForm({ ...form, correctOptionIndex: e.target.value })}>
                          <option value={0}>Option A</option><option value={1}>Option B</option><option value={2}>Option C</option><option value={3}>Option D</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Points / Marks</Label>
                        <Input required type="number" min={0.5} step={0.5} value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1">Save Question</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 space-y-3">
              {questions.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">No questions added yet.</div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Question {idx + 1} ({q.marks} pts)</div>
                      <p className="text-sm font-medium text-slate-900">{q.questionText}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(Array.isArray(q.options) ? q.options : []).map((opt, i) => (
                          <div key={i} className={`text-xs px-2.5 py-1.5 rounded-md border ${i === q.correctOptionIndex ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium' : 'border-slate-200 bg-white text-slate-700'}`}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(q.id)} className="text-slate-400 hover:text-red-600 h-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Student Exam Attempts & Scores</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="text-xs font-semibold">Student</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-slate-500">Evaluation records synchronize after examination submission.</TableCell></TableRow>
                  ) : (
                    attempts.map((att) => (
                      <TableRow key={att.id} className="border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-900">{att.studentName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs bg-slate-50">{att.status}</Badge></TableCell>
                        <TableCell className="text-xs font-semibold">{att.score != null ? `${att.score} pts` : 'Pending'}</TableCell>
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
