import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { PlusCircle, Settings, BookOpen, CheckCircle2, HelpCircle, Users, ArrowRight } from 'lucide-react'

export default function FacultyExamsPage() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [form, setForm] = useState({
    title: '',
    courseCode: '',
    startTime: '',
    endTime: '',
    durationMinutes: 60,
  })

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

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg({ text: '', type: '' })
    try {
      await api.post('/exams', {
        ...form,
        durationMinutes: parseInt(form.durationMinutes, 10),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      })
      setDialogOpen(false)
      setForm({ title: '', courseCode: '', startTime: '', endTime: '', durationMinutes: 60 })
      setMsg({ text: 'Exam created successfully. Configure questions and invigilators now.', type: 'success' })
      loadExams()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to create exam'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const publishedCount = exams.filter(e => e.status === 'PUBLISHED' || e.status === 'ACTIVE').length
  const totalQuestions = exams.reduce((acc, e) => acc + (e.questions?.length || 0), 0)

  return (
    <DashboardShell title="Faculty Examination Workspace">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Total Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{exams.length}</div>
            <p className="text-xs text-slate-500 mt-1">Authored examinations</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Published / Live</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{publishedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Ready for candidate entry</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Questions Authored</CardTitle>
            <HelpCircle className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalQuestions || 'Active'}</div>
            <p className="text-xs text-slate-500 mt-1">Standardized MCQ pool</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Proctoring Mode</CardTitle>
            <Users className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-600">Pure Browser</div>
            <p className="text-xs text-slate-500 mt-1">Zero-install screen & camera lock</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Your Authored Examination Cohorts</h2>
          <p className="text-xs text-slate-500">Design assessments, run AI question synthesis, and generate invigilator access pins.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs font-bold rounded-xl shadow-xs">
              <PlusCircle className="w-3.5 h-3.5" /> + Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Create New Examination</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-2">
              <FormField label="Exam Title" required>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Midterm Operating Systems" className="h-9 text-xs" />
              </FormField>
              <FormField label="Course Code" required>
                <Input required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. CS-401" className="h-9 text-xs font-mono uppercase" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start Window" required>
                  <Input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9 text-xs" />
                </FormField>
                <FormField label="End Window" required>
                  <Input required type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9 text-xs" />
                </FormField>
              </div>
              <FormField label="Duration (Minutes)" required>
                <Input required type="number" min={5} max={300} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="h-9 text-xs" />
              </FormField>
              <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-10 rounded-xl mt-2 cursor-pointer">
                {submitting ? 'Creating...' : 'Save & Configure Questions'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/70">
                <TableHead className="text-xs font-semibold text-slate-600">Exam Title</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Course Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Schedule Window</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Duration</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">Loading exams...</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">No exams authored yet. Click "+ Create Exam" to begin.</TableCell></TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.id} className="border-slate-100 hover:bg-slate-50/60">
                    <TableCell className="font-bold text-slate-900 text-xs">{exam.title}</TableCell>
                    <TableCell className="text-slate-600 text-xs font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">{exam.durationMinutes}m</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-bold ${
                        exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exam.status === 'PUBLISHED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1 rounded-xl">
                        <Link to={`/faculty/exams/${exam.id}`}>
                          <Settings className="w-3.5 h-3.5 text-blue-600" /> Manage Exam
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
    </DashboardShell>
  )
}
