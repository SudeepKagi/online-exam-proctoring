import React, { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { UserCheck, Calendar, Clock } from 'lucide-react'

export default function AdminExamsPage() {
  const [exams, setExams] = useState([])
  const [invigilators, setInvigilators] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedInvigilatorId, setSelectedInvigilatorId] = useState('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadData = async () => {
    setLoading(true)
    try {
      const [examsRes, usersRes] = await Promise.allSettled([
        apiClient.get('/exams'),
        apiClient.get('/users?role=INVIGILATOR'),
      ])
      if (examsRes.status === 'fulfilled') {
        setExams(ensureArray(examsRes.value.data?.exams || examsRes.value.data))
      }
      if (usersRes.status === 'fulfilled') {
        setInvigilators(ensureArray(usersRes.value.data?.users || usersRes.value.data))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedExam || !selectedInvigilatorId) return
    setSubmitting(true)
    try {
      await apiClient.post(`/exams/${selectedExam.id}/assign`, {
        userId: selectedInvigilatorId,
        role: 'INVIGILATOR',
      })
      setMsg({ text: `Invigilator assigned to ${selectedExam.title} successfully.`, type: 'success' })
      setAssignDialogOpen(false)
      setSelectedInvigilatorId('')
      loadData()
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to assign invigilator'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell title="Institutional Exams">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Oversee all institution exams, review schedules, and allocate invigilators.</p>
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
                <TableHead className="text-xs font-semibold text-slate-600">Course</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Start Time</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Duration</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Invigilation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">Loading exams...</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">No exams registered.</TableCell></TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.id} className="border-slate-100">
                    <TableCell className="font-medium text-slate-900 text-sm">{exam.title}</TableCell>
                    <TableCell className="text-slate-600 text-sm font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">{exam.durationMinutes} mins</TableCell>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          setSelectedExam(exam)
                          setAssignDialogOpen(true)
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Assign Invigilator
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Invigilator</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 pt-2">
            <div className="space-y-1 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">{selectedExam?.title}</span>
              <p className="text-xs text-slate-500 font-mono">{selectedExam?.courseCode}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Select Invigilator</Label>
              <Select value={selectedInvigilatorId} onValueChange={setSelectedInvigilatorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose invigilator" />
                </SelectTrigger>
                <SelectContent>
                  {invigilators.length === 0 ? (
                    <SelectItem value="none" disabled>No registered invigilators</SelectItem>
                  ) : (
                    invigilators.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.fullName} ({inv.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting || !selectedInvigilatorId} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
