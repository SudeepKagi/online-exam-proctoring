import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SubmitExamDialog, SuspendedOverlay, DuplicateTabOverlay } from '@/components/exam/SubmitExamDialog'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave'
import { useScreenProctoring } from '@/hooks/useScreenProctoring'
import { getScreenStream, clearScreenStream, clearCameraStream } from '@/lib/screenStreamStore'
import { getSocket } from '@/lib/socketClient'
import { Clock, ShieldAlert, MonitorCheck } from 'lucide-react'
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
  const [isSuspended, setIsSuspended] = useState(false)
  const [isDuplicateTab, setIsDuplicateTab] = useState(false)
  const [violationCount, setViolationCount] = useState(0)

  const handleTerminationExit = useCallback((msg = 'Your examination was terminated because maximum violations (3/3) were exceeded.') => {
    clearScreenStream()
    clearCameraStream()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate('/student/dashboard', {
      replace: true,
      state: { errorMsg: msg }
    })
  }, [navigate])

  const handleSubmitExam = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (flushDirtyAnswers) await flushDirtyAnswers()
      if (attempt?.id) await apiClient.post(`/attempts/${attempt.id}/submit`, {})
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      clearScreenStream()
      clearCameraStream()
      navigate('/student/dashboard')
    } catch (err) {
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') {
        handleTerminationExit()
        return
      }
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
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') {
        handleTerminationExit()
      } else if (err.response?.data?.code === 'ATTEMPT_SUSPENDED') {
        setIsSuspended(true)
      }
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

  // BroadcastChannel for Multi-Tab / Duplicate Session Protection
  useEffect(() => {
    if (!id || typeof window === 'undefined' || !window.BroadcastChannel) return
    const channel = new BroadcastChannel('proctornet_active_exam')
    const mySessionId = Math.random().toString(36).substring(2)

    channel.postMessage({ type: 'CHECK_ACTIVE_TAB', examId: id, sessionId: mySessionId })

    const handleMessage = (event) => {
      const data = event.data
      if (!data || data.examId !== id) return
      if (data.type === 'CHECK_ACTIVE_TAB' && data.sessionId !== mySessionId) {
        channel.postMessage({ type: 'TAB_ACTIVE', examId: id, sessionId: mySessionId })
      } else if (data.type === 'TAB_ACTIVE' && data.sessionId !== mySessionId) {
        setIsDuplicateTab(true)
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [id])

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
        setExam(ex)
        setQuestions(qs)
        setAttempt(att)
        if (att?.violationCount) {
          setViolationCount(att.violationCount)
          if (att.violationCount >= 3) {
            handleTerminationExit('Your examination was terminated because maximum violations (3/3) were exceeded.')
            return
          }
        }
        if (att?.status === 'SUSPENDED') setIsSuspended(true)

        if (Array.isArray(startRes.data?.answers)) {
          const restored = {}, restoredBm = {}
          startRes.data.answers.forEach(a => {
            if (!a.questionId) return
            if (a.selectedOptionIndex !== null && a.selectedOptionIndex !== undefined) restored[a.questionId] = a.selectedOptionIndex
            if (a.isBookmarked) restoredBm[a.questionId] = true
          })
          try {
            const cached = att?.id && localStorage.getItem(`pn_offline_answers_${att.id}`)
            if (cached) {
              const parsed = JSON.parse(cached)
              Object.keys(parsed).forEach(qId => {
                if (parsed[qId]?.selectedOptionIndex !== undefined) restored[qId] = parsed[qId].selectedOptionIndex
              })
            }
          } catch (_) {}
          setAnswers(prev => ({ ...restored, ...prev }))
          setBookmarks(prev => ({ ...restoredBm, ...prev }))
        }
        setLoading(false)
      } catch (err) {
        if (!mounted) return
        clearScreenStream()
        clearCameraStream()
        const msg = errorMessage(err, 'Exam is not currently available.')
        navigate('/student/dashboard', { replace: true, state: { errorMsg: msg } })
      }
    }
    initArena()
    return () => { mounted = false; clearScreenStream(); clearCameraStream() }
  }, [id, navigate, handleTerminationExit])

  useEffect(() => {
    if (!attempt?.id) return
    const socket = getSocket()
    socket.emit('attempt:join', { attemptId: attempt.id })
    const onSusp = () => setIsSuspended(true)
    const onRes = () => setIsSuspended(false)
    const onTerm = (data) => {
      handleTerminationExit(data?.reason === 'MAX_VIOLATIONS_EXCEEDED'
        ? 'Your examination was terminated because maximum violations (3/3) were exceeded.'
        : 'Your examination was terminated by an invigilator.')
    }
    socket.on('attempt:suspended', onSusp)
      .on('attempt:resumed', onRes)
      .on('attempt:terminated', onTerm)
    return () => {
      socket.off('attempt:suspended', onSusp)
        .off('attempt:resumed', onRes)
        .off('attempt:terminated', onTerm)
    }
  }, [attempt?.id, handleTerminationExit])

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
      if (isArenaInteractionLocked) return
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
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
      <header className="h-14 bg-white border-b border-[#e9eaf2] px-6 flex items-center justify-between shadow-xs shrink-0 text-[#28253b]">
        <div className="flex items-center gap-3">
          <span className="font-[480] text-[#28253b] text-sm">{exam?.title || 'Examination'}</span>
          <Badge variant="outline" className="text-xs bg-[#edecfb] text-[#5266eb] border-0 font-mono font-[420]">
            {exam?.courseCode || 'ASSESSMENT'}
          </Badge>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edecfb] text-[#28253b] border-0 text-xs font-[420]">
            <span className="w-2 h-2 rounded-full bg-[#5266eb] animate-ping inline-block" />
            <MonitorCheck className="w-3.5 h-3.5 ml-0.5 text-[#5266eb]" />
            <span>Screen Monitoring Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 gap-1 bg-[#edecfb] text-[#28253b] border-0 rounded-full">
            <ShieldAlert className="w-3.5 h-3.5 text-[#5266eb]" />
            <span>Violations: {violationCount} / 3</span>
          </Badge>
          <div className="flex items-center gap-1.5 font-mono text-sm font-[480] bg-[#edecfb] px-3 py-1 rounded-[40px] border-0 text-[#28253b]">
            <Clock className="w-4 h-4 text-[#5266eb]" />
            <span>{formatTime()}</span>
          </div>
          <Button size="sm" onClick={() => setSubmitDialogOpen(true)} className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer">
            Submit Exam
          </Button>
        </div>
      </header>

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
