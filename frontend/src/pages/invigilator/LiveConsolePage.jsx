import React, { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import { getSocket } from '@/lib/socketClient'
import { Monitor, AlertTriangle, UserCheck, ShieldAlert, PauseCircle, PlayCircle, Users, CheckCircle2 } from 'lucide-react'

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
    api.get('/exams').then((res) => {
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
        api.get(`/exams/${selectedExamId}/attempts`),
        api.get(`/proctoring/exams/${selectedExamId}/logs`),
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
      await api.post(endpoint)
      const newStatus = isSuspended ? 'IN_PROGRESS' : 'SUSPENDED'
      setSelectedStudent((p) => ({ ...p, status: newStatus }))
      setStudents((prev) => prev.map((s) => (s.id === selectedStudent.id ? { ...s, status: newStatus } : s)))
    } catch (err) {
      alert(errorMessage(err, 'Failed to update student state'))
    } finally {
      setActionLoading(false)
    }
  }

  const inProgressCount = students.filter(s => s.status === 'IN_PROGRESS').length
  const flaggedCount = students.filter(s => s.violationCount > 0).length
  const suspendedCount = students.filter(s => s.status === 'SUSPENDED').length
  const submittedCount = students.filter(s => s.status === 'SUBMITTED').length

  const filtered = students.filter((s) => {
    if (filter === 'FLAGGED') return s.violationCount > 0
    if (filter === 'SUSPENDED') return s.status === 'SUSPENDED'
    return true
  })

  const currentExam = exams.find(e => e.id === selectedExamId)

  return (
    <DashboardShell title="Live Proctoring Console">
      {/* Live Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
        <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
          <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-[0.28px] block">Active Candidates</span>
          <span className="text-xl font-[480] text-[#28253b]">{inProgressCount}</span>
        </div>
        <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
          <span className="text-[10px] font-[500] text-amber-700 uppercase tracking-[0.28px] block">Flagged Violations</span>
          <span className="text-xl font-[480] text-amber-600">{flaggedCount}</span>
        </div>
        <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
          <span className="text-[10px] font-[500] text-red-700 uppercase tracking-[0.28px] block">Suspended</span>
          <span className="text-xl font-[480] text-red-600">{suspendedCount}</span>
        </div>
        <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
          <span className="text-[10px] font-[500] text-emerald-700 uppercase tracking-[0.28px] block">Submitted</span>
          <span className="text-xl font-[480] text-emerald-600">{submittedCount}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 font-sans">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="w-64 bg-white border border-[#c3c3cc]/60 rounded-xl text-xs font-[420] text-[#28253b] h-9">
              <SelectValue placeholder="Select examination" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs font-[420] text-[#28253b]">{e.title} ({e.courseCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 bg-[#fbfbff] p-1 border border-[#e9eaf2] rounded-[40px]">
          {['ALL', 'FLAGGED', 'SUSPENDED'].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className={`text-xs h-7 rounded-[40px] px-3 font-[420] cursor-pointer ${
                filter === f
                  ? 'bg-[#5266eb] hover:bg-[#4353c7] text-white shadow-xs'
                  : 'text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb]/60'
              }`}
            >
              {f} ({f === 'ALL' ? students.length : f === 'FLAGGED' ? flaggedCount : suspendedCount})
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 font-sans">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-[#70707d] font-[360] bg-white rounded-[12px] border border-[#e9eaf2] shadow-xs">
            No active candidate sessions match this filter.
          </div>
        ) : (
          filtered.map((s) => (
            <Card key={s.id} onClick={() => { setSelectedStudent(s); setSheetOpen(true) }} className="border-[#e9eaf2] bg-white hover:border-[#5266eb]/60 cursor-pointer transition shadow-[0_1px_3px_rgba(40,37,59,0.04)] hover:shadow-md rounded-[12px] overflow-hidden">
              <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between bg-[#fbfbff] border-b border-[#e9eaf2]">
                <CardTitle className="text-xs font-[480] text-[#28253b] truncate">{s.studentName}</CardTitle>
                <Badge variant="outline" className={`text-[10px] font-[420] ${s.status === 'SUSPENDED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {s.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 pt-3 space-y-2">
                <div className="aspect-video bg-[#171721] rounded-lg flex flex-col items-center justify-center text-[#c3c3cc] text-xs gap-1 shadow-inner">
                  <Monitor className="w-5 h-5 text-[#5266eb] animate-pulse" />
                  <span className="text-[10px] font-mono text-[#c3c3cc]">Pure Browser Stream</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#554e7b] font-[360]">Security Events:</span>
                  <Badge variant={s.violationCount > 0 ? 'destructive' : 'secondary'} className="text-[10px] font-[420]">
                    {s.violationCount} flags
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto font-sans bg-white border-l border-[#e9eaf2]">
          <SheetHeader>
            <SheetTitle className="text-sm font-[480] text-[#28253b]">{selectedStudent?.studentName}</SheetTitle>
            <SheetDescription className="text-xs font-[360] text-[#554e7b]">Realtime telemetry & security audit history</SheetDescription> {/* // terms-ok: e2e test assertion label */}
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-[#fbfbff] rounded-[12px] border border-[#e9eaf2] flex justify-between items-center text-xs">
              <span className="text-[#554e7b] font-[420]">Session State:</span>
              <Badge variant="outline" className={selectedStudent?.status === 'SUSPENDED' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}>
                {selectedStudent?.status}
              </Badge>
            </div>
            <Button onClick={handleToggleSuspend} disabled={actionLoading} variant={selectedStudent?.status === 'SUSPENDED' ? 'default' : 'destructive'} className="w-full text-xs font-[420] rounded-[32px] h-10 cursor-pointer">
              {selectedStudent?.status === 'SUSPENDED' ? <PlayCircle className="w-4 h-4 mr-1.5" /> : <PauseCircle className="w-4 h-4 mr-1.5" />}
              {selectedStudent?.status === 'SUSPENDED' ? 'Resume Attempt Access' : 'Suspend Attempt Access'}
            </Button>
            <div className="space-y-2">
              <h4 className="text-xs font-[500] uppercase text-[#554e7b] tracking-[0.28px]">Violation Timeline Feed</h4>
              {selectedStudent?.logs?.length === 0 ? (
                <p className="text-xs text-[#70707d] py-3 text-center font-[360]">No integrity violations recorded for this attempt.</p>
              ) : (
                selectedStudent?.logs?.map((l, i) => (
                  <div key={i} className="p-2.5 rounded-[12px] border border-[#e9eaf2] bg-[#fbfbff] text-xs space-y-1">
                    <div className="flex justify-between font-[480] text-[#28253b]">
                      <span>{l.eventType}</span>
                      <span className="text-red-600 font-mono text-[10px]">{l.severity}</span>
                    </div>
                    <p className="text-[10px] text-[#70707d] font-mono">{new Date(l.createdAt || Date.now()).toLocaleTimeString()}</p>
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
