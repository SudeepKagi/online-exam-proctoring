import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

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

  // ── Question & Answer Navigation ──
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flagged, setFlagged] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  const autoSaveRef = useRef(null)
  const streamRef = useRef(null)

  // ── Submit Exam Function ──
  const handleSubmit = useCallback(async (forced = false) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await api.post(`/student/exams/${examId}/submit`, { answers })
      toast.success(forced ? 'Exam auto-submitted' : 'Exam submitted successfully!')
      navigate('/student/results', { replace: true })
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Submission encountered an error. Retrying…')
    } finally {
      setSubmitting(false)
      setShowSubmitConfirm(false)
    }
  }, [examId, answers, submitting, navigate])

  // ── Hook 1: Exam Timer ──
  const { formattedTime, isUrgent, isCritical } = useExamTimer({
    endTime: exam?.endTime,
    durationMinutes: exam?.duration,
    onTimeUp: () => handleSubmit(true),
    autoStart: !isWaiting && !loading
  })

  // ── Hook 2: Socket.io & WebRTC ──
  const { socketConnected, violations, emitViolation } = useExamSocket({
    examId,
    user,
    streamRef,
    onTerminated: () => handleSubmit(true)
  })

  // ── Hook 3: Proctoring Monitors ──
  const {
    videoRef,
    captureVideoRef,
    canvasRef,
    cameraOk,
    faceOk,
    yoloStatus,
    micLevel,
    isFullscreenLocked
  } = useProctoringMonitors({
    emitViolation,
    isExamActive: !isWaiting && !loading
  })

  // ── 1. Fetch Exam Initialization ──
  useEffect(() => {
    let interval = null
    const initExam = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/student/exams/${examId}/start`)
        if (res.data.waiting) {
          setIsWaiting(true)
          setExam(res.data.exam)
          const startMs = new Date(res.data.exam.startTime).getTime()
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
        toast.error(err.response?.data?.error || 'Failed to start exam')
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

  // ── 2. Answer Change with Debounced Auto-Save ──
  const setAnswer = (questionId, field, val) => {
    setAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: {
          ...(prev[questionId] || {}),
          [field]: val
        }
      }

      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      autoSaveRef.current = setTimeout(() => {
        api.post(`/student/exams/${examId}/autosave`, {
          questionId,
          answer: updated[questionId]
        }).catch(() => {})
      }, 1500)

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
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center font-mono text-xs text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
        Securing proctoring session…
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col font-sans select-none">
      {/* Hidden capture elements */}
      <video ref={captureVideoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Fullscreen compliance prompt if student leaves fullscreen */}
      {!isFullscreenLocked && (
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
        yoloStatus={yoloStatus}
        micLevel={micLevel}
        socketConnected={socketConnected}
        violations={violations}
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
