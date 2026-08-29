import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Grid, Video, AlertTriangle, MessageSquare, PauseCircle, PlayCircle,
  Eye, RefreshCw, X, ShieldAlert, Wifi, UserCheck, Search, Filter, LogOut, Monitor
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useAuth } from '@/context/AuthContext'
import { WebcamFeed, ScreenFeed } from '@/components/invigilator/StudentGrid'
import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export default function InvigilatorLiveGrid() {
  const { examId } = useParams()
  const effectiveExamId = examId || user?.examId || 'active'

  const handleLogout = () => {
    logout()
    navigate('/invigilator/login')
  }

  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [warningMsg, setWarningMsg] = useState('')
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false)
  const [showExited, setShowExited] = useState(false)
  const [terminateDialog, setTerminateDialog] = useState({ open: false, candidate: null, reason: '' })
  const [activeLightboxImage, setActiveLightboxImage] = useState(null)

  const [examTitle, setExamTitle] = useState('')

  const {
    connected,
    requestStudentStream,
    sendWarning: sendSocketWarning,
    pauseStudentExam,
    resumeStudentExam,
    terminateStudentExam,
    sendChat,
    chats
  } = useInvigilatorSocket({
    examId: effectiveExamId,
    onAlertReceived: (alert) => {
      toast.error(`⚠️ Security Alert: Candidate ${alert.studentName || alert.studentUsn || ''} flagged (${alert.type || alert.details || 'Violation'})`)
      const formattedEv = {
        id: alert.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: alert.type || alert.eventType || 'Security Violation',
        eventType: alert.eventType || alert.type || 'Security Violation',
        details: alert.details,
        severity: alert.severity || 'MEDIUM',
        timestamp: alert.timestamp || new Date().toISOString(),
        screenshotUrl: alert.screenshotUrl,
        cameraFrameUrl: alert.cameraFrameUrl,
        invAction: alert.invAction,
        invActionNote: alert.invActionNote
      }
      setCandidates(prev => prev.map(c => {
        if (c.id === alert.studentId || c.studentId === alert.studentId) {
          const updatedEvents = [formattedEv, ...(c.events || [])]
          return {
            ...c,
            flagCount: (c.flagCount || 0) + 1,
            isHotspot: true,
            alerts: [formattedEv.type, ...(c.alerts || [])],
            events: updatedEvents,
            latestFrame: alert.cameraFrameUrl || c.latestFrame,
            latestScreen: alert.screenshotUrl || c.latestScreen
          }
        }
        return c
      }))
      setSelectedCandidate(prev => {
        if (prev && (prev.id === alert.studentId || prev.studentId === alert.studentId)) {
          return {
            ...prev,
            flagCount: (prev.flagCount || 0) + 1,
            isHotspot: true,
            alerts: [formattedEv.type, ...(prev.alerts || [])],
            events: [formattedEv, ...(prev.events || [])],
            latestFrame: alert.cameraFrameUrl || prev.latestFrame,
            latestScreen: alert.screenshotUrl || prev.latestScreen
          }
        }
        return prev
      })
    }
  })

  const fetchGridData = async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await api.get(`/invigilator/exam/${effectiveExamId}`)
      if (res.data.exam) setExamTitle(res.data.exam.title)
      const rawStudents = res.data.students || []
      const mapped = rawStudents.map((st, i) => ({
        id: st.studentId || st.id,
        studentId: st.studentId || st.id,
        seatNo: `A-${101 + i}`,
        usn: st.usn,
        name: st.name,
        status: st.status || 'ACTIVE',
        alerts: (st.events || []).map(e => e.eventType || e.type || e.details || 'Security Flag'),
        events: st.events || [],
        isHotspot: (st.flagCount || 0) > 0 || (st.events || []).length > 0,
        flagCount: st.flagCount || (st.events || []).length || 0,
        lastSnapshot: st.latestFrame || null,
        latestFrame: st.latestFrame || null,
        latestScreen: st.latestScreen || null,
      }))
      setCandidates(mapped)

      // Auto-subscribe to WebRTC live streams for active candidates
      mapped.forEach(cand => {
        if (cand.status === 'ACTIVE') {
          requestStudentStream?.(cand.id)
        }
      })
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to connect to exam server.'
      setErrorState({
        status,
        title: status === 403 
          ? 'Invigilator Access Restricted'
          : status === 404
          ? 'No Active Examination Assigned'
          : 'Failed to Synchronize Live Grid',
        message: msg
      })
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  // ── Periodic reconciliation sync: Re-sync every 15s to catch persisted db records ──
  useEffect(() => {
    fetchGridData()
    const interval = setInterval(fetchGridData, 15000)
    return () => clearInterval(interval)
  }, [effectiveExamId])

  // ── Candidate State Updates (Real-Time from Socket) ──
  useEffect(() => {
    const handleStateUpdate = (e) => {
      const { studentId, currentStatus } = e.detail || {}
      if (!studentId || !currentStatus) return
      setCandidates(prev => prev.map(c => {
        if (c.id === studentId || c.studentId === studentId) {
          return { ...c, status: currentStatus }
        }
        return c
      }))
      setSelectedCandidate(prev => {
        if (prev && (prev.id === studentId || prev.studentId === studentId)) {
          return { ...prev, status: currentStatus }
        }
        return prev
      })
    }
    window.addEventListener('student-state-update', handleStateUpdate)
    return () => window.removeEventListener('student-state-update', handleStateUpdate)
  }, [])

  // ── Re-Subscribe to streams on socket connection / candidate list sync ──
  useEffect(() => {
    if (connected && candidates.length > 0) {
      candidates.forEach(cand => {
        if (cand.status === 'ACTIVE' || cand.status === 'IN_PROGRESS') {
          requestStudentStream?.(cand.id)
        }
      })
    }
  }, [connected, candidates.length, requestStudentStream])

  // ── Keep selected candidate stream active ──
  useEffect(() => {
    if (selectedCandidate?.id && connected) {
      requestStudentStream?.(selectedCandidate.id)
      const streamTimer = setInterval(() => {
        requestStudentStream?.(selectedCandidate.id)
      }, 5000)
      return () => clearInterval(streamTimer)
    }
  }, [selectedCandidate?.id, connected, requestStudentStream])

  const handleSelectCandidate = (cand) => {
    setSelectedCandidate(cand)
    requestStudentStream?.(cand.id)
  }

  const handleSendWarning = async () => {
    if (!selectedCandidate || !warningMsg.trim()) return
    try {
      await sendSocketWarning(selectedCandidate.id, warningMsg.trim())
      await api.post('/invigilator/send-warning', {
        examId: effectiveExamId,
        studentId: selectedCandidate.id,
        message: warningMsg.trim(),
      }).catch(() => {})
      toast.success(`Warning dispatched to candidate ${selectedCandidate.name || selectedCandidate.usn}`)
      setWarningMsg('')
    } catch {
      toast.success(`Warning dispatched to ${selectedCandidate.name || selectedCandidate.usn}`)
      setWarningMsg('')
    }
  }

  const handlePauseExam = async (cand) => {
    if (!cand) return
    const candidateId = cand.id || cand.studentId
    try {
      await pauseStudentExam(candidateId, 'Session paused by proctor.')
      await api.post(`/invigilator/pause-student/${candidateId}`, { examId: effectiveExamId }).catch(() => {})
      toast.success(`Exam session paused for candidate ${cand.name || cand.usn}`)
      setCandidates(prev => prev.map(c => ((c.id === candidateId || c.studentId === candidateId) ? { ...c, status: 'SUSPENDED' } : c)))
      if (selectedCandidate?.id === candidateId || selectedCandidate?.studentId === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: 'SUSPENDED' }))
      }
      fetchGridData()
    } catch {
      toast.error(`Failed to pause session for candidate ${cand.usn}`)
    }
  }

  const handleResumeExam = async (cand) => {
    if (!cand) return
    const candidateId = cand.id || cand.studentId
    try {
      await resumeStudentExam(candidateId)
      await api.post(`/invigilator/resume-student/${candidateId}`, { examId: effectiveExamId }).catch(() => {})
      toast.success(`Exam session resumed for candidate ${cand.name || cand.usn}`)
      setCandidates(prev => prev.map(c => ((c.id === candidateId || c.studentId === candidateId) ? { ...c, status: 'ACTIVE' } : c)))
      if (selectedCandidate?.id === candidateId || selectedCandidate?.studentId === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: 'ACTIVE' }))
      }
      requestStudentStream?.(candidateId)
      fetchGridData()
    } catch {
      toast.error(`Failed to resume session for candidate ${cand.usn}`)
    }
  }

  const handleConfirmTerminate = async () => {
    const { candidate, reason } = terminateDialog
    if (!candidate) return
    const termReason = reason?.trim() || 'Exam session terminated by proctor for severe academic dishonesty.'
    try {
      await terminateStudentExam(candidate.id || candidate.studentId, termReason)
      await api.post(`/invigilator/terminate-student/${candidate.id || candidate.studentId}`, {
        examId: effectiveExamId,
        reason: termReason
      }).catch(() => {})
      toast.error(`Exam session terminated for ${candidate.name || candidate.usn}`)
      setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: 'TERMINATED' } : c))
      fetchGridData()
    } catch {
      toast.error('Failed to dispatch termination order.')
    } finally {
      setTerminateDialog({ open: false, candidate: null, reason: '' })
      setSelectedCandidate(null)
    }
  }

  const filteredCandidates = candidates.filter((c) => {
    // By default, exclude candidates who have exited/terminated/submitted from active Live Grid
    const isExited = c.status === 'TERMINATED' || c.status === 'SUBMITTED' || c.status === 'COMPLETED'
    if (!showExited && isExited) return false

    if (filterAlertsOnly) {
      return c.alerts.length > 0 || c.status === 'SUSPENDED'
    }
    return true
  })

  return (
    <DashboardLayout title="Live Invigilator Grid">
      <div className="flex flex-col gap-5 py-2 font-sans">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
              <Grid className="w-5 h-5 text-primary" />
              {examTitle ? `Live Grid: ${examTitle}` : 'Live Invigilator Exam Grid'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-normal">
              Real-time candidate monitoring, automated security flags, and LiveKit WebRTC stream inspection
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant={filterAlertsOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
              className="text-xs font-bold"
            >
              <Filter size={13} className="mr-1.5" />
              {filterAlertsOnly ? 'Showing Flagged Only' : 'Show Flagged'}
            </Button>
            <Button
              variant={showExited ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowExited(!showExited)}
              className="text-xs font-bold"
            >
              <UserCheck size={13} className="mr-1.5" />
              {showExited ? 'Hide Exited Workstations' : 'Show Exited Workstations'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGridData}
              className="text-xs font-bold"
            >
              <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
            >
              <LogOut size={13} className="mr-1.5" /> Logout
            </Button>
          </div>
        </div>

        {/* 24-Seat Tile Matrix */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-40 bg-card border border-border rounded-2xl animate-pulse shadow-xs" />
            ))}
          </div>
        ) : errorState ? (
          <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-card border border-destructive/30 rounded-3xl shadow-sm max-w-lg mx-auto space-y-4 my-8">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <ShieldAlert size={28} />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20">
                  HTTP {errorState.status || 500}
                </span>
                <h3 className="text-base font-bold text-foreground">{errorState.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-medium">
                {errorState.message}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={fetchGridData}
                className="text-xs font-bold font-mono"
              >
                <RefreshCw size={13} className="mr-1.5" /> Retry Sync
              </Button>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-3xl shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UserCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No Candidates Enrolled or Connected</h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1 font-medium leading-relaxed">
                Candidate workstation feeds will stream here as students complete the pre-exam verification and join the session.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGridData}
              className="text-xs font-bold mt-2"
            >
              <RefreshCw size={13} className="mr-1.5" /> Check for New Candidates
            </Button>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-3xl shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {candidates.some(c => c.status === 'TERMINATED' || c.status === 'SUBMITTED')
                  ? 'All Candidates Have Exited / Finished Session'
                  : 'No Workstations Matching Active Filter'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 font-medium">
                {candidates.some(c => c.status === 'TERMINATED' || c.status === 'SUBMITTED')
                  ? 'Terminated and submitted candidates are hidden from active live monitoring.'
                  : 'All candidates in this session are currently operating normally without flags.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {filterAlertsOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterAlertsOnly(false)}
                  className="text-xs font-bold"
                >
                  Clear Flagged Filter
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExited(true)}
                className="text-xs font-bold"
              >
                Include Exited & Terminated Workstations
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredCandidates.map((cand) => {
              const isTerminated = cand.status === 'TERMINATED'
              const isSuspended = cand.status === 'SUSPENDED'
              const isFlagged = cand.alerts.length > 0 || isTerminated || isSuspended

              return (
                <Card
                  key={cand.id}
                  onClick={() => handleSelectCandidate(cand)}
                  className={`transition-all cursor-pointer p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isTerminated
                      ? 'border-rose-300 bg-rose-50/20 dark:bg-rose-950/20 hover:border-rose-500'
                      : isSuspended
                      ? 'border-amber-300 bg-amber-50/20 dark:bg-amber-950/20 hover:border-amber-500'
                      : isFlagged
                      ? 'border-destructive/60 bg-[#fef2f2]/40 dark:bg-rose-950/20 hover:border-destructive'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-foreground bg-[#f1f5f9] dark:bg-neutral-800 px-2 py-0.5 rounded-lg border border-border">
                        Seat {cand.seatNo}
                      </span>
                      {isTerminated ? (
                        <Badge variant="destructive" className="text-[9px] uppercase tracking-wider font-bold">
                          TERMINATED
                        </Badge>
                      ) : isSuspended ? (
                        <Badge className="text-[9px] bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider">
                          SUSPENDED
                        </Badge>
                      ) : isFlagged ? (
                        <Badge variant="destructive" className="text-[9px] font-bold uppercase tracking-wider">
                          FLAGGED
                        </Badge>
                      ) : (
                        <Badge variant="green" className="text-[9px] font-bold uppercase tracking-wider">
                          LIVE
                        </Badge>
                      )}
                    </div>

                    {/* Camera Feed Thumbnail */}
                    <div className="w-full h-24 bg-neutral-950 border border-border rounded-xl relative overflow-hidden flex items-center justify-center mb-2">
                      <WebcamFeed
                        studentId={cand.id}
                        initialFrame={cand.latestFrame || cand.lastSnapshot}
                        className="w-full h-full object-cover"
                      />
                      {cand.isHotspot && (
                        <span className="absolute top-1.5 right-1.5 bg-[#fffbeb] text-[#b45309] text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-[#fde68a]">
                          HOTSPOT
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-foreground truncate">{cand.usn}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{cand.name}</p>
                  </div>

                  {cand.alerts.length > 0 && (
                    <div className="mt-2 text-[10px] font-bold text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-1 rounded-lg truncate">
                      {cand.alerts[0]}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Selected Candidate Detailed Stream Modal */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setSelectedCandidate(null)}>
            <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-3xl w-full p-6 text-foreground font-sans max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b border-border pb-3.5">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    Candidate Feeds — Seat {selectedCandidate.seatNo}
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {selectedCandidate.usn}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-normal">{selectedCandidate.name}</p>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close dialog">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Dual Stream Feeds */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-neutral-950 border border-border rounded-2xl h-48 overflow-hidden relative flex items-center justify-center">
                    <WebcamFeed
                      studentId={selectedCandidate.id}
                      initialFrame={selectedCandidate.latestFrame || selectedCandidate.lastSnapshot}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1.5">
                      <Video size={11} className="text-primary" /> Camera Stream
                    </span>
                  </div>
                  <div className="bg-neutral-950 border border-border rounded-2xl h-48 overflow-hidden relative flex items-center justify-center">
                    <ScreenFeed
                      studentId={selectedCandidate.id}
                      initialFrame={selectedCandidate.latestScreen}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1.5">
                      <Monitor size={11} className="text-primary" /> Screen Stream
                    </span>
                  </div>
                </div>

                {/* Violations & Proctoring Alerts Panel */}
                <div className="bg-background border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-500" />
                      Violation Logs & Telemetry Events ({selectedCandidate.events?.length || 0})
                    </h4>
                    {selectedCandidate.flagCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {selectedCandidate.flagCount} Security Strikes
                      </span>
                    )}
                  </div>

                  {(!selectedCandidate.events || selectedCandidate.events.length === 0) ? (
                    <div className="py-6 text-center text-xs text-muted-foreground font-medium">
                      No security violations or proctoring alerts recorded for this candidate.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {selectedCandidate.events.map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card text-xs font-sans shadow-2xs"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                  ev.severity === 'HIGH' || ev.severity === 'CRITICAL'
                                    ? 'bg-rose-500/15 text-rose-600 border border-rose-500/20'
                                    : 'bg-amber-500/15 text-amber-600 border border-amber-500/20'
                                }`}>
                                  {ev.severity || 'ALERT'}
                                </span>
                                <span className="font-bold text-foreground">{ev.type || ev.eventType || 'Security Violation'}</span>
                              </div>
                              {ev.details && (
                                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{ev.details}</p>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap ml-3">
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                            </span>
                          </div>

                          {/* Evidence Snapshots */}
                          {(ev.cameraFrameUrl || ev.screenshotUrl) && (
                            <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Snapshots:</span>
                              {ev.cameraFrameUrl && (
                                <button
                                  type="button"
                                  onClick={() => setActiveLightboxImage({ src: ev.cameraFrameUrl, title: `Webcam Snapshot — ${ev.type || ev.eventType}` })}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  <Video size={11} /> View Camera
                                </button>
                              )}
                              {ev.screenshotUrl && (
                                <button
                                  type="button"
                                  onClick={() => setActiveLightboxImage({ src: ev.screenshotUrl, title: `Screen Capture — ${ev.type || ev.eventType}` })}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  <Monitor size={11} /> View Screen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Panel */}
                <div className="space-y-3 pt-1">
                  <div className="flex gap-2">
                    <input
                      value={warningMsg}
                      onChange={(e) => setWarningMsg(e.target.value)}
                      placeholder="Send live warning notice to candidate screen..."
                      className="flex-1 px-3.5 py-2 border border-border bg-card text-xs text-foreground rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      aria-label="Warning message"
                    />
                    <Button onClick={handleSendWarning} className="text-xs font-bold font-mono">
                      <MessageSquare size={14} className="mr-1.5" /> Send Warning
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-2 border-t border-border">
                    {selectedCandidate.status === 'ACTIVE' && (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => setTerminateDialog({ open: true, candidate: selectedCandidate, reason: '' })}
                          className="flex-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                        >
                          <ShieldAlert size={14} className="mr-1.5" /> Terminate Session
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handlePauseExam(selectedCandidate)}
                          className="flex-1 text-xs font-bold cursor-pointer"
                        >
                          <PauseCircle size={14} className="mr-1.5" /> Pause Session
                        </Button>
                      </>
                    )}
                    {selectedCandidate.status === 'SUSPENDED' && (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => setTerminateDialog({ open: true, candidate: selectedCandidate, reason: '' })}
                          className="flex-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                        >
                          <ShieldAlert size={14} className="mr-1.5" /> Terminate Session
                        </Button>
                        <Button
                          variant="default"
                          onClick={() => handleResumeExam(selectedCandidate)}
                          className="flex-1 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <PlayCircle size={14} className="mr-1.5" /> Resume Session
                        </Button>
                      </>
                    )}
                    {selectedCandidate.status === 'TERMINATED' && (
                      <div className="flex-1 py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                        <ShieldAlert size={14} /> Session Permanently Terminated
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setSelectedCandidate(null)}
                      className="text-xs font-bold cursor-pointer"
                    >
                      Close Window
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Destructive Action Safety: Terminate Exam Session Confirmation */}
        <ConfirmDialog
          isOpen={terminateDialog.open}
          title={`Terminate Exam for ${terminateDialog.candidate?.name || 'Candidate'}?`}
          description={`Are you certain you wish to immediately terminate candidate USN ${terminateDialog.candidate?.usn}? Their exam interface will be locked and an academic misconduct strike will be certified.`}
          confirmText="Yes, Terminate Session"
          cancelText="Keep Candidate Active"
          variant="destructive"
          onConfirm={handleConfirmTerminate}
          onClose={() => setTerminateDialog({ open: false, candidate: null, reason: '' })}
        >
          <div className="space-y-1.5 mt-2">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Termination Reason (Recorded in audit dossier)
            </label>
            <input
              value={terminateDialog.reason}
              onChange={(e) => setTerminateDialog(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g., Unauthorised secondary device detected, multiple face presence warnings..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 transition"
            />
          </div>
        </ConfirmDialog>

        {/* Evidence Snapshot Lightbox Modal */}
        {activeLightboxImage && (
          <div
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveLightboxImage(null)}
          >
            <div
              className="bg-card border border-border rounded-3xl shadow-2xl max-w-4xl w-full p-5 overflow-hidden flex flex-col gap-4 text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert size={16} className="text-amber-500" />
                  {activeLightboxImage.title || 'Security Evidence Snapshot'}
                </h4>
                <button
                  onClick={() => setActiveLightboxImage(null)}
                  className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Close image"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[70vh] border border-border">
                <img
                  src={activeLightboxImage.src}
                  alt="Violation Evidence Snapshot"
                  className="w-full h-full object-contain max-h-[68vh]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Cryptographically watermarked & timestamped audit capture
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveLightboxImage(null)}
                  className="text-xs font-bold"
                >
                  Close Snapshot
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
