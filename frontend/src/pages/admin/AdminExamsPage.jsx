import React, { useState, useEffect, useCallback } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { apiClient, ensureArray } from '@/lib/apiClient'
import { mapClientError } from '@/lib/clientErrorMapper'
import { AsyncStateView } from '@/components/common/AsyncStateView'
import { UserCheck, Calendar, Clock, BookOpen } from 'lucide-react'
import TableSkeleton from '@/components/common/TableSkeleton'
import EmptyState from '@/components/common/EmptyState'

export default function AdminExamsPage() {
  const [exams, setExams] = useState([])
  const [invigilators, setInvigilators] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedInvigilatorId, setSelectedInvigilatorId] = useState('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [examsRes, usersRes] = await Promise.allSettled([
        apiClient.get('/exams'),
        apiClient.get('/users?role=INVIGILATOR'), // terms-ok: internal role API
      ])
      if (examsRes.status === 'rejected') {
        setLoadError(mapClientError(examsRes.reason, 'Failed to load exams'))
      } else {
        setExams(ensureArray(examsRes.value.data?.exams || examsRes.value.data))
      }
      if (usersRes.status === 'fulfilled') {
        setInvigilators(ensureArray(usersRes.value.data?.users || usersRes.value.data))
      }
    } catch (err) {
      setLoadError(mapClientError(err, 'Failed to load exams'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedExam || !selectedInvigilatorId) return
    setSubmitting(true)
    try {
      await apiClient.post(`/exams/${selectedExam.id}/assign`, {
        userId: selectedInvigilatorId,
        role: 'INVIGILATOR', // terms-ok: internal role enum
      })
      setMsg({ text: `Invigilator assigned to ${selectedExam.title} successfully.`, type: 'success' }) // terms-ok: role assignment feedback
      setAssignDialogOpen(false)
      setSelectedInvigilatorId('')
      loadData()
    } catch (err) {
      const mapped = mapClientError(err, 'Failed to assign invigilator')
      setMsg({ text: mapped.message, type: 'error' }) // terms-ok: role assignment error
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
        <div className="p-3 rounded-[12px] text-xs font-[420] bg-[#edecfb] text-[#28253b] border-0">
          {msg.text}
        </div>
      )}

      {loadError && exams.length === 0 && !loading ? (
        <AsyncStateView
          state="error"
          error={loadError}
          onRetry={loadData}
        />
      ) : (
        <Card className="border-0 bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-[14px] overflow-hidden font-sans">
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
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
                  <TableSkeleton rows={4} cols={6} />
                ) : exams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={BookOpen}
                        title="No exams registered"
                        description="Assessments created by faculty will appear here for invigilator assignment."
                      />
                    </TableCell>
                  </TableRow>
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
                      <Badge variant="outline" className={`text-xs font-[420] border-0 ${
                        exam.status === 'ACTIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                        exam.status === 'PUBLISHED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                        'bg-[#fbfbff] text-[#70707d]'
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
        </div>

        {/* Mobile Stacked Cards (md:hidden) */}
        <div className="block md:hidden divide-y divide-[#c3c3cc]/20">
          {loading ? (
            <div className="p-4 space-y-3">
              <div className="h-4 bg-[#edecfb] rounded-full w-3/4 animate-pulse" />
              <div className="h-3 bg-[#fbfbff] rounded-full w-1/2 animate-pulse" />
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No exams registered"
              description="Assessments created by faculty will appear here for invigilator assignment."
            />
          ) : (
            exams.map((exam) => (
              <div key={exam.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-[480] text-[#28253b]">{exam.title}</h4>
                    <span className="text-[11px] font-mono text-[#554e7b]">{exam.courseCode}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs font-[420] border-0 ${
                    exam.status === 'ACTIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                    exam.status === 'PUBLISHED' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                    'bg-[#fbfbff] text-[#70707d]'
                  }`}>
                    {exam.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#554e7b]">
                  <span>Duration: {exam.durationMinutes} mins</span>
                  <span>{new Date(exam.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-10 text-xs gap-1.5 rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-transparent font-[420] cursor-pointer justify-center"
                  onClick={() => {
                    setSelectedExam(exam)
                    setAssignDialogOpen(true)
                  }}
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Assign Invigilator
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
      </Card>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-[480] text-[#28253b]">Assign Invigilator</DialogTitle> {/* // terms-ok: role assignment title */}
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 pt-2">
            <div className="space-y-1 text-sm bg-[#fbfbff] p-3 rounded-[12px] border border-[#e9eaf2]">
              <span className="font-[480] text-[#28253b]">{selectedExam?.title}</span>
              <p className="text-xs text-[#554e7b] font-mono">{selectedExam?.courseCode}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-[420] text-[#554e7b]">Select Invigilator</Label> {/* // terms-ok: role assignment label */}
              <Select value={selectedInvigilatorId} onValueChange={setSelectedInvigilatorId}>
                <SelectTrigger className="w-full h-10 rounded-xl border border-[#c3c3cc]/60 bg-white">
                  <SelectValue placeholder="Choose invigilator" /> {/* // terms-ok: role placeholder */}
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
            <Button type="submit" disabled={submitting || !selectedInvigilatorId} className="w-full h-10 cursor-pointer">
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
