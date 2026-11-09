import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { SubmitExamDialog, SuspendedOverlay, DuplicateTabOverlay } from '@/components/exam/SubmitExamDialog'
import { ExamArenaHeader } from '@/components/exam/ExamArenaHeader'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave'
import { useScreenProctoring } from '@/hooks/useScreenProctoring'
import { useArenaSocketAndTab, restoreAnswers } from '@/hooks/useArenaSocketAndTab'
import { getCameraStream, clearCameraStream } from '@/lib/screenStreamStore'
import QuestionPalette from '@/components/exam/QuestionPalette'
import QuestionCard from '@/components/exam/QuestionCard'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default function ExamArenaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [sebStatus, setSebStatus] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [bookmarks, setBookmarks] = useState({})
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [exitCountdown, setExitCountdown] = useState(5)
  const [isAutoExitCancelled, setIsAutoExitCancelled] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const teardownTimerRef = useRef(null)

  const handleTerminationExit = useCallback((msg = 'Your examination was terminated because maximum violations (3/3) were exceeded.') => {
    clearCameraStream()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate('/student/dashboard', { replace: true, state: { errorMsg: msg } })
  }, [navigate])

  const { isSuspended, setIsSuspended, isDuplicateTab } = useArenaSocketAndTab({
    examId: id, attemptId: attempt?.id, onTerminated: handleTerminationExit,
  })

  const handleSubmitExam = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (flushDirtyAnswers) await flushDirtyAnswers()
      if (attempt?.id) await apiClient.post(`/attempts/${attempt.id}/submit`, {})
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      clearCameraStream()
      setIsSubmitted(true)
    } catch (err) {
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') return handleTerminationExit()
      alert(errorMessage(err, 'Submission failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const { formatTime } = useExamTimer({
    expiresAt: attempt?.expiresAt,
    durationMinutes: exam?.durationMinutes || 60,
    onExpire: handleSubmitExam,
    enabled: !!attempt?.expiresAt,
  })

  const { recordAnswer, flushDirtyAnswers, isDirty } = useAnswerAutosave({
    attemptId: attempt?.id,
    onError: (err) => {
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') handleTerminationExit()
      else if (err.response?.data?.code === 'ATTEMPT_SUSPENDED') setIsSuspended(true)
    }
  })

  const handleViolationDetected = useCallback(() => {
    setViolationCount(prev => {
      const next = prev + 1
      if (next >= 3) {
        setTimeout(() => {
          handleTerminationExit('Your examination was terminated because maximum violations (3/3) were exceeded.')
        }, 500)
      }
      return next
    })
  }, [handleTerminationExit])

  const { CameraDisconnectedOverlay, isProctoringInterrupted } = useScreenProctoring({
    stream: attempt ? getCameraStream() : null,
    attemptId: attempt?.id,
    examId: id,
    onViolation: handleViolationDetected,
  })

  useEffect(() => {
    // If remounting within StrictMode window, cancel pending stream teardown
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current)
      teardownTimerRef.current = null
    }

    let mounted = true
    const initArena = async () => {
      try {
        const [examRes, startRes] = await Promise.all([
          apiClient.get(`/exams/${id}`),
          apiClient.post(`/attempts/exams/${id}/start`, {}).catch((err) => {
            if (err.response?.status === 403 || err.response?.status === 404) throw err
            return apiClient.post(`/attempts/${id}/start`, {})
          }),
        ])
        if (!mounted) return
        const ex = examRes.data?.exam || examRes.data
        const att = startRes.data?.attempt || startRes.data
        const qs = ensureArray(startRes.data?.questions || ex?.questions)
        if (!att || !qs.length || att.status !== 'IN_PROGRESS') {
          throw new Error('Examination session is not active or questions are unavailable.')
        }
        setExam(ex); setQuestions(qs); setAttempt(att)
        apiClient.get(`/attempts/exams/${id}/seb-status`)
          .then(res => { if (mounted) setSebStatus(res.data) })
          .catch(() => {})
        if (att?.violationCount) {
          setViolationCount(att.violationCount)
          if (att.violationCount >= 3) return handleTerminationExit()
        }
        if (att?.status === 'SUSPENDED') setIsSuspended(true)

        const { restored, restoredBm } = restoreAnswers(startRes.data?.answers, att?.id)
        setAnswers(prev => ({ ...restored, ...prev }))
        setBookmarks(prev => ({ ...restoredBm, ...prev }))
        setLoading(false)
      } catch (err) {
        if (!mounted) return
        clearCameraStream()
        navigate('/student/dashboard', { replace: true, state: { errorMsg: errorMessage(err, 'Exam is not currently available.') } })
      }
    }
    initArena()

    const handleBeforeUnload = () => {
      clearCameraStream()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      mounted = false
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Defer stream teardown by 100ms so dev StrictMode double-mount
      // does not prematurely terminate active media tracks.
      teardownTimerRef.current = setTimeout(() => {
        clearCameraStream()
      }, 100)
    }
  }, [id, navigate, handleTerminationExit, setIsSuspended])

  const isArenaInteractionLocked = isSuspended || isDuplicateTab || isProctoringInterrupted
  const currentQ = questions[currentIndex] || null
  const currentSelected = currentQ ? answers[currentQ.id] : null
  const isBookmarked = currentQ ? !!bookmarks[currentQ.id] : false

  const handleSelectOption = useCallback((optIdx) => {
    if (!currentQ || isArenaInteractionLocked) return
    setAnswers(prev => ({ ...prev, [currentQ.id]: optIdx }))
    recordAnswer(currentQ.id, optIdx, isBookmarked)
  }, [currentQ, isBookmarked, recordAnswer, isArenaInteractionLocked])

  const handleToggleBookmark = () => {
    if (!currentQ || isArenaInteractionLocked) return
    setBookmarks(prev => ({ ...prev, [currentQ.id]: !isBookmarked }))
    recordAnswer(currentQ.id, currentSelected, !isBookmarked)
  }

  const handleClearAnswer = () => {
    if (!currentQ || isArenaInteractionLocked) return
    setAnswers(prev => { const copy = { ...prev }; delete copy[currentQ.id]; return copy })
    recordAnswer(currentQ.id, null, isBookmarked)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isArenaInteractionLocked || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const map = { '1': 0, A: 0, '2': 1, B: 1, '3': 2, C: 2, '4': 3, D: 3 }
      const key = e.key.toUpperCase()
      if (map[key] !== undefined) handleSelectOption(map[key])
      else if (e.key === 'ArrowRight') setCurrentIndex(p => Math.min(questions.length - 1, p + 1))
      else if (e.key === 'ArrowLeft') setCurrentIndex(p => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectOption, questions.length, isArenaInteractionLocked])

  useEffect(() => {
    if (!isSubmitted || isAutoExitCancelled) return

    const sebQuitUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEB_QUIT_URL) || 'http://localhost:5173/student/login'
    const isSeb = Boolean(exam?.proctoringConfig?.sebRequired && (sebStatus?.verified || (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('SEB'))))

    if (exitCountdown <= 0) {
      if (isSeb) {
        window.location.href = sebQuitUrl
      } else {
        navigate('/student/dashboard')
      }
      return
    }

    const timer = setTimeout(() => {
      setExitCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [isSubmitted, isAutoExitCancelled, exitCountdown, exam, sebStatus, navigate])

  if (isSubmitted) {
    const sebQuitUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEB_QUIT_URL) || 'http://localhost:5173/student/login'
    const isSeb = Boolean(exam?.proctoringConfig?.sebRequired && (sebStatus?.verified || (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('SEB'))))
    return (
      <ExamArenaShell className="items-center justify-center p-6 bg-[#fbfcfd] font-sans">
        <div className="w-full max-w-md bg-white rounded-[16px] p-8 text-center shadow-md space-y-4">
          <div className="w-16 h-16 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-[480] text-[#28253b]">Examination Submitted</h2>
          <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
            Your responses have been successfully recorded and finalized on the server.
          </p>

          {!isAutoExitCancelled && exitCountdown > 0 ? (
            <div
              data-testid="auto-exit-banner"
              className="p-3 bg-[#fbfbff] border border-[#e9eaf2] rounded-xl text-xs text-[#554e7b] font-[420] flex items-center justify-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-ping" />
              <span>
                {isSeb
                  ? `Exiting secure browser in ${exitCountdown} second${exitCountdown === 1 ? '' : 's'}...`
                  : `Returning to dashboard in ${exitCountdown} second${exitCountdown === 1 ? '' : 's'}...`}
              </span>
            </div>
          ) : isAutoExitCancelled ? (
            <div
              data-testid="auto-exit-cancelled-banner"
              className="p-2.5 bg-[#edecfb] text-[#5266eb] rounded-xl text-xs font-[420]"
            >
              Auto-exit cancelled. You may close or navigate at your convenience.
            </div>
          ) : null}

          <div className="pt-2 flex flex-col gap-2.5">
            {isSeb ? (
              <Button
                type="button"
                onClick={() => { window.location.href = sebQuitUrl }}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
              >
                Exit secure browser
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => navigate('/student/dashboard')}
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
              >
                Return to Student Dashboard
              </Button>
            )}
            {!isAutoExitCancelled && exitCountdown > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAutoExitCancelled(true)}
                className="w-full text-xs font-[420] h-10 rounded-[40px] border-0 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] cursor-pointer"
              >
                Cancel auto-exit
              </Button>
            )}
          </div>
        </div>
      </ExamArenaShell>
    )
  }

  if (loading) {
    return (
      <ExamArenaShell className="items-center justify-center p-8">
        <div className="text-[#554e7b] text-sm font-[420] animate-pulse">Initializing secure exam session...</div>
      </ExamArenaShell>
    )
  }

  return (
    <ExamArenaShell className="h-screen flex flex-col bg-[#fbfcfd] font-sans">
      <ExamArenaHeader
        exam={exam}
        violationCount={violationCount}
        formatTime={formatTime}
        onSubmitClick={() => setSubmitDialogOpen(true)}
      />

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        <div className="col-span-12 lg:col-span-9 flex flex-col min-h-0">
          <QuestionCard
            currentQ={currentQ}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            currentSelected={currentSelected}
            isBookmarked={isBookmarked}
            onSelectOption={handleSelectOption}
            onToggleBookmark={handleToggleBookmark}
            onClearAnswer={handleClearAnswer}
            onPrev={() => setCurrentIndex(p => Math.max(0, p - 1))}
            onNext={() => setCurrentIndex(p => Math.min(questions.length - 1, p + 1))}
          />
        </div>

        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            onSelectIndex={setCurrentIndex}
            answers={answers}
            bookmarks={bookmarks}
            isDirty={isDirty}
          />
        </div>
      </div>

      <SubmitExamDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        answeredCount={Object.keys(answers).length}
        totalCount={questions.length}
        onConfirm={handleSubmitExam}
        submitting={submitting}
      />

      {isSuspended && <SuspendedOverlay />}
      {isDuplicateTab && <DuplicateTabOverlay />}
      <CameraDisconnectedOverlay />
    </ExamArenaShell>
  )
}
