import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { SubmitExamDialog, SuspendedOverlay, DuplicateTabOverlay } from '@/components/exam/SubmitExamDialog'
import { ExamArenaHeader } from '@/components/exam/ExamArenaHeader'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave'
import { useScreenProctoring } from '@/hooks/useScreenProctoring'
import { useArenaSocketAndTab, restoreAnswers } from '@/hooks/useArenaSocketAndTab'
import { getScreenStream, clearScreenStream, clearCameraStream } from '@/lib/screenStreamStore'
import QuestionPalette from '@/components/exam/QuestionPalette'
import QuestionCard from '@/components/exam/QuestionCard'

export default function ExamArenaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [bookmarks, setBookmarks] = useState({})
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [violationCount, setViolationCount] = useState(0)

  const handleTerminationExit = useCallback((msg = 'Your examination was terminated because maximum violations (3/3) were exceeded.') => {
    clearScreenStream(); clearCameraStream()
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
      clearScreenStream(); clearCameraStream(); navigate('/student/dashboard')
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

  const { ScreenLostDialog, isProctoringInterrupted } = useScreenProctoring({
    stream: attempt ? getScreenStream() : null,
    attemptId: attempt?.id,
    examId: id,
    onViolation: handleViolationDetected,
  })

  useEffect(() => {
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
        const qs = ensureArray(ex?.questions)
        if (!att || !qs.length || att.status !== 'IN_PROGRESS') {
          throw new Error('Examination session is not active or questions are unavailable.')
        }
        setExam(ex); setQuestions(qs); setAttempt(att)
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
        clearScreenStream(); clearCameraStream()
        navigate('/student/dashboard', { replace: true, state: { errorMsg: errorMessage(err, 'Exam is not currently available.') } })
      }
    }
    initArena()
    return () => { mounted = false; clearScreenStream(); clearCameraStream() }
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
      <ScreenLostDialog />
    </ExamArenaShell>
  )
}
