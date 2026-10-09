import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  WifiOff,
  RotateCcw,
  ArrowRight,
  LogOut,
  Clock
} from 'lucide-react'

import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useProctoringMonitors } from '@/hooks/useProctoringMonitors'
import { AutosaveManager } from '@/lib/autosaveManager'
import { serverClock } from '@/lib/serverClock'
import { getSharedScreenStream, setSharedScreenStream, clearSharedScreenStream } from '@/lib/mediaState'
import { mediaStore, useMediaStore, MEDIA_STATUS } from '@/lib/mediaStore'

import ExamHeader from '@/components/exam/ExamHeader'
import QuestionPanel from '@/components/exam/QuestionPanel'
import ExamSidebar from '@/components/exam/ExamSidebar'
import { FullscreenComplianceOverlay, ExamWaitingLobby } from '@/components/exam/ComplianceOverlay'
import WatermarkCanvas from '@/components/student/WatermarkCanvas'

export default function ExamInterface() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const mediaState = useMediaStore()

  // ── Exam & Session State ──
  const [attemptId, setAttemptId] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [secsToStart, setSecsToStart] = useState(null)
  const [vpnEnforcement, setVpnEnforcement] = useState(false)

  // ── Authoritative Terminal & Suspended States ──
  const [terminalState, setTerminalState] = useState(null) // { type: 'SUBMITTED' | 'TERMINATED', ... }
  const [suspendedState, setSuspendedState] = useState(null) // { active: bool, reason: str, isVpn: bool }
  const [isMultiTabBlocked, setIsMultiTabBlocked] = useState(false)

  // ── Question & Answer Navigation ──
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flagged, setFlagged] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'error'

  // ── Non-Destructive Re-Authentication Modal State (Phase S2 / SES-04) ──
  const [showReauthModal, setShowReauthModal] = useState(false)
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthLoading, setReauthLoading] = useState(false)
  const [reauthError, setReauthError] = useState('')

  const streamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const tabInstanceId = useRef(null)
  if (!tabInstanceId.current) {
    tabInstanceId.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'tab-' + Date.now()
  }
  const autosaveRef = useRef(new AutosaveManager())

  // ── 0. Subscribe to Autosave Manager Status ──
  useEffect(() => {
    const manager = autosaveRef.current
    const unsubscribe = manager.subscribe((state) => {
      if (state.isSubmitting || state.isFlushing) {
        setSaveStatus('saving')
      } else if (state.dirtyCount === 0) {
        setSaveStatus('saved')
      }
    })

    return () => {
      unsubscribe()
      manager.destroy()
    }
  }, [])

  // ── Non-Destructive Session Expiry Listener (Phase S2 / SES-04) ──
  useEffect(() => {
    const handleReauth = () => {
      setShowReauthModal(true)
    }
    window.addEventListener('pn:exam-reauth-required', handleReauth)
    return () => {
      window.removeEventListener('pn:exam-reauth-required', handleReauth)
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('pn_active_attempt')
      }
    }
  }, [])

  const handleReauthSubmit = async (e) => {
    e?.preventDefault()
    if (!reauthPassword) return
    setReauthLoading(true)
    setReauthError('')
    try {
      await api.post('/auth/student/login', {
        usn: user?.usn,
        password: reauthPassword
      })
      setShowReauthModal(false)
      setReauthPassword('')
      toast.success('Session restored. Resuming examination...')
      autosaveRef.current.flush().catch(() => {})
    } catch (err) {
      setReauthError(err.response?.data?.error?.message || err.message || 'Incorrect password')
    } finally {
      setReauthLoading(false)
    }
  }

  // ── Multi-Tab Concurrency Guard ──
  useEffect(() => {
    if (!examId) return
    const channelName = `proctornet_exam_${examId}`
    let channel = null
    try {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = (e) => {
        if (e.data?.type === 'TAB_PING' && e.data?.tabId !== tabInstanceId.current) {
          // Another tab just pinged; reply that this tab is active
          channel.postMessage({ type: 'TAB_ACTIVE', tabId: tabInstanceId.current })
        } else if (e.data?.type === 'TAB_ACTIVE' && e.data?.tabId !== tabInstanceId.current) {
          // Received confirmation that another tab is already running
          setIsMultiTabBlocked(true)
        }
      }
      // Broadcast presence
      channel.postMessage({ type: 'TAB_PING', tabId: tabInstanceId.current })
    } catch {
      // Fallback for environments where BroadcastChannel is restricted
    }

    return () => {
      if (channel) {
        channel.close()
      }
    }
  }, [examId])

  // ── Submit Exam Function (Q3.2 & H-01) ──
  const handleSubmit = useCallback(async (forced = false) => {
    if (submitting) return
    setSubmitting(true)
    setSaveStatus('saving')

    // Show "Submitted" immediately (Q3.2)
    setTerminalState({
      type: 'SUBMITTED',
      score: 0,
      totalMarks: exam?.totalMarks || 100,
      percentage: 0,
      message: forced ? 'Exam auto-submitted upon deadline.' : 'Exam submitted successfully.'
    })

    try {
      await autosaveRef.current.submitAttempt()
      setSaveStatus('saved')
      toast.success(forced ? 'Exam auto-submitted upon deadline' : 'Exam submitted successfully!')

      // Poll GET /attempts/:id/result (respecting release policy per Q3.2)
      const result = await autosaveRef.current.pollResult(10, 2000)
      if (result && result.released !== false && result.status !== 'HELD_BY_POLICY') {
        setTerminalState({
          type: 'SUBMITTED',
          score: result.score ?? 0,
          totalMarks: result.totalMarks ?? (exam?.totalMarks || 100),
          percentage: result.percentage ?? 0,
          message: result.message || 'Examination finalized and certified.'
        })
      }
    } catch (err) {
      console.error('Submit error:', err)
      const status = err.response?.status
      const errorCode = err.code || err.response?.data?.error?.code
      const errorMsg = err.response?.data?.error?.message || err.message

      // Never treat 403 as success (H-01 / Q3.5)
      if (status === 403 || errorCode === 'ATTEMPT_SUSPENDED' || errorCode === 'FORBIDDEN') {
        toast.error(errorMsg || 'Action forbidden: Attempt is suspended or access denied.')
        setTerminalState(null) // Revert premature submitted state
        if (errorCode === 'ATTEMPT_SUSPENDED') {
          setSuspendedState({
            active: true,
            reason: errorMsg || 'Attempt is currently suspended by proctor.',
            isVpn: false
          })
        }
      } else if (errorCode === 'EXAM_EXPIRED' || status === 410) {
        toast.error('Exam deadline has passed. Submission recorded.')
      } else if (status === 409 && (errorCode === 'ALREADY_SUBMITTED' || errorMsg?.includes('already submitted'))) {
        toast.success('Exam was already submitted.')
      } else {
        toast.error(errorMsg || 'Submission encountered an error. Please try again.')
      }
    } finally {
      setSubmitting(false)
      setShowSubmitConfirm(false)
    }
  }, [submitting, exam])

  // ── Hook 1: Exam Timer (Q3.3) ──
  const { formattedTime, isUrgent, isCritical } = useExamTimer({
    expiresAt,
    endTime: exam?.endTime,
    durationMinutes: exam?.duration,
    onTimeUp: () => handleSubmit(true),
    autoStart: !isWaiting && !loading && !terminalState && !suspendedState?.active
  })

  // ── Hook 2: Socket.io & Real-Time Control Plane (Q3.1 / A-02) ──
  const { socketConnected, violations, emitViolation } = useExamSocket({
    examId,
    attemptId, // Plumbed attemptId! (A-02)
    user,
    onTerminated: (payload) => {
      setTerminalState({
        type: 'TERMINATED',
        reason: payload?.reason || 'Terminated by invigilator for academic integrity violation.'
      })
    },
    onSuspended: (payload) => {
      setSuspendedState({
        active: true,
        reason: payload?.reason || 'Session temporarily paused by proctor.',
        isVpn: false
      })
    },
    onResumed: (payload) => {
      setSuspendedState(null)
      setTerminalState(null)
      if (payload?.expiresAt) {
        setExpiresAt(payload.expiresAt)
      }
    },
    onStateChange: (payload) => {
      const status = payload?.currentStatus || payload?.status
      if (status === 'ACTIVE') {
        setSuspendedState(null)
        setTerminalState(null)
        if (payload?.expiresAt) {
          setExpiresAt(payload.expiresAt)
        }
      } else if (status === 'SUSPENDED') {
        setSuspendedState({
          active: true,
          reason: payload?.reason || 'Session temporarily paused by proctor.',
          isVpn: false
        })
      } else if (status === 'TERMINATED') {
        setTerminalState({
          type: 'TERMINATED',
          reason: payload?.reason || 'Terminated by invigilator for academic integrity violation.'
        })
      }
    }
  })

  // ── Hook 3: Proctoring Monitors ──
  const {
    videoRef,
    captureVideoRef,
    canvasRef,
    cameraOk,
    faceOk,
    isFullscreenLocked
  } = useProctoringMonitors({
    examId,
    emitViolation,
    isExamActive: !isWaiting && !loading && !terminalState && !suspendedState?.active,
    externalStreamRef: streamRef
  })

  // ── LiveKit SFU WebRTC ProctorPublisher (Q6) ──
  useEffect(() => {
    if (!attemptId || loading || isWaiting || terminalState) return

    let isCleanedUp = false

    const initMediaPublisher = async () => {
      try {
        await mediaStore.startPublisher({
          examId,
          attemptId,
          onViolation: ({ eventType, metadata }) => {
            emitViolation?.(eventType, 'MEDIUM', metadata)
          },
          onScreenShareStopped: () => {
            emitViolation?.('SCREEN_SHARE_STOPPED', 'MEDIUM', { details: 'Screen sharing was stopped by candidate.' })
            toast.error('Screen sharing was disconnected. Please click Re-Share Screen to continue.', {
              id: 'screen-stopped-toast',
              duration: 8000
            })
          }
        })
      } catch (err) {
        if (!isCleanedUp) {
          console.warn('[ExamInterface] LiveKit publisher startup note:', err.message)
        }
      }
    }

    initMediaPublisher()

    return () => {
      isCleanedUp = true
      mediaStore.reset()
    }
  }, [attemptId, examId, loading, isWaiting, Boolean(terminalState), emitViolation])

  // ── Aggressive Hardware & Stream Teardown on Terminal State ──
  useEffect(() => {
    if (terminalState) {
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()) } catch (_e) { /* ignore */ }
        streamRef.current = null
      }
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(t => t.stop()) } catch (_e) { /* ignore */ }
        screenStreamRef.current = null
      }
      clearSharedScreenStream()
      mediaStore.reset()
    }
  }, [terminalState])

  // ── 1. Fetch Exam Initialization & Authoritative State Recovery (Q3.1 / Q3.7) ──
  useEffect(() => {
    let interval = null

    const initExam = async () => {
      setLoading(true)
      try {
        // Read system configuration for VPN enforcement (Q3.7)
        api.get('/config')
          .then(res => {
            if (typeof res.data?.vpnEnforcement === 'boolean') {
              setVpnEnforcement(res.data.vpnEnforcement)
            }
          })
          .catch(() => {})

        // Authoritative start or resume attempt (Q3.1)
        const res = await api.post(`/exams/${examId}/attempt`)
        const attempt = res.data

        if (!attempt) {
          throw new Error('Invalid attempt response payload')
        }

        // Synchronize server clock
        if (attempt.serverTime) {
          serverClock.synchronize(attempt.serverTime)
        }

        setAttemptId(attempt.id)
        setExpiresAt(attempt.expiresAt)
        autosaveRef.current.setAttemptId(attempt.id, attempt.questions || [])
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('pn_active_attempt', attempt.id)
        }

        // Authoritative State Check
        if (attempt.status === 'SUBMITTED' || attempt.isSubmitted) {
          setTerminalState({
            type: 'SUBMITTED',
            score: 0,
            totalMarks: attempt.exam?.totalMarks || 100,
            percentage: 0,
            message: 'Exam already submitted.'
          })
          autosaveRef.current.pollResult(5, 2000).then(r => {
            if (r && r.released !== false && r.status !== 'HELD_BY_POLICY') {
              setTerminalState({
                type: 'SUBMITTED',
                score: r.score ?? 0,
                totalMarks: r.totalMarks ?? (attempt.exam?.totalMarks || 100),
                percentage: r.percentage ?? 0,
                message: r.message || 'Examination finalized and certified.'
              })
            }
          })
          setLoading(false)
          return
        }

        if (attempt.status === 'TERMINATED' || attempt.isTerminated) {
          setTerminalState({
            type: 'TERMINATED',
            reason: attempt.terminationReason || 'This exam was terminated by the invigilator.'
          })
          setLoading(false)
          return
        }

        if (attempt.status === 'SUSPENDED' || attempt.isSuspended) {
          setSuspendedState({
            active: true,
            reason: attempt.suspensionReason || 'Session temporarily held by invigilator.',
            isVpn: false
          })
        }

        if (attempt.status === 'READY') {
          setIsWaiting(true)
          setExam(attempt.exam)
          const startMs = new Date(attempt.exam?.startTime || Date.now()).getTime()
          const calcSecs = () => Math.max(0, Math.floor((startMs - serverClock.now()) / 1000))
          setSecsToStart(calcSecs())

          interval = setInterval(() => {
            const rem = calcSecs()
            setSecsToStart(rem)
            if (rem <= 0) {
              clearInterval(interval)
              setIsWaiting(false)
              initExam()
            }
          }, 1000)
        } else {
          setIsWaiting(false)
          setExam(attempt.exam)

          // Load and normalize questions
          const loadedQuestions = (attempt.questions || []).map((q, idx) => ({
            id: q.attemptQuestionId || q.questionId,
            attemptQuestionId: q.attemptQuestionId,
            questionId: q.questionId,
            displayOrder: q.displayOrder ?? idx,
            questionText: q.questionText,
            imageUrl: q.imageKey ? `/api/v1/media/image/${q.imageKey}` : null,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            difficulty: q.difficulty || 'MEDIUM',
            options: (q.options || []).map((opt, i) => ({
              id: opt.id,
              letter: String.fromCharCode(65 + i),
              text: opt.text,
              order: opt.order ?? i
            }))
          }))
          setQuestions(loadedQuestions)

          // Hydrate previously saved answers + revisions (Q3.1)
          const hydratedAnswers = {}
          for (const q of (attempt.questions || [])) {
            if (q.selectedOptionId) {
              let matchedLetter = null
              const matchedOpt = (q.options || []).find((opt, i) => {
                if (opt.id === q.selectedOptionId) {
                  matchedLetter = String.fromCharCode(65 + i)
                  return true
                }
                return false
              })

              const targetVal = {
                selected: matchedLetter || matchedOpt?.text || q.selectedOptionId,
                revision: q.revision || 0
              }

              if (q.attemptQuestionId) hydratedAnswers[q.attemptQuestionId] = targetVal
              if (q.questionId) hydratedAnswers[q.questionId] = targetVal
            }
          }
          setAnswers(hydratedAnswers)
          if (autosaveRef.current) {
            autosaveRef.current.setQuestionRevisions(attempt.questions || [])
          }
        }
      } catch (err) {
        console.error('Failed to initialize exam:', err)
        const msg = err.response?.data?.error?.message || err.message
        toast.error(msg || 'Failed to initialize examination.')
        navigate('/student/dashboard')
      } finally {
        setLoading(false)
      }
    }

    initExam()
    return () => {
      if (interval) clearInterval(interval)
      autosaveRef.current?.destroy()
    }
  }, [examId, navigate])

  // ── Record Answer via AutosaveManager (Q3.2) ──
  const setAnswer = (questionId, field, val) => {
    const q = questions.find(item => item.id === questionId || item.attemptQuestionId === questionId || item.questionId === questionId)
    const attemptQuestionId = q?.attemptQuestionId || questionId
    const targetQId = q?.id || questionId

    setAnswers(prev => ({
      ...prev,
      [targetQId]: {
        ...(prev[targetQId] || {}),
        [field]: val
      },
      [attemptQuestionId]: {
        ...(prev[attemptQuestionId] || {}),
        [field]: val
      }
    }))

    // Match option ID for backend record
    let selectedOptionId = val
    if (q && q.options) {
      const matchOpt = q.options.find((opt, i) => {
        const letter = String.fromCharCode(65 + i)
        return opt.id === val || opt.text === val || letter === val
      })
      if (matchOpt) {
        selectedOptionId = matchOpt.id
      }
    }

    if (attemptQuestionId && selectedOptionId) {
      autosaveRef.current.recordAnswer(attemptQuestionId, selectedOptionId)
      setSaveStatus('saving')
    }
  }

  const toggleFlag = (questionId) => {
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const handleReenterFullscreen = () => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {})
  }

  // ── 3. Continuous In-Exam Companion Monitor ──
  useEffect(() => {
    if (loading || isWaiting || terminalState || !attemptId) return

    let companionTimer = null
    const checkCompanion = async () => {
      try {
        const res = await api.get(`/attempts/${attemptId}/agent/status`)
        if (res.data?.state === 'STALE' || res.data?.state === 'DISCONNECTED') {
          setSuspendedState(prev => {
            if (!prev?.active) {
              emitViolation?.('AGENT_DISCONNECTED', 'HIGH', {
                details: 'Exam Device Companion disconnected during active test'
              })
            }
            return {
              active: true,
              reason: 'Exam Device Companion disconnected. Please keep the companion window open.',
              isCompanion: true
            }
          })
        } else if (res.data?.state === 'HEALTHY' || res.data?.state === 'CONNECTED') {
          setSuspendedState(prev => (prev?.isCompanion ? null : prev))
        }
      } catch {
        // Tolerant on intermittent network hiccups
      }
    }

    companionTimer = setInterval(checkCompanion, 10000)
    return () => {
      if (companionTimer) clearInterval(companionTimer)
    }
  }, [attemptId, loading, isWaiting, terminalState])

  // ── 4. Keyboard Shortcut & Clipboard Protection ──
  useEffect(() => {
    if (loading || isWaiting || terminalState) return

    const handleKeyDown = (e) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Inspect / Source)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && ['u', 's'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault()
        emitViolation?.('KEYBOARD_SHORTCUT', 'HIGH', { key: e.key })
        toast.error('Browser inspection shortcuts are prohibited during examination.')
        return
      }

      // Block Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A outside editable inputs
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        const targetTag = e.target.tagName?.toLowerCase()
        const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          emitViolation?.('KEYBOARD_SHORTCUT', 'LOW', { action: 'copy_paste' })
        }
      }
    }

    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    const handleClipboardEvent = (e) => {
      const targetTag = e.target?.tagName?.toLowerCase()
      const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target?.isContentEditable
      if (!isEditable) {
        e.preventDefault()
        emitViolation?.('KEYBOARD_SHORTCUT', 'LOW', { action: 'clipboard_' + e.type })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleClipboardEvent)
    document.addEventListener('cut', handleClipboardEvent)
    document.addEventListener('paste', handleClipboardEvent)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleClipboardEvent)
      document.removeEventListener('cut', handleClipboardEvent)
      document.removeEventListener('paste', handleClipboardEvent)
    }
  }, [loading, isWaiting, terminalState, emitViolation])

  // ── 5. Media Hardware Teardown on Exit / Unmount ──
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop())
        } catch { /* ignore */ }
      }
      if (screenStreamRef.current) {
        try {
          screenStreamRef.current.getTracks().forEach(track => track.stop())
        } catch { /* ignore */ }
      }
      clearSharedScreenStream()
    }
  }, [])

  // ── Multi-Tab Blocked Screen ──
  if (isMultiTabBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/40 flex items-center justify-center text-destructive mb-4">
          <Lock size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Multiple Tabs Prohibited</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          An examination session is already active in another browser tab or window. Running multiple simultaneous sessions is prohibited by ProctorNet security rules.
        </p>
        <button
          onClick={() => window.close()}
          className="px-6 py-2.5 rounded-xl bg-destructive text-white font-bold text-xs uppercase tracking-wider hover:bg-destructive/90 transition-colors shadow-lg cursor-pointer"
        >
          Close This Tab
        </button>
      </div>
    )
  }

  // ── Authoritative Terminal Screens ──
  if (terminalState?.type === 'TERMINATED') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/40 flex items-center justify-center text-destructive mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Examination Session Terminated</h2>
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 max-w-md my-4 text-left">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1">Official Reason</p>
          <p className="text-sm text-slate-200">{terminalState.reason}</p>
        </div>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          This incident has been logged in the audit ledger and transmitted to university faculty. Your answers have been archived.
        </p>
        <button
          onClick={() => navigate('/student/dashboard', { replace: true })}
          className="px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  if (terminalState?.type === 'SUBMITTED') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Examination Submitted</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Your answers have been securely recorded and verified. Proctoring monitors and secure isolation sessions have been deactivated.
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-xs w-full mb-6 text-left">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Score</span>
            <p className="text-xl font-bold text-white mt-1">{terminalState.score} / {terminalState.totalMarks}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Percentage</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{Number(terminalState.percentage || 0).toFixed(1)}%</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/student/results', { replace: true })}
          className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-colors shadow-lg flex items-center gap-2 cursor-pointer"
        >
          View Full Results <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  // ── Suspended Overlay (VPN Disconnect or Proctor Pause) ──
  const isSuspended = suspendedState?.active

  // ── Render Waiting State ──
  if (isWaiting) {
    return (
      <ExamWaitingLobby
        exam={exam}
        secsToStart={secsToStart}
        videoRef={videoRef}
        cameraOk={cameraOk}
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono text-xs text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        Securing proctoring session…
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none relative">
      {/* Dynamic Anti-Leak Forensic Watermark (FLW-10 / BUG-J02) */}
      {(exam?.watermarkRequired ?? true) && (
        <WatermarkCanvas text={user?.usn ? `${user.usn} • ${user.name || ''}` : 'PROCTORNET'} />
      )}

      {/* Hidden capture elements */}
      <video ref={captureVideoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Suspended State Modal Overlay */}
      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 mb-4 animate-pulse">
            {suspendedState?.isVpn ? <WifiOff size={32} /> : <Clock size={32} />}
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {suspendedState?.isVpn ? 'Secure Network Disconnected' : 'Examination Session Suspended'}
          </h3>
          <p className="text-sm text-slate-300 max-w-md mb-4 leading-relaxed font-medium">
            {suspendedState?.reason}
          </p>
          {suspendedState?.isVpn && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 max-w-md text-xs text-slate-400 mb-6 text-left">
              <p className="font-bold text-white mb-1">How to resume:</p>
              <p>1. Open your secure connection client or local companion.</p>
              <p>2. Select the assigned exam profile and click <strong className="text-amber-400">Connect</strong>.</p>
              <p>3. This window will automatically resume as soon as the secure connection reconnects.</p>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen compliance prompt if student leaves fullscreen */}
      {!isFullscreenLocked && !isSuspended && (
        <FullscreenComplianceOverlay onReenterFullscreen={handleReenterFullscreen} />
      )}

      {/* Top Header */}
      <ExamHeader
        exam={exam}
        user={user}
        formattedTime={formattedTime}
        isUrgent={isUrgent}
        isCritical={isCritical}
        cameraOk={cameraOk}
        faceOk={faceOk}
        socketConnected={socketConnected}
        violations={violations}
        saveStatus={saveStatus}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        <QuestionPanel
          questions={questions}
          currentIdx={currentIdx}
          setCurrentIdx={setCurrentIdx}
          answers={answers}
          setAnswer={setAnswer}
          flagged={flagged}
          toggleFlag={toggleFlag}
          answeredCount={answeredCount}
          submitting={submitting}
          onSubmitRequest={() => setShowSubmitConfirm(true)}
        />

        <ExamSidebar
          videoRef={videoRef}
          cameraOk={cameraOk}
          questions={questions}
          currentIdx={currentIdx}
          setCurrentIdx={setCurrentIdx}
          answers={answers}
          flagged={flagged}
          submitting={submitting}
          onSubmitRequest={() => setShowSubmitConfirm(true)}
        />
      </div>

      {/* Submission Confirmation Dialog */}
      <ConfirmDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Finalize & Submit Exam?"
        description={`You have answered ${answeredCount} of ${questions.length} questions. Once submitted, your answers cannot be modified.`}
        confirmText="Yes, Submit Exam"
        cancelText="Return to Exam"
        variant="default"
        loading={submitting}
        onConfirm={() => handleSubmit(false)}
      />

      {/* Non-Destructive Re-Auth Modal (SES-04 / S2) */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Session Security Check</h3>
                <p className="text-xs text-slate-400">Your session ended. Re-authenticate to resume.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              Your exam state and uncommitted answers are preserved in buffer. Please enter your password to continue without losing your answers.
            </p>

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              {reauthError && (
                <div className="p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  {reauthError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Candidate Password ({user?.usn || 'USN'})
                </label>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={reauthLoading || !reauthPassword}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reauthLoading ? 'Verifying...' : 'Restore Session & Resume Exam'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
