import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { PlusCircle, Settings, Calendar, Clock } from 'lucide-react'

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
      const res = await apiClient.get('/exams')
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
      await apiClient.post('/exams', {
        ...form,
        durationMinutes: parseInt(form.durationMinutes, 10),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      })
      setDialogOpen(false)
      setForm({ title: '', courseCode: '', startTime: '', endTime: '', durationMinutes: 60 })
      setMsg({ text: 'Exam created successfully. Configure questions now.', type: 'success' })
      loadExams()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to create exam'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell title="Faculty Examination Workspace">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">Design assessments, configure question banks, and review submitted scores.</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs">
              <PlusCircle className="w-3.5 h-3.5" /> Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Examination</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Exam Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Midterm Operating Systems" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Course Code</Label>
                <Input required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. CS-401" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Window</Label>
                  <Input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Window</Label>
                  <Input required type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duration (Minutes)</Label>
                <Input required type="number" min={5} max={300} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
                {submitting ? 'Creating...' : 'Save & Configure Questions'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-lg text-xs font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-xs font-semibold text-slate-600">Exam Title</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Course Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Schedule</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Duration</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">Loading exams...</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">No exams created yet. Click "Create Exam" to begin.</TableCell></TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.id} className="border-slate-100">
                    <TableCell className="font-medium text-slate-900 text-sm">{exam.title}</TableCell>
                    <TableCell className="text-slate-600 text-sm font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">{exam.durationMinutes}m</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exam.status === 'PUBLISHED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1">
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
