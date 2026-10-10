import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api, { extractErrorMessage } from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Grid, Video, AlertTriangle, MessageSquare, PauseCircle, PlayCircle,
  Eye, RefreshCw, X, ShieldAlert, Wifi, UserCheck, Search, Filter, LogOut, Monitor, Cpu
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useAuth } from '@/context/AuthContext'
import { WebcamFeed, ScreenFeed } from '@/components/invigilator/StudentGrid'
import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useRosterStore, rosterStore } from '@/lib/rosterStore'
import { ProctorViewer } from '@/lib/proctorViewer'

const PAGE_SIZE = 12

export default function InvigilatorLiveGrid() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const effectiveExamId = examId || user?.examId || 'active'

  const handleLogout = () => {
    logout?.()
    navigate('/invigilator/login')
  }

  const rosterSnapshot = useRosterStore()
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState(null)
  const [examTitle, setExamTitle] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [warningMsg, setWarningMsg] = useState('')
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false)
  const [showExited, setShowExited] = useState(false)
  const [terminateDialog, setTerminateDialog] = useState({ open: false, candidate: null, reason: '' })
  const [activeLightboxImage, setActiveLightboxImage] = useState(null)
  const [page, setPage] = useState(1)
  const [violationSeverityFilter, setViolationSeverityFilter] = useState('ALL')
  const [violationTypeFilter, setViolationTypeFilter] = useState('ALL')
  const [violationPage, setViolationPage] = useState(1)

  // R3: snapshot driver state
  const [mediaDriver, setMediaDriver] = useState('snapshot') // default, overwritten from /config
  // snapshotFrames: { [attemptId]: { frameAt: number, cameraUrl: string, screenUrl: string } }
  const [snapshotFrames, setSnapshotFrames] = useState({})
  const tileRefs = useRef({}) // attemptId -> DOM element ref (for IntersectionObserver)
  const observerRef = useRef(null)
  const visibleTilesRef = useRef(new Set()) // currently intersecting tile attemptIds
  const focusRefreshTimer = useRef(null)

  // Fetch media driver from /config on mount
  useEffect(() => {
    api.get('/config').then(res => {
      setMediaDriver(res.data?.mediaDriver || 'snapshot')
    }).catch(() => {})
  }, [])

  // Auth guard: R-09 redirect to login if unauthenticated
  useEffect(() => {
    if (!user) {
      navigate('/invigilator/login')
    }
  }, [user, navigate])

  // ── R3: Snapshot driver — IntersectionObserver + frame:update socket listener ─────
  const { socket: invSocket } = useInvigilatorSocket
    ? /* already available via hook below */ {}
    : {}

  // R3 helper: fetch fresh presigned read URLs for a focused candidate
  const fetchSnapshotFrame = useCallback(async (attemptId) => {
    if (!attemptId) return
    try {
      const res = await api.get(`/attempts/${attemptId}/snapshots/read`)
      const { cameraUrl, screenUrl, frameAt } = res.data
      setSnapshotFrames(prev => ({
        ...prev,
        [attemptId]: { cameraUrl, screenUrl, frameAt: frameAt || Date.now() }
      }))
    } catch (_) {}
  }, [])

  // FLW-05 helper: batch fetch fresh presigned read URLs for visible candidates (up to 24)
  const fetchBatchSnapshots = useCallback(async (attemptIds) => {
    if (!attemptIds || attemptIds.length === 0 || !effectiveExamId) return
    try {
      const res = await api.post(`/proctoring/exams/${effectiveExamId}/snapshots/read`, {
        attemptIds: attemptIds.slice(0, 24)
      })
      if (res.data?.snapshots) {
        setSnapshotFrames(prev => ({
          ...prev,
          ...res.data.snapshots
        }))
      }
    } catch (_) {}
  }, [effectiveExamId])

  // LiveKit WebRTC SFU Subscribed Tracks state: attemptId -> { camera: Track, screen: Track }
  const [subscribedTracks, setSubscribedTracks] = useState({})
  const viewerRef = useRef(null)

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

      const candId = alert.attemptId || alert.studentId
      if (candId) {
        rosterStore.updateCandidate(candId, {
          flagCount: (rosterSnapshot.rosterMap?.get?.(candId)?.flagCount || 0) + 1,
          isHotspot: true,
          latestFrame: alert.cameraFrameUrl,
          latestScreen: alert.screenshotUrl
        })
      }

      // Promote flagged candidate on SFU for 60s
      if (viewerRef.current && candId) {
        viewerRef.current.handleSecurityAlert(candId)
      }

      setSelectedCandidate(prev => {
        if (prev && (prev.id === candId || prev.studentId === candId || prev.attemptId === candId)) {
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

  // ── Fetch Roster, Summary, and Violations from V1 API (R2) ──
  const fetchGridData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setErrorState(null)
    }
    try {
      // 1. Fetch Exam details
      const examRes = await api.get(`/invigilator/exam/${effectiveExamId}`).catch(() => null)
      if (examRes?.data?.exam) setExamTitle(examRes.data.exam.title)

      // 2. Fetch v1 Summary & Roster & Violations
      const [summaryRes, rosterRes, violationsRes] = await Promise.all([
        api.get(`/proctoring/exams/${effectiveExamId}/summary`).catch(() => null),
        api.get(`/proctoring/exams/${effectiveExamId}/roster?limit=100`).catch(() => null),
        api.get(`/proctoring/exams/${effectiveExamId}/violations?limit=50`).catch(() => null)
      ])

      const summary = summaryRes?.data || null
      let rosterItems = rosterRes?.data?.items || []
      const examViolationsList = violationsRes?.data?.items || []

      // Fallback to legacy exam students if v1 roster returned empty in legacy test env
      if (rosterItems.length === 0 && examRes?.data?.students) {
        rosterItems = examRes.data.students.map((st, i) => {
          const candV = examViolationsList.filter(v => v.attemptId === (st.attemptId || st.id || st.studentId))
          const mergedEvents = (st.events || []).concat(candV)
          return {
            attemptId: st.attemptId || st.studentId || st.id,
            studentId: st.studentId || st.id,
            seatNo: `A-${101 + i}`,
            usn: st.usn,
            name: st.name,
            status: st.status || 'ACTIVE',
            alerts: mergedEvents.map(e => e.eventType || e.type || e.details || 'Security Flag'),
            events: mergedEvents,
            isHotspot: (st.flagCount || 0) > 0 || mergedEvents.length > 0,
            flagCount: Math.max(st.flagCount || 0, mergedEvents.length),
            lastSnapshot: candV[0]?.thumbUrl || st.latestFrame || null,
            latestFrame: candV[0]?.thumbUrl || st.latestFrame || null,
            latestScreen: candV[0]?.metadata?.screenUrl || st.latestScreen || null
          }
        })
      } else {
        rosterItems = rosterItems.map((item, i) => {
          const candV = examViolationsList.filter(v => v.attemptId === (item.attemptId || item.id))
          const existingEvents = item.events || []
          const mergedEvents = existingEvents.concat(candV.filter(cv => !existingEvents.some(ie => ie.id === cv.id)))
          return {
            ...item,
            id: item.attemptId || item.studentId || item.id,
            seatNo: item.seatNo || `A-${101 + i}`,
            alerts: mergedEvents.map(e => e.eventType || e.type || e.details || 'Security Flag'),
            events: mergedEvents,
            isHotspot: (item.flagCount || 0) > 0 || mergedEvents.length > 0,
            latestFrame: candV[0]?.thumbUrl || item.thumbUrl || item.latestFrame || null,
            latestScreen: candV[0]?.metadata?.screenUrl || item.latestScreen || null
          }
        })
      }

      rosterStore.initExam(effectiveExamId, rosterItems, summary)
    } catch (err) {
      const status = err.response?.status
      const msg = extractErrorMessage(err, 'Unable to connect to exam server.')
      if (status === 401) {
        logout?.()
        navigate('/invigilator/login')
        return
      }
      if (isInitial) {
        setErrorState({
          status,
          title: status === 403
            ? 'Invigilator Access Restricted'
            : status === 404
            ? 'No Active Examination Assigned'
            : 'Failed to Synchronize Live Grid',
          message: msg
        })
      }
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }

  const candidates = rosterSnapshot.items || []

  const filteredCandidates = candidates.filter((c) => {
    const isExited = c.status === 'TERMINATED' || c.status === 'SUBMITTED' || c.status === 'COMPLETED'
    if (!showExited && isExited) return false

    if (filterAlertsOnly) {
      return (c.flagCount || 0) > 0 || c.status === 'SUSPENDED' || (c.alerts && c.alerts.length > 0)
    }
    return true
  })

  // ── Pagination Calculation ──
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const currentCandidates = filteredCandidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ── R3: IntersectionObserver — only visible tiles emit tile_visibility ────────
  // Runs after candidates are rendered; re-runs on page/filter changes.
  useEffect(() => {
    if (mediaDriver !== 'snapshot') return
    if (observerRef.current) observerRef.current.disconnect()

    const { socket: sock } = (typeof useInvigilatorSocket === 'function') ? {} : {}

    const observer = new IntersectionObserver((entries) => {
      let changed = false
      entries.forEach(entry => {
        const attemptId = entry.target.dataset?.candidateId
        if (!attemptId) return
        if (entry.isIntersecting) {
          if (!visibleTilesRef.current.has(attemptId)) {
            visibleTilesRef.current.add(attemptId)
            changed = true
          }
        } else {
          if (visibleTilesRef.current.has(attemptId)) {
            visibleTilesRef.current.delete(attemptId)
            changed = true
          }
        }
      })

      if (changed) {
        const visibleList = Array.from(visibleTilesRef.current)
        // Fetch batch snapshots for visible tiles (FLW-05)
        fetchBatchSnapshots(visibleList)

        // Emit to server so it pushes cadence to each visible student
        const payload = {
          examId: effectiveExamId,
          visibleAttemptIds: visibleList,
          focusedAttemptId: selectedCandidate ? (selectedCandidate.attemptId || selectedCandidate.id) : null
        }
        // Access socket from hook — emit if connected
        if (window.__invSocket?.connected) {
          window.__invSocket.emit('proctor:tile_visibility', payload)
        }
      }
    }, { threshold: 0.1 })

    observerRef.current = observer
    Object.values(tileRefs.current).forEach(el => { if (el) observer.observe(el) })

    return () => observer.disconnect()
  }, [mediaDriver, currentCandidates, effectiveExamId, selectedCandidate, fetchBatchSnapshots])

  // ── R3: Listen for frame:update from server ─────────────────────────────────
  // frame:update: { attemptId, frameAt, examId } — invigilator refreshes cache-busted img src
  useEffect(() => {
    if (mediaDriver !== 'snapshot') return
    const sock = window.__invSocket
    if (!sock) return

    const handler = ({ attemptId, frameAt }) => {
      setSnapshotFrames(prev => ({
        ...prev,
        [attemptId]: { ...(prev[attemptId] || {}), frameAt: frameAt || Date.now() }
      }))
    }
    sock.on('frame:update', handler)
    return () => sock.off('frame:update', handler)
  }, [mediaDriver, window.__invSocket])

  // ── R3: Focus modal snapshot refresh at 1–2 s ──────────────────────────────
  useEffect(() => {
    if (mediaDriver !== 'snapshot') return
    if (focusRefreshTimer.current) {
      clearInterval(focusRefreshTimer.current)
      focusRefreshTimer.current = null
    }
    if (selectedCandidate) {
      const attemptId = selectedCandidate.attemptId || selectedCandidate.id
      fetchSnapshotFrame(attemptId) // immediate
      focusRefreshTimer.current = setInterval(() => fetchSnapshotFrame(attemptId), 1500)
    }
    return () => {
      if (focusRefreshTimer.current) {
        clearInterval(focusRefreshTimer.current)
        focusRefreshTimer.current = null
      }
    }
  }, [selectedCandidate, mediaDriver, fetchSnapshotFrame])

  // ── Initialize LiveKit SFU ProctorViewer ──
  useEffect(() => {
    let activeViewer = null
    let isMounted = true

    async function initLiveKitViewer() {
      try {
        const tokenRes = await api.post('/proctoring/token', {
          examId: effectiveExamId
        })

        if (!isMounted) return

        const { token, wsUrl } = tokenRes.data
        if (!token) return

        const resolvedWsUrl = wsUrl?.startsWith('http') || wsUrl?.startsWith('ws')
          ? wsUrl
          : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsUrl || '/media/'}`

        const viewer = new ProctorViewer({
          wsUrl: resolvedWsUrl,
          token,
          onTrackSubscribed: ({ identity, source, track }) => {
            const cleanId = identity.replace(/^student:/, '')
            setSubscribedTracks(prev => ({
              ...prev,
              [cleanId]: { ...(prev[cleanId] || {}), [source]: track },
              [identity]: { ...(prev[identity] || {}), [source]: track }
            }))
          },
          onTrackUnsubscribed: ({ identity, source }) => {
            const cleanId = identity.replace(/^student:/, '')
            setSubscribedTracks(prev => {
              const cur = prev[cleanId] || {}
              const updated = { ...cur }
              delete updated[source]
              return {
                ...prev,
                [cleanId]: updated,
                [identity]: updated
              }
            })
          },
          onParticipantDisconnected: (participant) => {
            const cleanId = participant.identity.replace(/^student:/, '')
            setSubscribedTracks(prev => {
              const updated = { ...prev }
              delete updated[cleanId]
              delete updated[participant.identity]
              return updated
            })
          }
        })

        await viewer.connect()
        if (isMounted) {
          viewerRef.current = viewer
          activeViewer = viewer
          if (typeof window !== 'undefined') {
            window.__proctorViewer = viewer
          }
        } else {
          viewer.disconnect()
        }
      } catch (err) {
        console.warn('LiveKit SFU ProctorViewer connection deferred or unavailable:', err.message)
      }
    }

    initLiveKitViewer()

    return () => {
      isMounted = false
      if (activeViewer) {
        activeViewer.disconnect()
      }
      viewerRef.current = null
      if (typeof window !== 'undefined') {
        window.__proctorViewer = null
      }
    }
  }, [effectiveExamId])

  // ── Periodic quiet reconciliation sync every 60s (R2: never resets loading) ──
  useEffect(() => {
    fetchGridData(true)
    const interval = setInterval(() => {
      fetchGridData(false)
    }, 60000)
    return () => clearInterval(interval)
  }, [effectiveExamId])

  // ── Sync SFU Subscriptions: LOW quality for visible tiles, HIGH quality for focus view ──
  useEffect(() => {
    if (viewerRef.current) {
      const visibleIdentities = currentCandidates.map(c => c.attemptId || c.id)
      const focusedIdentity = selectedCandidate ? (selectedCandidate.attemptId || selectedCandidate.id) : null
      viewerRef.current.syncVisibleTiles(visibleIdentities, focusedIdentity)
    }
  }, [currentCandidates, selectedCandidate])

  const [candidateAgentStatus, setCandidateAgentStatus] = useState(null)
  const [loadingAgentStatus, setLoadingAgentStatus] = useState(false)
  const [waiverDialog, setWaiverDialog] = useState({ open: false, reason: '' })

  const loadAgentStatus = async (cand) => {
    const candId = cand.attemptId || cand.id || cand.studentId
    if (!candId) return
    setLoadingAgentStatus(true)
    try {
      const res = await api.get(`/attempts/${candId}/agent/status`)
      setCandidateAgentStatus(res.data)
    } catch {
      setCandidateAgentStatus(null)
    } finally {
      setLoadingAgentStatus(false)
    }
  }

  const handleRecheckCompanion = async () => {
    if (!selectedCandidate) return
    const candId = selectedCandidate.attemptId || selectedCandidate.id || selectedCandidate.studentId
    try {
      await api.post(`/staff/attempts/${candId}/agent/recheck`)
      toast.success('Re-check requested for candidate Exam Device Companion')
      setTimeout(() => loadAgentStatus(selectedCandidate), 1000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request re-check')
    }
  }

  const handleGrantWaiver = async () => {
    if (!selectedCandidate || !waiverDialog.reason.trim()) return
    const candId = selectedCandidate.attemptId || selectedCandidate.id || selectedCandidate.studentId
    try {
      await api.post(`/staff/attempts/${candId}/agent/waiver`, { reason: waiverDialog.reason.trim() })
      toast.success('Exam Device Companion waiver granted')
      setWaiverDialog({ open: false, reason: '' })
      loadAgentStatus(selectedCandidate)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grant waiver')
    }
  }

  const handleSelectCandidate = (cand) => {
    setSelectedCandidate(cand)
    setCandidateAgentStatus(null)
    loadAgentStatus(cand)
    if (viewerRef.current) {
      viewerRef.current.setFocusCandidate(cand.attemptId || cand.id)
    }
  }

  const handleCloseModal = () => {
    setSelectedCandidate(null)
    if (viewerRef.current) {
      viewerRef.current.clearFocusCandidate()
    }
  }

  const handleSendWarning = async () => {
    if (!selectedCandidate || !warningMsg.trim()) return
    const candidateId = selectedCandidate.attemptId || selectedCandidate.id || selectedCandidate.studentId
    try {
      await sendSocketWarning?.(candidateId, warningMsg.trim())
      await api.post(`/proctoring/attempts/${candidateId}/warn`, {
        message: warningMsg.trim()
      })
      toast.success(`Warning dispatched to candidate ${selectedCandidate.name || selectedCandidate.usn}`)
      setWarningMsg('')
    } catch (err) {
      toast.error(`Failed to send warning: ${err.response?.data?.message || err.message}`)
    }
  }

  const handlePauseExam = async (cand) => {
    if (!cand) return
    const candidateId = cand.attemptId || cand.id || cand.studentId
    try {
      await pauseStudentExam?.(candidateId, 'Session paused by proctor.')
      await api.post(`/proctoring/attempts/${candidateId}/pause`, { reason: 'Session paused by proctor.' })
      toast.success(`Exam session paused for candidate ${cand.name || cand.usn}`)
      rosterStore.updateCandidate(candidateId, { status: 'SUSPENDED' })
      if (selectedCandidate?.id === candidateId || selectedCandidate?.attemptId === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: 'SUSPENDED' }))
      }
    } catch (err) {
      toast.error(`Failed to pause candidate: ${err.response?.data?.message || err.message}`)
    }
  }

  const handleResumeExam = async (cand) => {
    if (!cand) return
    const candidateId = cand.attemptId || cand.id || cand.studentId
    try {
      await resumeStudentExam?.(candidateId)
      await api.post(`/proctoring/attempts/${candidateId}/resume`)
      toast.success(`Exam session resumed for candidate ${cand.name || cand.usn}`)
      rosterStore.updateCandidate(candidateId, { status: 'ACTIVE' })
      if (selectedCandidate?.id === candidateId || selectedCandidate?.attemptId === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: 'ACTIVE' }))
      }
    } catch (err) {
      toast.error(`Failed to resume candidate: ${err.response?.data?.message || err.message}`)
    }
  }

  const handleConfirmTerminate = async () => {
    const { candidate, reason } = terminateDialog
    if (!candidate) return
    const candidateId = candidate.attemptId || candidate.id || candidate.studentId
    const termReason = reason?.trim() || 'Exam session terminated by proctor for severe academic dishonesty.'
    try {
      await terminateStudentExam?.(candidateId, termReason)
      await api.post(`/proctoring/attempts/${candidateId}/terminate`, { reason: termReason })
      toast.success(`Exam session terminated for ${candidate.name || candidate.usn}`)
      rosterStore.updateCandidate(candidateId, { status: 'TERMINATED' })
    } catch (err) {
      toast.error(`Failed to terminate candidate: ${err.response?.data?.message || err.message}`)
    } finally {
      setTerminateDialog({ open: false, candidate: null, reason: '' })
      handleCloseModal()
    }
  }

  const getCandidateTracks = (cand) => {
    if (!cand) return {}
    return (
      subscribedTracks[cand.attemptId] ||
      subscribedTracks[cand.id] ||
      subscribedTracks[cand.studentId] ||
      subscribedTracks[`student:${cand.attemptId}`] ||
      {}
    )
  }

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

        {/* 12-Seat Tile Matrix */}
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {currentCandidates.map((cand) => {
                const isTerminated = cand.status === 'TERMINATED'
                const isSuspended = cand.status === 'SUSPENDED'
                const isFlagged = (cand.alerts && cand.alerts.length > 0) || cand.flagCount > 0 || isTerminated || isSuspended
                const tracks = getCandidateTracks(cand)

                return (
                  <Card
                    key={cand.id || cand.attemptId}
                    data-candidate-id={cand.id || cand.attemptId}
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

                      {/* Camera Feed Thumbnail — snapshot or LiveKit */}
                      <div
                        ref={el => { tileRefs.current[cand.attemptId || cand.id] = el }}
                        className="w-full h-24 bg-neutral-950 border border-border rounded-xl relative overflow-hidden flex items-center justify-center mb-2"
                      >
                        {mediaDriver === 'snapshot' ? (
                          (() => {
                            const sf = snapshotFrames[cand.attemptId || cand.id]
                            const fallback = cand.latestFrame || cand.lastSnapshot || cand.thumbUrl
                            const src = sf?.cameraUrl
                              ? `${sf.cameraUrl.split('?')[0]}?frameAt=${sf.frameAt}`
                              : fallback
                            return src ? (
                              <img
                                src={src}
                                alt={`Live camera — ${cand.usn}`}
                                className="w-full h-full object-cover"
                                onError={e => { e.currentTarget.style.display = 'none' }}
                              />
                            ) : (
                              <span className="text-[10px] text-neutral-500 font-mono">No frame yet</span>
                            )
                          })()
                        ) : (
                          <WebcamFeed
                            track={tracks.camera}
                            initialFrame={cand.latestFrame || cand.lastSnapshot || cand.thumbUrl}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {cand.isHotspot && (
                          <span className="absolute top-1.5 right-1.5 bg-[#fffbeb] text-[#b45309] text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-[#fde68a]">
                            HOTSPOT
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-foreground truncate">{cand.usn}</p>
                      <p className="text-[11px] text-muted-foreground truncate font-medium">{cand.name}</p>
                    </div>

                    {cand.alerts && cand.alerts.length > 0 && (
                      <div className="mt-2 text-[10px] font-bold text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-1 rounded-lg truncate">
                        {cand.alerts[0]}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-3 px-1">
                <span className="text-xs text-muted-foreground font-medium">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCandidates.length)} of {filteredCandidates.length} workstations
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    className="text-xs font-bold"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-muted rounded-lg text-foreground border border-border">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    className="text-xs font-bold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Selected Candidate Detailed Stream Modal */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={handleCloseModal}>
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
                <button onClick={handleCloseModal} className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close dialog">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Dual Stream Feeds */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-neutral-950 border border-border rounded-2xl h-48 overflow-hidden relative flex items-center justify-center">
                    {mediaDriver === 'snapshot' ? (() => {
                      const sf = snapshotFrames[selectedCandidate.attemptId || selectedCandidate.id]
                      const camSrc = sf?.cameraUrl
                        ? `${sf.cameraUrl.split('?')[0]}?frameAt=${sf.frameAt}`
                        : (selectedCandidate.latestFrame || selectedCandidate.lastSnapshot)
                      return camSrc ? (
                        <img src={camSrc} alt="Live camera feed" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-neutral-500 font-mono">Awaiting snapshot...</span>
                      )
                    })() : (
                      <WebcamFeed
                        track={getCandidateTracks(selectedCandidate).camera}
                        initialFrame={selectedCandidate.latestFrame || selectedCandidate.lastSnapshot || selectedCandidate.thumbUrl}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1.5">
                      <Video size={11} className="text-primary" /> Camera Stream
                    </span>
                  </div>
                  <div className="bg-neutral-950 border border-border rounded-2xl h-48 overflow-hidden relative flex items-center justify-center">
                    {mediaDriver === 'snapshot' ? (() => {
                      const sf = snapshotFrames[selectedCandidate.attemptId || selectedCandidate.id]
                      const scrSrc = sf?.screenUrl
                        ? `${sf.screenUrl.split('?')[0]}?frameAt=${sf.frameAt}`
                        : selectedCandidate.latestScreen
                      return scrSrc ? (
                        <img src={scrSrc} alt="Live screen feed" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-neutral-500 font-mono">Awaiting snapshot...</span>
                      )
                    })() : (
                      <ScreenFeed
                        track={getCandidateTracks(selectedCandidate).screen}
                        initialFrame={selectedCandidate.latestScreen}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1.5">
                      <Monitor size={11} className="text-primary" /> Screen Stream
                    </span>
                  </div>
                </div>

                {/* Exam Device Companion Status Card */}
                <div className="bg-background border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Cpu size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Exam Device Companion</span>
                        {candidateAgentStatus?.waiver ? (
                          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]">WAIVED</Badge>
                        ) : candidateAgentStatus?.state === 'HEALTHY' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">HEALTHY</Badge>
                        ) : candidateAgentStatus?.state === 'STALE' ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">STALE</Badge>
                        ) : candidateAgentStatus?.state === 'BLOCKED' ? (
                          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">BLOCKED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">NONE / NOT PAIRED</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {candidateAgentStatus?.findings?.length > 0
                          ? `${candidateAgentStatus.findings.length} findings: ${candidateAgentStatus.findings.map(f => f.ruleId).join(', ')}`
                          : candidateAgentStatus?.waiver
                          ? `Waiver: ${candidateAgentStatus.waiver.reason}`
                          : candidateAgentStatus?.lastSeenAt
                          ? `Last seen: ${new Date(candidateAgentStatus.lastSeenAt).toLocaleTimeString()}`
                          : 'No companion session active'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRecheckCompanion}
                      disabled={loadingAgentStatus}
                      className="text-xs font-semibold h-8"
                    >
                      <RefreshCw size={12} className={`mr-1.5 ${loadingAgentStatus ? 'animate-spin' : ''}`} />
                      Re-check Now
                    </Button>
                    {!candidateAgentStatus?.waiver && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWaiverDialog({ open: true, reason: '' })}
                        className="text-xs font-semibold h-8 border-purple-500/30 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                      >
                        Grant Waiver
                      </Button>
                    )}
                  </div>
                </div>

                {/* Violations & Proctoring Alerts Panel (R2) */}
                <div className="bg-background border border-border rounded-2xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-500" />
                      Violation Logs & Telemetry Events ({selectedCandidate.events?.length || 0})
                    </h4>
                    <div className="flex items-center gap-2">
                      <select
                        value={violationSeverityFilter}
                        onChange={(e) => { setViolationSeverityFilter(e.target.value); setViolationPage(1) }}
                        className="text-[10px] bg-card border border-border rounded-lg px-2 py-1 text-foreground font-medium"
                      >
                        <option value="ALL">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                      <select
                        value={violationTypeFilter}
                        onChange={(e) => { setViolationTypeFilter(e.target.value); setViolationPage(1) }}
                        className="text-[10px] bg-card border border-border rounded-lg px-2 py-1 text-foreground font-medium max-w-[120px] truncate"
                      >
                        <option value="ALL">All Types</option>
                        <option value="TAB_SWITCH">Tab Switch</option>
                        <option value="FULLSCREEN_EXIT">Fullscreen Exit</option>
                        <option value="MULTIPLE_FACES">Multiple Faces</option>
                        <option value="NO_FACE">No Face</option>
                        <option value="FACE_MISMATCH">Face Mismatch</option>
                        <option value="DEVTOOLS_OPENED">DevTools</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const rawEvents = selectedCandidate.events || []
                    const filtered = rawEvents.filter(ev => {
                      if (violationSeverityFilter !== 'ALL' && (ev.severity || 'MEDIUM').toUpperCase() !== violationSeverityFilter) return false
                      if (violationTypeFilter !== 'ALL' && (ev.type || ev.eventType) !== violationTypeFilter) return false
                      return true
                    })
                    const V_PAGE_SIZE = 4
                    const totalVPages = Math.max(1, Math.ceil(filtered.length / V_PAGE_SIZE))
                    const curVPage = Math.min(violationPage, totalVPages)
                    const pageEvents = filtered.slice((curVPage - 1) * V_PAGE_SIZE, curVPage * V_PAGE_SIZE)

                    if (filtered.length === 0) {
                      return (
                        <div className="py-6 text-center text-xs text-muted-foreground font-medium">
                          {rawEvents.length === 0
                            ? 'No security violations or proctoring alerts recorded for this candidate.'
                            : 'No violations match the selected filters.'}
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-2.5">
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {pageEvents.map((ev, idx) => {
                            const thumbSrc = ev.thumbUrl || ev.cameraFrameUrl || ev.latestFrame
                            const fullSrc = ev.evidenceUrl || ev.cameraFrameUrl || ev.thumbUrl
                            const screenSrc = ev.metadata?.screenUrl || ev.screenshotUrl

                            return (
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
                                      {ev.evidenceStatus && (
                                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                          {ev.evidenceStatus}
                                        </span>
                                      )}
                                    </div>
                                    {ev.details && (
                                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{ev.details}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap ml-3">
                                    {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                  </span>
                                </div>

                                {/* Evidence Snapshots: 320 px Thumbnail + Lightbox trigger (R2) */}
                                {(thumbSrc || fullSrc || screenSrc) && (
                                  <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                                    {thumbSrc && (
                                      <div
                                        onClick={() => setActiveLightboxImage({ src: fullSrc, title: `Evidence Snapshot — ${ev.type || ev.eventType}` })}
                                        className="w-16 h-10 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition bg-black flex items-center justify-center shrink-0"
                                        title="Click to view full image in lightbox"
                                      >
                                        <img
                                          src={thumbSrc}
                                          alt="Evidence thumbnail"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                      {fullSrc && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveLightboxImage({ src: fullSrc, title: `Webcam Evidence — ${ev.type || ev.eventType}` })}
                                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold transition-colors cursor-pointer"
                                        >
                                          <Video size={11} /> Full Frame Lightbox
                                        </button>
                                      )}
                                      {screenSrc && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveLightboxImage({ src: screenSrc, title: `Screen Capture — ${ev.type || ev.eventType}` })}
                                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                                        >
                                          <Monitor size={11} /> Screen Lightbox
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Paginated Violation Navigation */}
                        {totalVPages > 1 && (
                          <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                            <span>Page {curVPage} of {totalVPages}</span>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={curVPage <= 1}
                                onClick={() => setViolationPage(p => Math.max(1, p - 1))}
                                className="h-6 px-2 text-[10px]"
                              >
                                Prev
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={curVPage >= totalVPages}
                                onClick={() => setViolationPage(p => Math.min(totalVPages, p + 1))}
                                className="h-6 px-2 text-[10px]"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
                      onClick={handleCloseModal}
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

        {/* Exam Device Companion Staff Waiver Confirmation Dialog */}
        <ConfirmDialog
          isOpen={waiverDialog.open}
          title={`Grant Companion Waiver for ${selectedCandidate?.name || 'Candidate'}?`}
          description={`Granting a waiver permits candidate USN ${selectedCandidate?.usn} to take this exam without an active Exam Device Companion session. This action is permanently audited.`}
          confirmText="Grant Waiver"
          cancelText="Cancel"
          variant="default"
          onConfirm={handleGrantWaiver}
          onClose={() => setWaiverDialog({ open: false, reason: '' })}
        >
          <div className="space-y-1.5 mt-2">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Waiver Reason (Required for audit compliance)
            </label>
            <input
              value={waiverDialog.reason}
              onChange={(e) => setWaiverDialog(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g., Institution lab managed workstation, verified hardware exemption..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary transition"
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
