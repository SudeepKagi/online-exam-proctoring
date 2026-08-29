import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Search, RefreshCw, Eye, X,
  Radio, Volume2, VolumeX, Download, Filter, CheckCircle2,
  PauseCircle, PlayCircle, Send, MessageSquare, ExternalLink,
  Camera, Monitor, User, Clock, AlertCircle, Sparkles, Layers,
  ChevronRight, ArrowUpDown, CheckCheck, Trash2, Maximize2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useInvigilatorSocket } from '@/hooks/useInvigilatorSocket'

// ── Event Display Mapping & Category Classifications ──
const EVENT_CONFIG = {
  tab_switch: { label: 'Tab Switch', category: 'BROWSER', icon: Monitor, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  window_blur: { label: 'Window Focus Lost', category: 'BROWSER', icon: Monitor, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  fullscreen_exit: { label: 'Fullscreen Exit', category: 'BROWSER', icon: Monitor, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  devtools_open: { label: 'DevTools Inspection', category: 'BROWSER', icon: Monitor, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  second_monitor: { label: 'Dual Monitor Detected', category: 'BROWSER', icon: Monitor, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  multiple_faces: { label: 'Multiple Faces Present', category: 'FACE', icon: Camera, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  no_face: { label: 'No Face in Camera', category: 'FACE', icon: Camera, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  face_mismatch: { label: 'Biometric Face Mismatch', category: 'FACE', icon: Camera, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  gaze_deviation: { label: 'Off-Screen Gaze Deviation', category: 'FACE', icon: Eye, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  keyboard_shortcut: { label: 'Restricted Key Shortcut', category: 'INPUT', icon: AlertCircle, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  copy_attempt: { label: 'Clipboard Copy Attempt', category: 'INPUT', icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  paste_attempt: { label: 'Clipboard Paste Attempt', category: 'INPUT', icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  voice_detected: { label: 'Audio / Speech Detected', category: 'AUDIO', icon: Radio, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  vpn_disconnect: { label: 'Secure VPN Tunnel Loss', category: 'NETWORK', icon: ShieldAlert, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  banned_process: { label: 'Blacklisted Process Active', category: 'NETWORK', icon: ShieldAlert, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  virtual_camera: { label: 'Virtual Camera Injected', category: 'NETWORK', icon: Camera, color: 'text-rose-600 bg-rose-600/10 border-rose-600/20' },
  INVIGILATOR_WARNING: { label: 'Proctor Warning Dispatched', category: 'PROCTOR', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
}

function getEventMeta(eventType) {
  return EVENT_CONFIG[eventType] || {
    label: (eventType || 'Violation Alert').replace(/_/g, ' ').toUpperCase(),
    category: 'GENERAL',
    icon: AlertTriangle,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/20'
  }
}

// ── Web Audio Synthesized Chime ──
function playAlertChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

// ── Severity Badges ──
function SeverityPill({ severity }) {
  const s = (severity || 'MEDIUM').toUpperCase()
  if (s === 'CRITICAL') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-500/15 text-rose-600 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
        CRITICAL
      </span>
    )
  }
  if (s === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-orange-500/15 text-orange-600 border border-orange-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        HIGH
      </span>
    )
  }
  if (s === 'MEDIUM') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-amber-500/15 text-amber-600 border border-amber-500/30">
        MEDIUM
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-mono bg-slate-500/10 text-slate-600 border border-slate-500/20">
      LOW
    </span>
  )
}

// ── Action Status Pill ──
function ActionStatusPill({ action }) {
  if (!action || action === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
        <Clock size={11} /> Pending Review
      </span>
    )
  }
  if (action === 'DISMISSED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
        <ShieldCheck size={11} /> False Positive / Cleared
      </span>
    )
  }
  if (action === 'TERMINATED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30">
        <ShieldAlert size={11} /> Terminated
      </span>
    )
  }
  if (action === 'SUSPENDED' || action === 'PAUSED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-orange-500/15 text-orange-600 border border-orange-500/30">
        <PauseCircle size={11} /> Suspended
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
      <CheckCircle2 size={11} /> {action}
    </span>
  )
}

export default function InvigilatorViolations() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const effectiveExamId = user?.examId || 'active'

  // ── Component State ──
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tabFilter, setTabFilter] = useState('ALL') // ALL, PENDING, CRITICAL_HIGH, ACTIONED, DISMISSED
  const [categoryFilter, setCategoryFilter] = useState('ALL') // ALL, FACE, BROWSER, AUDIO, NETWORK, INPUT
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [viewMode, setViewMode] = useState('feed') // 'feed' | 'table'
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [imageModal, setImageModal] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  // ── Action Console State ──
  const [actionLoading, setActionLoading] = useState(false)
  const [warningText, setWarningText] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [confirmTerminate, setConfirmTerminate] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')

  // ── Live Incident Stream Feed via Socket ──
  const { connected } = useInvigilatorSocket({
    examId: effectiveExamId,
    enabled: true,
    onAlertReceived: (incomingAlert) => {
      if (soundEnabled && (incomingAlert.severity === 'CRITICAL' || incomingAlert.severity === 'HIGH')) {
        playAlertChime()
      }

      const formatted = {
        id: incomingAlert.id || `live_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        studentExamId: incomingAlert.studentExamId,
        studentId: incomingAlert.studentId,
        studentName: incomingAlert.studentName || 'Candidate',
        studentUsn: incomingAlert.studentUsn || incomingAlert.usn || 'N/A',
        studentPhoto: incomingAlert.studentPhoto,
        examId: incomingAlert.examId || effectiveExamId,
        examTitle: incomingAlert.examTitle || 'Active Exam Session',
        studentStatus: 'ACTIVE',
        eventType: incomingAlert.eventType || incomingAlert.type || 'tab_switch',
        severity: incomingAlert.severity || 'MEDIUM',
        details: incomingAlert.details || incomingAlert.reason || 'Live security flag recorded.',
        timestamp: incomingAlert.timestamp || new Date().toISOString(),
        cameraFrameUrl: incomingAlert.cameraFrameUrl || incomingAlert.frameUrl,
        screenshotUrl: incomingAlert.screenshotUrl,
        invAction: null,
        invActionNote: null,
        isLiveStreamed: true
      }

      setViolations(prev => [formatted, ...prev])
      toast.custom((t) => (
        <div className={`flex items-center gap-3 p-3.5 bg-[#091a2f] text-white rounded-xl shadow-2xl border border-[#13335f] text-xs font-sans animate-in slide-in-from-top-4 duration-300 ${t.visible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
            <ShieldAlert size={16} />
          </div>
          <div>
            <p className="font-bold text-white">Live Alert: {formatted.studentName} ({formatted.studentUsn})</p>
            <p className="text-slate-400 text-[11px]">{getEventMeta(formatted.eventType).label} • {formatted.severity}</p>
          </div>
          <Button
            size="sm"
            onClick={() => { setSelectedIncident(formatted); toast.dismiss(t.id) }}
            className="ml-2 h-7 text-[11px] bg-primary text-white hover:bg-primary/90 rounded-lg px-2.5 font-mono"
          >
            Review
          </Button>
        </div>
      ), { duration: 5000 })
    }
  })

  // ── Fetch Violations API ──
  const fetchViolations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/invigilator/violations', {
        params: {
          examId: effectiveExamId !== 'active' ? effectiveExamId : undefined,
          limit: 100
        }
      })
      setViolations(res.data.violations || [])
    } catch (err) {
      console.error('Failed to load violations', err)
      toast.error('Failed to load violation alerts')
    } finally {
      setLoading(false)
    }
  }, [effectiveExamId])

  useEffect(() => {
    fetchViolations()
  }, [fetchViolations])

  // ── Filtering Logic ──
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      // Search
      const searchMatch = !search.trim() ||
        (v.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.studentUsn || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.examTitle || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.details || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.eventType || '').toLowerCase().includes(search.toLowerCase())

      // Tab Filter
      let tabMatch = true
      if (tabFilter === 'PENDING') tabMatch = !v.invAction || v.invAction === 'PENDING'
      else if (tabFilter === 'CRITICAL_HIGH') tabMatch = ['CRITICAL', 'HIGH'].includes(v.severity?.toUpperCase())
      else if (tabFilter === 'ACTIONED') tabMatch = v.invAction && v.invAction !== 'PENDING' && v.invAction !== 'DISMISSED'
      else if (tabFilter === 'DISMISSED') tabMatch = v.invAction === 'DISMISSED'

      // Category Filter
      let catMatch = true
      if (categoryFilter !== 'ALL') {
        const meta = getEventMeta(v.eventType)
        catMatch = meta.category === categoryFilter
      }

      // Severity Filter
      let sevMatch = true
      if (severityFilter !== 'ALL') {
        sevMatch = v.severity?.toUpperCase() === severityFilter
      }

      return searchMatch && tabMatch && catMatch && sevMatch
    })
  }, [violations, search, tabFilter, categoryFilter, severityFilter])

  // ── Key Metrics ──
  const stats = useMemo(() => {
    const total = violations.length
    const critical = violations.filter(v => ['CRITICAL', 'HIGH'].includes(v.severity?.toUpperCase())).length
    const pending = violations.filter(v => !v.invAction || v.invAction === 'PENDING').length
    const actioned = violations.filter(v => v.invAction && v.invAction !== 'PENDING' && v.invAction !== 'DISMISSED').length
    const dismissed = violations.filter(v => v.invAction === 'DISMISSED').length
    return { total, critical, pending, actioned, dismissed }
  }, [violations])

  // ── Proctor In-Context Action Dispatcher ──
  const handleTakeAction = async ({ action, dispatchAction, warningMsg, pauseReason, termReason, note }) => {
    if (!selectedIncident) return
    setActionLoading(true)
    try {
      const payload = {
        action: action || 'ACKNOWLEDGED',
        note: note || actionNote || undefined,
        dispatchAction,
        warningMessage: warningMsg || warningText || undefined,
        pauseReason: pauseReason || undefined,
        terminateReason: termReason || terminateReason || undefined
      }

      const res = await api.post(`/invigilator/violations/${selectedIncident.id}/action`, payload)
      toast.success(res.data.message || 'Action executed successfully')

      // Update local state
      setViolations(prev => prev.map(v => {
        if (v.id === selectedIncident.id) {
          return {
            ...v,
            invAction: action,
            invActionNote: note || actionNote,
            studentStatus: dispatchAction === 'PAUSE' ? 'SUSPENDED' : dispatchAction === 'TERMINATE' ? 'TERMINATED' : dispatchAction === 'RESUME' ? 'ACTIVE' : v.studentStatus
          }
        }
        return v
      }))

      if (selectedIncident) {
        setSelectedIncident(prev => ({
          ...prev,
          invAction: action,
          invActionNote: note || actionNote,
          studentStatus: dispatchAction === 'PAUSE' ? 'SUSPENDED' : dispatchAction === 'TERMINATE' ? 'TERMINATED' : dispatchAction === 'RESUME' ? 'ACTIVE' : prev.studentStatus
        }))
      }

      setWarningText('')
      setActionNote('')
      setConfirmTerminate(false)
      setTerminateReason('')
    } catch (err) {
      console.error('Failed to execute proctor action', err)
      toast.error(err.response?.data?.error || 'Failed to execute action')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Quick Warning Templates ──
  const WARNING_PRESETS = [
    'Please maintain full focus on your examination screen.',
    'Suspicious head movement detected. Look directly at your camera.',
    'Unauthorized tab or application switch detected. Return immediately.',
    'Multiple persons detected. Ensure you are in a quiet, isolated room.',
    'Audio detected in your environment. Maintain absolute silence.'
  ]

  // ── CSV Incident Exporter ──
  const exportToCSV = () => {
    if (filteredViolations.length === 0) {
      toast.error('No violations to export')
      return
    }

    const headers = ['Incident ID', 'Candidate Name', 'USN', 'Exam Session', 'Violation Type', 'Severity', 'Details', 'Timestamp', 'Proctor Action', 'Action Note']
    const rows = filteredViolations.map(v => [
      `"${v.id}"`,
      `"${v.studentName || ''}"`,
      `"${v.studentUsn || ''}"`,
      `"${v.examTitle || ''}"`,
      `"${getEventMeta(v.eventType).label}"`,
      `"${v.severity || 'MEDIUM'}"`,
      `"${(v.details || '').replace(/"/g, '""')}"`,
      `"${v.timestamp ? new Date(v.timestamp).toISOString() : ''}"`,
      `"${v.invAction || 'PENDING'}"`,
      `"${(v.invActionNote || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `ProctorNet_Violations_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Violation report exported to CSV')
  }

  // ── Bulk Actions ──
  const handleBulkAction = async (actionType) => {
    if (selectedIds.length === 0) return
    try {
      for (const id of selectedIds) {
        await api.post(`/invigilator/violations/${id}/action`, { action: actionType })
      }
      setViolations(prev => prev.map(v => selectedIds.includes(v.id) ? { ...v, invAction: actionType } : v))
      setSelectedIds([])
      toast.success(`Bulk updated ${selectedIds.length} violations to ${actionType}`)
    } catch (e) {
      toast.error('Failed to perform bulk action')
    }
  }

  return (
    <DashboardLayout title="VIOLATION ALERTS & INTEGRITY CENTER">
      <div className="flex flex-col gap-6 py-2 font-sans">

        {/* ── Top Header & Status Bar ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg md:text-xl font-bold text-foreground">Violation Alerts & Proctoring Triage</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {connected ? 'LIVE STREAM CONNECTED' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time multi-modal anomaly feed • Instant proctor warning dispatch • Evidence snapshots
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Audio Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !soundEnabled
                setSoundEnabled(next)
                if (next) playAlertChime()
                toast.success(next ? 'Critical alert chimes enabled' : 'Chimes muted')
              }}
              className="text-xs font-mono gap-1.5 h-9 rounded-xl border-border bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {soundEnabled ? <Volume2 size={14} className="text-emerald-500" /> : <VolumeX size={14} className="text-muted-foreground" />}
              {soundEnabled ? 'Sound On' : 'Muted'}
            </Button>

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="text-xs font-mono gap-1.5 h-9 rounded-xl border-border bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Download size={14} /> Export CSV
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchViolations}
              className="text-xs font-mono gap-1.5 h-9 rounded-xl border-border bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>

            {/* Live Exam Grid Quick Link */}
            <Button
              size="sm"
              onClick={() => navigate(`/invigilator/live-grid/${effectiveExamId}`)}
              className="text-xs font-bold gap-1.5 h-9 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-sm"
            >
              <ExternalLink size={14} /> Switch to Live Grid
            </Button>
          </div>
        </div>

        {/* ── KPI Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <Card className="bg-card border-border p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total Recorded Flags</p>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black font-mono text-foreground">{stats.total}</p>
              <span className="text-[10px] font-mono text-slate-500">All sessions</span>
            </div>
          </Card>

          <Card className="bg-card border-border p-4 rounded-2xl shadow-sm border-l-4 border-l-rose-500">
            <p className="text-[10px] font-mono text-rose-500 uppercase tracking-wider font-bold">Critical / High Threats</p>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black font-mono text-rose-600">{stats.critical}</p>
              <span className="text-[10px] font-mono text-rose-500 font-semibold">{stats.total ? Math.round((stats.critical / stats.total) * 100) : 0}%</span>
            </div>
          </Card>

          <Card className="bg-card border-border p-4 rounded-2xl shadow-sm border-l-4 border-l-amber-500">
            <p className="text-[10px] font-mono text-amber-500 uppercase tracking-wider font-bold">Pending Proctor Review</p>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black font-mono text-amber-600">{stats.pending}</p>
              <span className="text-[10px] font-mono text-amber-500">Requires triage</span>
            </div>
          </Card>

          <Card className="bg-card border-border p-4 rounded-2xl shadow-sm border-l-4 border-l-blue-500">
            <p className="text-[10px] font-mono text-blue-500 uppercase tracking-wider font-bold">Actioned & Warned</p>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black font-mono text-blue-600">{stats.actioned}</p>
              <span className="text-[10px] font-mono text-blue-500">Resolved</span>
            </div>
          </Card>

          <Card className="bg-card border-border p-4 rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider font-bold">False Positives Cleared</p>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black font-mono text-emerald-600">{stats.dismissed}</p>
              <span className="text-[10px] font-mono text-emerald-500">Dismissed</span>
            </div>
          </Card>
        </div>

        {/* ── Filter Bar & Triage Tabs ── */}
        <div className="flex flex-col gap-3 bg-card border border-border p-4 rounded-2xl shadow-sm">
          {/* Main Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: 'All Incidents', count: stats.total },
                { key: 'PENDING', label: 'Pending Review', count: stats.pending, badgeColor: 'bg-amber-500/15 text-amber-600' },
                { key: 'CRITICAL_HIGH', label: 'Critical Threats', count: stats.critical, badgeColor: 'bg-rose-500/15 text-rose-600' },
                { key: 'ACTIONED', label: 'Actioned / Warned', count: stats.actioned },
                { key: 'DISMISSED', label: 'Dismissed', count: stats.dismissed }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTabFilter(t.key)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    tabFilter === t.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${tabFilter === t.key ? 'bg-white/20 text-white' : (t.badgeColor || 'bg-neutral-200 dark:bg-neutral-700 text-foreground')}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              <button
                onClick={() => setViewMode('feed')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                  viewMode === 'feed' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Feed Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Data Table
              </button>
            </div>
          </div>

          {/* Secondary Controls: Search & Category Selectors */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate, USN, reason..."
                className="w-full pl-9 pr-3 py-2 border border-border bg-background text-xs text-foreground rounded-xl focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-border bg-background text-xs text-foreground rounded-xl focus:outline-none focus:border-primary font-mono cursor-pointer"
              >
                <option value="ALL">All Event Categories</option>
                <option value="FACE">👤 Face & Biometrics</option>
                <option value="BROWSER">🖥️ Browser & Screen</option>
                <option value="AUDIO">🎙️ Audio & Voice</option>
                <option value="NETWORK">🛡️ Network & BYOD Agent</option>
                <option value="INPUT">⌨️ Keyboard & Clipboard</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border border-border bg-background text-xs text-foreground rounded-xl focus:outline-none focus:border-primary font-mono cursor-pointer"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">🔴 Critical</option>
                <option value="HIGH">🟠 High</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">⚪ Low</option>
              </select>

              {/* Bulk Actions (Table view only) */}
              {viewMode === 'table' && selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('ACKNOWLEDGED')}
                    className="h-8 text-xs font-mono bg-background text-foreground"
                  >
                    <CheckCheck size={13} className="mr-1" /> Acknowledge ({selectedIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('DISMISSED')}
                    className="h-8 text-xs font-mono bg-background text-foreground text-emerald-600"
                  >
                    <ShieldCheck size={13} className="mr-1" /> Dismiss ({selectedIds.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Feed View Mode ── */}
        {viewMode === 'feed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-card border border-border rounded-2xl animate-pulse p-4 space-y-3" />
              ))
            ) : filteredViolations.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-card border border-border rounded-2xl">
                <ShieldCheck size={44} className="text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-foreground">No Violation Alerts Found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  There are no active security incidents matching your filter criteria. All live student sessions are operating securely.
                </p>
              </div>
            ) : (
              filteredViolations.map((v) => {
                const meta = getEventMeta(v.eventType)
                const IconComponent = meta.icon
                return (
                  <Card
                    key={v.id}
                    className={`bg-card border transition duration-200 hover:shadow-md rounded-2xl overflow-hidden flex flex-col justify-between ${
                      v.severity === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/[0.02]' : 'border-border'
                    }`}
                  >
                    <div>
                      {/* Card Header: Student & Severity */}
                      <div className="p-4 border-b border-border flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {v.studentPhoto ? (
                              <img src={v.studentPhoto} alt={v.studentName} className="w-10 h-10 rounded-xl object-cover border border-border" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs font-mono">
                                {v.studentName?.slice(0, 2).toUpperCase() || 'ST'}
                              </div>
                            )}
                            {v.studentStatus === 'SUSPENDED' && (
                              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-500 border-2 border-card" title="Session Suspended" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground hover:text-primary transition cursor-pointer" onClick={() => setSelectedIncident(v)}>
                              {v.studentName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-muted-foreground font-semibold">{v.studentUsn}</span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] font-mono text-primary truncate max-w-[120px]">{v.examTitle}</span>
                            </div>
                          </div>
                        </div>

                        <SeverityPill severity={v.severity} />
                      </div>

                      {/* Snapshots Preview (Side by Side Camera & Screen) */}
                      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/40 border-b border-border">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Camera Snapshot */}
                          <div className="relative group rounded-xl overflow-hidden bg-black/5 aspect-video border border-border/80 flex items-center justify-center">
                            {v.cameraFrameUrl ? (
                              <img src={v.cameraFrameUrl} alt="Webcam Capture" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-2 text-muted-foreground text-[10px] font-mono">
                                <Camera size={14} className="mx-auto mb-1 opacity-50" /> No Webcam
                              </div>
                            )}
                            {v.cameraFrameUrl && (
                              <button
                                onClick={() => setImageModal({ url: v.cameraFrameUrl, title: `Camera Frame: ${v.studentName}` })}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                              >
                                <Maximize2 size={16} />
                              </button>
                            )}
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">Camera</span>
                          </div>

                          {/* Screen Snapshot */}
                          <div className="relative group rounded-xl overflow-hidden bg-black/5 aspect-video border border-border/80 flex items-center justify-center">
                            {v.screenshotUrl ? (
                              <img src={v.screenshotUrl} alt="Screen Capture" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-2 text-muted-foreground text-[10px] font-mono">
                                <Monitor size={14} className="mx-auto mb-1 opacity-50" /> No Screenshot
                              </div>
                            )}
                            {v.screenshotUrl && (
                              <button
                                onClick={() => setImageModal({ url: v.screenshotUrl, title: `Screen Capture: ${v.studentName}` })}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                              >
                                <Maximize2 size={16} />
                              </button>
                            )}
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">Screen</span>
                          </div>
                        </div>

                        {/* Event Details */}
                        <div className="mt-3 flex items-start gap-2">
                          <span className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${meta.color}`}>
                            <IconComponent size={14} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground">{meta.label}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{v.details || 'Automated proctoring engine integrity alert.'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Timestamp & Direct Action Buttons */}
                    <div className="p-3.5 bg-card flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock size={11} /> {v.timestamp ? new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                        </span>
                        <div className="mt-0.5">
                          <ActionStatusPill action={v.invAction} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedIncident(v)}
                          className="h-8 text-xs font-bold rounded-xl px-3 border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground cursor-pointer"
                        >
                          <Eye size={13} className="mr-1.5" /> Inspect & Action
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ── Table View Mode ── */}
        {viewMode === 'table' && (
          <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-neutral-50/50 dark:bg-neutral-900/50">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredViolations.length && filteredViolations.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(filteredViolations.map(v => v.id))
                          else setSelectedIds([])
                        }}
                        className="rounded border-border"
                      />
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Candidate</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Exam Session</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Event Type</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Severity</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Time</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-mono">Status</TableHead>
                    <TableHead className="text-xs text-right text-muted-foreground font-mono">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViolations.map((v) => {
                    const meta = getEventMeta(v.eventType)
                    const IconComponent = meta.icon
                    const isSelected = selectedIds.includes(v.id)
                    return (
                      <TableRow key={v.id} className="border-b border-border/60 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds(prev => [...prev, v.id])
                              else setSelectedIds(prev => prev.filter(id => id !== v.id))
                            }}
                            className="rounded border-border"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] font-mono shrink-0">
                              {v.studentName?.slice(0, 2).toUpperCase() || 'ST'}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-foreground">{v.studentName}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{v.studentUsn}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary truncate max-w-[160px]">{v.examTitle}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <span className={`p-1 rounded ${meta.color}`}>
                              <IconComponent size={12} />
                            </span>
                            {meta.label}
                          </div>
                        </TableCell>
                        <TableCell><SeverityPill severity={v.severity} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : '—'}
                        </TableCell>
                        <TableCell><ActionStatusPill action={v.invAction} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIncident(v)}
                            className="h-7 text-xs font-mono text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <Eye size={13} className="mr-1" /> Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* ── Deep Inspection & Action Drawer Modal ── */}
        {selectedIncident && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedIncident(null)}
          >
            <div
              className="bg-card border border-border rounded-3xl shadow-2xl max-w-3xl w-full p-6 text-foreground font-sans max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">Incident Investigation Console</h3>
                      <SeverityPill severity={selectedIncident.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Flag ID: <span className="font-mono">{selectedIncident.id}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedIncident(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-muted-foreground transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Candidate Dossier Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5 bg-background p-4 rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                  {selectedIncident.studentPhoto ? (
                    <img src={selectedIncident.studentPhoto} alt={selectedIncident.studentName} className="w-12 h-12 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm font-mono">
                      {selectedIncident.studentName?.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-foreground">{selectedIncident.studentName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{selectedIncident.studentUsn}</p>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Session & Status</span>
                  <p className="text-xs font-bold text-foreground mt-0.5">{selectedIncident.examTitle}</p>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    Status: {selectedIncident.studentStatus || 'ACTIVE'}
                  </span>
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Timestamp</span>
                  <p className="text-xs font-mono text-foreground font-semibold mt-0.5">
                    {selectedIncident.timestamp ? new Date(selectedIncident.timestamp).toLocaleString() : 'N/A'}
                  </p>
                  <div className="mt-1">
                    <ActionStatusPill action={selectedIncident.invAction} />
                  </div>
                </div>
              </div>

              {/* Dual Visual Evidence (Webcam vs Screen) */}
              <div className="mb-5">
                <h4 className="text-xs font-bold font-mono text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                  <Camera size={14} /> Multi-Angle Evidence Snapshots
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Camera Frame */}
                  <div className="bg-background rounded-2xl p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Camera size={13} className="text-primary" /> Webcam Capture
                      </span>
                      {selectedIncident.cameraFrameUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setImageModal({ url: selectedIncident.cameraFrameUrl, title: `Webcam Frame: ${selectedIncident.studentName}` })}
                          className="h-6 text-[10px] font-mono"
                        >
                          <Maximize2 size={11} className="mr-1" /> Expand
                        </Button>
                      )}
                    </div>
                    {selectedIncident.cameraFrameUrl ? (
                      <img src={selectedIncident.cameraFrameUrl} alt="Webcam" className="w-full rounded-xl object-cover aspect-video border border-border" />
                    ) : (
                      <div className="aspect-video rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground font-mono">
                        No Webcam Frame Captured
                      </div>
                    )}
                  </div>

                  {/* Screen Capture */}
                  <div className="bg-background rounded-2xl p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Monitor size={13} className="text-primary" /> Screen Capture
                      </span>
                      {selectedIncident.screenshotUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setImageModal({ url: selectedIncident.screenshotUrl, title: `Screen Capture: ${selectedIncident.studentName}` })}
                          className="h-6 text-[10px] font-mono"
                        >
                          <Maximize2 size={11} className="mr-1" /> Expand
                        </Button>
                      )}
                    </div>
                    {selectedIncident.screenshotUrl ? (
                      <img src={selectedIncident.screenshotUrl} alt="Screen" className="w-full rounded-xl object-cover aspect-video border border-border" />
                    ) : (
                      <div className="aspect-video rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground font-mono">
                        No Screenshot Frame Captured
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Description */}
                <div className="mt-3 p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-border text-xs">
                  <span className="font-bold text-foreground">Violation Reason: </span>
                  <span className="text-muted-foreground">{selectedIncident.details || getEventMeta(selectedIncident.eventType).label}</span>
                </div>
              </div>

              {/* ── Direct Proctor Actions Console ── */}
              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-bold font-mono text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-primary" /> Execute Proctoring Action
                </h4>

                {/* 1. Quick Warning Dispatcher */}
                <div className="bg-background p-4 rounded-2xl border border-border mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Send size={13} className="text-primary" /> Dispatch Live Warning to Candidate
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">Appears immediately on candidate screen</span>
                  </div>

                  {/* Warning Presets */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {WARNING_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setWarningText(preset)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-primary/10 hover:text-primary transition border border-border text-left"
                      >
                        {preset.slice(0, 38)}...
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={warningText}
                      onChange={(e) => setWarningText(e.target.value)}
                      placeholder="Type custom warning message..."
                      className="flex-1 px-3 py-2 text-xs border border-border bg-card text-foreground rounded-xl focus:outline-none focus:border-primary font-sans"
                    />
                    <Button
                      size="sm"
                      disabled={actionLoading || !warningText.trim()}
                      onClick={() => handleTakeAction({ action: 'WARNED', dispatchAction: 'WARN', warningMsg: warningText })}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl px-4 cursor-pointer"
                    >
                      <Send size={13} className="mr-1.5" /> Dispatch
                    </Button>
                  </div>
                </div>

                {/* 2. Session Controls (Pause / Terminate / Clear / Acknowledge) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                  {selectedIncident.studentStatus === 'SUSPENDED' ? (
                    <Button
                      variant="default"
                      disabled={actionLoading}
                      onClick={() => handleTakeAction({ action: 'RESUMED', dispatchAction: 'RESUME' })}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-10 cursor-pointer"
                    >
                      <PlayCircle size={15} className="mr-1.5" /> Resume Candidate Session
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => handleTakeAction({ action: 'SUSPENDED', dispatchAction: 'PAUSE', pauseReason: 'Session paused following proctor violation review.' })}
                      className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-xs font-bold rounded-xl h-10 cursor-pointer"
                    >
                      <PauseCircle size={15} className="mr-1.5" /> Pause Candidate Session
                    </Button>
                  )}

                  {!confirmTerminate ? (
                    <Button
                      variant="destructive"
                      disabled={actionLoading}
                      onClick={() => setConfirmTerminate(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl h-10 cursor-pointer"
                    >
                      <ShieldAlert size={15} className="mr-1.5" /> Terminate Candidate Exam
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        disabled={actionLoading}
                        onClick={() => handleTakeAction({
                          action: 'TERMINATED',
                          dispatchAction: 'TERMINATE',
                          termReason: terminateReason || 'Academic integrity violation confirmed by invigilator.'
                        })}
                        className="flex-1 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl h-10 cursor-pointer"
                      >
                        Confirm Terminate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmTerminate(false)}
                        className="h-10 text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* 3. Triage & Audit Notes */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => handleTakeAction({ action: 'DISMISSED', note: 'Marked as false positive / cleared by proctor.' })}
                    className="text-xs font-mono text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                  >
                    <ShieldCheck size={14} className="mr-1.5" /> Clear as False Positive
                  </Button>

                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => handleTakeAction({ action: 'ACKNOWLEDGED', note: 'Acknowledged by invigilator.' })}
                    className="text-xs font-mono text-foreground border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                  >
                    <CheckCheck size={14} className="mr-1.5" /> Mark Acknowledged
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate(`/invigilator/live-grid/${selectedIncident.examId || effectiveExamId}`)}
                    className="ml-auto text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 rounded-xl"
                  >
                    <ExternalLink size={14} className="mr-1.5" /> Open in Live Grid
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── High-Res Image Fullscreen Lightbox ── */}
        {imageModal && (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex flex-col items-center justify-center p-6"
            onClick={() => setImageModal(null)}
          >
            <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-full flex items-center justify-between text-white mb-3">
                <span className="text-sm font-bold font-mono">{imageModal.title}</span>
                <button onClick={() => setImageModal(null)} className="p-2 hover:bg-white/10 rounded-xl text-white">
                  <X size={20} />
                </button>
              </div>
              <img src={imageModal.url} alt="Evidence Fullscreen" className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border border-white/20 object-contain" />
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
