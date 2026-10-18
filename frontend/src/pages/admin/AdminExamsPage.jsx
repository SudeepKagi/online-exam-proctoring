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
      <div className="flex items-center justify-between font-sans">
        <p className="text-sm text-[#70707d] font-[360]">Oversee all institution exams, review schedules, and allocate invigilators.</p>
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
                <TableHead>Course</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invigilation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-[#70707d] font-[360]">Loading exams...</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-[#70707d] font-[360]">No exams registered.</TableCell></TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-[480] text-[#28253b] text-xs">{exam.title}</TableCell>
                    <TableCell className="text-[#554e7b] text-xs font-mono">{exam.courseCode}</TableCell>
                    <TableCell className="text-[#554e7b] text-xs">
                      {new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-[#554e7b] text-xs">{exam.durationMinutes} mins</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs font-[420] ${
                        exam.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        exam.status === 'PUBLISHED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent' :
                        'bg-[#fbfbff] text-[#70707d] border-[#e9eaf2]'
                      }`}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent font-[420] cursor-pointer"
                        onClick={() => {
                          setSelectedExam(exam)
                          setAssignDialogOpen(true)
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Assign Invigilator
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
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-[480] text-[#28253b]">Assign Invigilator</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 pt-2">
            <div className="space-y-1 text-sm bg-[#fbfbff] p-3 rounded-[12px] border border-[#e9eaf2]">
              <span className="font-[480] text-[#28253b]">{selectedExam?.title}</span>
              <p className="text-xs text-[#554e7b] font-mono">{selectedExam?.courseCode}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-[420] text-[#554e7b]">Select Invigilator</Label>
              <Select value={selectedInvigilatorId} onValueChange={setSelectedInvigilatorId}>
                <SelectTrigger className="w-full h-10 rounded-xl border border-[#c3c3cc]/60 bg-white">
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
            <Button type="submit" disabled={submitting || !selectedInvigilatorId} className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer">
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
