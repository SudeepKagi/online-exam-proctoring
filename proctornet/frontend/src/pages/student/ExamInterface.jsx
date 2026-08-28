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

import ExamHeader from '@/components/exam/ExamHeader'
import QuestionPanel from '@/components/exam/QuestionPanel'
import ExamSidebar from '@/components/exam/ExamSidebar'
import { FullscreenComplianceOverlay, ExamWaitingLobby } from '@/components/exam/ComplianceOverlay'

export default function ExamInterface() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Exam & Session State ──
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [secsToStart, setSecsToStart] = useState(null)

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

  const saveQueueRef = useRef({})
  const saveTimeoutRef = useRef(null)
  const streamRef = useRef(null)
  const tabInstanceId = useRef(Math.random().toString(36).substring(2))

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

  // ── Submit Exam Function ──
  const handleSubmit = useCallback(async (forced = false) => {
    if (submitting) return
    setSubmitting(true)
    setSaveStatus('saving')

    try {
      // Flush answers directly in submission body
      const res = await api.post(`/student/exams/${examId}/submit`, { answers })
      setSaveStatus('saved')
      toast.success(forced ? 'Exam auto-submitted upon deadline' : 'Exam submitted successfully!')

      setTerminalState({
        type: 'SUBMITTED',
        score: res.data?.score ?? 0,
        totalMarks: res.data?.totalMarks ?? (exam?.totalMarks || 100),
        percentage: res.data?.percentage ?? 0,
        message: res.data?.message || 'Examination finalized and certified.'
      })
    } catch (err) {
      console.error('Submit error:', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message
      if (
        errorMsg?.includes('already submitted') ||
        errorMsg?.includes('session not active') ||
        err.response?.status === 403
      ) {
        toast.success('Exam submitted successfully!')
        navigate('/student/results', { replace: true })
      } else {
        toast.error(errorMsg || 'Submission encountered an error. Please try again.')
      }
    } finally {
      setSubmitting(false)
      setShowSubmitConfirm(false)
    }
  }, [examId, answers, submitting, exam, navigate])

  // ── Hook 1: Exam Timer ──
  const { formattedTime, isUrgent, isCritical } = useExamTimer({
    endTime: exam?.endTime,
    durationMinutes: exam?.duration,
    onTimeUp: () => handleSubmit(true),
    autoStart: !isWaiting && !loading && !terminalState
  })

  // ── Hook 2: Socket.io & WebRTC ──
  const { socketConnected, violations, emitViolation } = useExamSocket({
    examId,
    user,
    streamRef,
    onTerminated: (payload) => {
      setTerminalState({
        type: 'TERMINATED',
        reason: payload?.reason || 'Terminated by invigilator for academic integrity violation.'
      })
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

  // ── Auto-Maintain Screen Share Stream ──
  useEffect(() => {
    if (loading || isWaiting || terminalState) return
    const hasLiveScreen = window.screenShareStream &&
      window.screenShareStream.active &&
      window.screenShareStream.getVideoTracks().some(t => t.readyState === 'live')

    if (!hasLiveScreen && navigator.mediaDevices?.getDisplayMedia) {
      const initScreen = async () => {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'monitor', cursor: 'always' },
            audio: false
          })
          window.screenShareStream = screenStream
          screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
            toast.error('Screen sharing was disconnected. Please re-enable screen sharing.')
          })
        } catch (_e) {}
      }
      initScreen()
    }
  }, [loading, isWaiting, terminalState])

  // ── 1. Fetch Exam Initialization & Authoritative State Recovery ──
  useEffect(() => {
    let interval = null

    const initExam = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/student/exams/${examId}/start`)

        // Authoritative State Check
        if (res.data.sessionState === 'SUBMITTED' || res.data.isSubmitted) {
          setTerminalState({
            type: 'SUBMITTED',
            score: res.data.score || 0,
            totalMarks: res.data.totalMarks || 100,
            percentage: res.data.percentage || 0,
            message: res.data.message || 'Exam already submitted.'
          })
          setLoading(false)
          return
        }

        if (res.data.sessionState === 'TERMINATED' || res.data.isTerminated) {
          setTerminalState({
            type: 'TERMINATED',
            reason: res.data.terminationReason || 'This exam was terminated by the invigilator.'
          })
          setLoading(false)
          return
        }

        if (res.data.sessionState === 'SUSPENDED' || res.data.isSuspended) {
          setSuspendedState({
            active: true,
            reason: res.data.suspensionReason || 'Session temporarily held by invigilator.',
            isVpn: false
          })
        }

        if (res.data.waiting) {
          setIsWaiting(true)
          setExam(res.data.exam)
          const startMs = new Date(res.data.exam?.startTime || res.data.startTime || Date.now()).getTime()
          const calcSecs = () => Math.max(0, Math.floor((startMs - Date.now()) / 1000))
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
          setExam(res.data.exam)
          setQuestions(res.data.questions || [])

          // Hydrate previously saved answers
          if (res.data.answers && Array.isArray(res.data.answers)) {
            const map = {}
            res.data.answers.forEach(a => {
              map[a.questionId] = {
                selected: a.selectedOption,
                code: a.codeAnswer,
                text: a.writtenText
              }
            })
            setAnswers(map)
          }
        }
      } catch (err) {
        console.error('Failed to initialize exam:', err)
        const msg = err.response?.data?.error || err.message
        toast.error(msg || 'Failed to initialize examination.')
        navigate('/student/dashboard')
      } finally {
        setLoading(false)
      }
    }

    initExam()
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [examId, navigate])

  // ── 2. Reliable Autosave with Queue & Visual Feedback ──
  const processSaveQueue = useCallback(async () => {
    const queue = { ...saveQueueRef.current }
    const qIds = Object.keys(queue)
    if (qIds.length === 0) return

    setSaveStatus('saving')
    try {
      // Save all queued questions
      await Promise.all(
        qIds.map(async (qid) => {
          await api.post(`/student/exams/${examId}/autosave`, {
            questionId: qid,
            answer: queue[qid]
          })
          delete saveQueueRef.current[qid]
        })
      )
      setSaveStatus('saved')
    } catch (err) {
      console.warn('[Autosave] save error:', err.message)
      setSaveStatus('error')
      // Retry in 4 seconds
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(processSaveQueue, 4000)
    }
  }, [examId])

  const setAnswer = (questionId, field, val) => {
    setAnswers(prev => {
      const updatedItem = {
        ...(prev[questionId] || {}),
        [field]: val
      }
      const updated = {
        ...prev,
        [questionId]: updatedItem
      }

      // Add to queue
      saveQueueRef.current[questionId] = updatedItem
      setSaveStatus('saving')

      // Debounce trigger
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(processSaveQueue, 1200)

      return updated
    })
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

  // ── 3. Continuous In-Exam WireGuard VPN Monitor ──
  useEffect(() => {
    if (loading || isWaiting || terminalState) return

    let vpnTimer = null
    const checkVpn = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const res = await fetch('http://127.0.0.1:49152/vpn-check', {
          mode: 'cors',
          signal: controller.signal
        })
        clearTimeout(timeout)

        if (res.ok) {
          const data = await res.json()
          if (!data.connected) {
            // Tunnel disconnected!
            setSuspendedState(prev => {
              if (!prev?.active) {
                emitViolation?.('VPN_DISCONNECT', 'CRITICAL', {
                  details: 'WireGuard tunnel dropped during active test'
                })
              }
              return {
                active: true,
                reason: 'WireGuard VPN tunnel disconnected. Network isolation required.',
                isVpn: true
              }
            })
          } else {
            // Connected & Healthy
            setSuspendedState(prev => (prev?.isVpn ? null : prev))
          }
        }
      } catch {
        // Desktop companion agent offline or unreachable
      }
    }

    vpnTimer = setInterval(checkVpn, 6000)
    return () => {
      if (vpnTimer) clearInterval(vpnTimer)
    }
  }, [loading, isWaiting, terminalState, emitViolation])

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

      // Block Ctrl+C / Ctrl+V / Ctrl+X outside editable inputs
      if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        const targetTag = e.target.tagName?.toLowerCase()
        const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          emitViolation?.('COPY_ATTEMPT', 'LOW')
        }
      }
    }

    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [loading, isWaiting, terminalState, emitViolation])

  // ── 5. Media Hardware Teardown on Exit / Unmount ──
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop())
        } catch {}
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
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
          Your answers have been securely recorded and verified. Proctoring monitors and WireGuard isolation peers have been deactivated.
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
            {suspendedState?.isVpn ? 'WireGuard VPN Disconnected' : 'Examination Session Suspended'}
          </h3>
          <p className="text-sm text-slate-300 max-w-md mb-4 leading-relaxed font-medium">
            {suspendedState?.reason}
          </p>
          {suspendedState?.isVpn && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 max-w-md text-xs text-slate-400 mb-6 text-left">
              <p className="font-bold text-white mb-1">How to resume:</p>
              <p>1. Open the WireGuard application on your computer.</p>
              <p>2. Select the assigned exam tunnel and click <strong className="text-amber-400">Activate</strong>.</p>
              <p>3. This window will automatically resume as soon as the tunnel reconnects.</p>
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
    </div>
  )
}
