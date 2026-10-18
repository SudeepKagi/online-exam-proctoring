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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Total Exams</CardTitle>
            <BookOpen className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{exams.length}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Authored examinations</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Published / Live</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#5266eb]">{publishedCount}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Ready for candidate entry</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Questions Authored</CardTitle>
            <HelpCircle className="w-4 h-4 text-[#554e7b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">{totalQuestions || 'Active'}</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Standardized MCQ pool</p>
          </CardContent>
        </Card>

        <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[12px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Proctoring Mode</CardTitle>
            <Users className="w-4 h-4 text-[#5266eb]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-[480] text-[#28253b]">Pure Browser</div>
            <p className="text-xs text-[#70707d] font-[360] mt-1">Zero-install screen & camera lock</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 font-sans">
        <div>
          <h2 className="text-sm font-[480] text-[#28253b]">Your Authored Examination Cohorts</h2>
          <p className="text-xs text-[#70707d] font-[360]">Design assessments, run AI question synthesis, and generate proctor access pins.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-5 h-10 shadow-xs cursor-pointer">
              <PlusCircle className="w-3.5 h-3.5" /> + Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-base font-[480] text-[#28253b]">Create New Examination</DialogTitle>
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
              <Button type="submit" disabled={submitting} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] mt-2 cursor-pointer">
                {submitting ? 'Creating...' : 'Save & Configure Questions'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-[12px] text-xs font-[420] ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
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
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-[#70707d] font-[360]">No exams authored yet. Click "+ Create Exam" to begin.</TableCell></TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-[480] text-[#28253b] text-xs">{exam.title}</TableCell>
                    <TableCell className="text-[#554e7b] text-xs font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-[#554e7b] text-xs">
                      {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-[#554e7b] text-xs">{exam.durationMinutes}m</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-[420] ${
                        exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exam.status === 'PUBLISHED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent' :
                        'bg-[#fbfbff] text-[#70707d] border-[#e9eaf2]'
                      }`}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1 rounded-[40px] px-3 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent font-[420]">
                        <Link to={`/faculty/exams/${exam.id}`}>
                          <Settings className="w-3.5 h-3.5 text-[#5266eb]" /> Manage Exam
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
