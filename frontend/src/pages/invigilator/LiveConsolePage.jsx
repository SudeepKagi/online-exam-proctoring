import React, { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { getSocket } from '@/lib/socketClient'
import { Monitor, AlertTriangle, UserCheck, ShieldAlert, PauseCircle, PlayCircle, Clock } from 'lucide-react'

export default function LiveConsolePage() {
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    apiClient.get('/exams').then((res) => {
      const list = ensureArray(res.data?.exams || res.data)
      setExams(list)
      if (list.length > 0) setSelectedExamId(list[0].id)
    }).catch(() => {})
  }, [])

  const loadExamRoster = async () => {
    if (!selectedExamId) return
    setLoading(true)
    try {
      const [attemptsRes, logsRes] = await Promise.allSettled([
        apiClient.get(`/exams/${selectedExamId}/attempts`),
        apiClient.get(`/proctoring/exams/${selectedExamId}/logs`),
      ])
      const attemptsList = attemptsRes.status === 'fulfilled' ? ensureArray(attemptsRes.value.data?.attempts || attemptsRes.value.data) : []
      const logs = logsRes.status === 'fulfilled' ? ensureArray(logsRes.value.data?.logs || logsRes.value.data) : []

      const mapped = attemptsList.map((att) => ({
        id: att.id,
        studentName: att.studentName || att.student?.fullName || `Candidate ${att.id?.substring(0, 8)}`,
        status: att.status || 'IN_PROGRESS',
        violationCount: logs.filter((l) => l.attemptId === att.id).length,
        logs: logs.filter((l) => l.attemptId === att.id),
      }))
      setStudents(mapped)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadExamRoster() }, [selectedExamId])

  useEffect(() => {
    if (!selectedExamId) return
    const socket = getSocket()
    socket.emit('inv:join', { examId: selectedExamId })

    const handleViolation = (data) => {
      setStudents((prev) => prev.map((s) => (
        s.id === data?.attemptId ? { ...s, violationCount: s.violationCount + 1, logs: [data, ...s.logs] } : s
      )))
    }
    socket.on('proctor:violation', handleViolation)
    socket.on('student:violation', handleViolation)
    socket.on('violation:new', handleViolation)
    return () => {
      socket.off('proctor:violation', handleViolation)
      socket.off('student:violation', handleViolation)
      socket.off('violation:new', handleViolation)
    }
  }, [selectedExamId])

  const handleToggleSuspend = async () => {
    if (!selectedStudent) return
    setActionLoading(true)
    const isSuspended = selectedStudent.status === 'SUSPENDED'
    const endpoint = isSuspended ? `/attempts/${selectedStudent.id}/resume` : `/attempts/${selectedStudent.id}/suspend`
    try {
      await apiClient.post(endpoint)
      const newStatus = isSuspended ? 'IN_PROGRESS' : 'SUSPENDED'
      setSelectedStudent((p) => ({ ...p, status: newStatus }))
      setStudents((prev) => prev.map((s) => (s.id === selectedStudent.id ? { ...s, status: newStatus } : s)))
    } catch (err) {
      alert(errorMessage(err, 'Failed to update student state'))
    } finally {
      setActionLoading(false)
    }
  }

  const filtered = students.filter((s) => {
    if (filter === 'FLAGGED') return s.violationCount > 0
    if (filter === 'SUSPENDED') return s.status === 'SUSPENDED'
    return true
  })

  return (
    <DashboardShell title="Live Proctoring Console">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="w-64 bg-white border-slate-300">
              <SelectValue placeholder="Select examination" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title} ({e.courseCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 border border-slate-200 rounded-lg">
          {['ALL', 'FLAGGED', 'SUSPENDED'].map((f) => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} onClick={() => setFilter(f)} className={`text-xs h-7 ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
              {f} ({f === 'ALL' ? students.length : f === 'FLAGGED' ? students.filter((s) => s.violationCount > 0).length : students.filter((s) => s.status === 'SUSPENDED').length})
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">
            No active candidates found for this cohort filter.
          </div>
        ) : (
          filtered.map((s) => (
            <Card key={s.id} onClick={() => { setSelectedStudent(s); setSheetOpen(true) }} className="border-slate-200 bg-white hover:border-blue-400 cursor-pointer transition-shadow shadow-xs hover:shadow-md">
              <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-900 truncate">{s.studentName}</CardTitle>
                <Badge variant="outline" className={`text-xs ${s.status === 'SUSPENDED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {s.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <div className="aspect-video bg-slate-900 rounded flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                  <Monitor className="w-5 h-5 text-slate-500" />
                  <span>Realtime Feed Active</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Security Flags:</span>
                  <Badge variant={s.violationCount > 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {s.violationCount} events
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedStudent?.studentName}</SheetTitle>
            <SheetDescription>Realtime telemetry & security audit history</SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Session Status:</span>
              <Badge variant="outline" className={selectedStudent?.status === 'SUSPENDED' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}>
                {selectedStudent?.status}
              </Badge>
            </div>
            <Button onClick={handleToggleSuspend} disabled={actionLoading} variant={selectedStudent?.status === 'SUSPENDED' ? 'default' : 'destructive'} className="w-full text-xs">
              {selectedStudent?.status === 'SUSPENDED' ? <PlayCircle className="w-4 h-4 mr-1.5" /> : <PauseCircle className="w-4 h-4 mr-1.5" />}
              {selectedStudent?.status === 'SUSPENDED' ? 'Resume Attempt' : 'Suspend Attempt'}
            </Button>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">Violation Timeline</h4>
              {selectedStudent?.logs?.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No integrity violations recorded.</p>
              ) : (
                selectedStudent?.logs?.map((l, i) => (
                  <div key={i} className="p-2.5 rounded border border-slate-200 bg-white text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-slate-800">
                      <span>{l.eventType}</span>
                      <span className="text-red-600 font-mono text-[11px]">{l.severity}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{new Date(l.createdAt || Date.now()).toLocaleTimeString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  )
}
