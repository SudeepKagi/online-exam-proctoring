import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SubmitExamDialog, SuspendedOverlay } from '@/components/exam/SubmitExamDialog'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave'
import { useScreenProctoring } from '@/hooks/useScreenProctoring'
import { getScreenStream } from '@/lib/screenStreamStore'
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
  const [violationCount, setViolationCount] = useState(0)

  const handleSubmitExam = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (flushDirtyAnswers) await flushDirtyAnswers()
      if (attempt?.id) await apiClient.post(`/attempts/${attempt.id}/submit`, {})
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      navigate('/student/dashboard')
    } catch (err) {
      alert(errorMessage(err, 'Submission failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const { formatTime } = useExamTimer({
    expiresAt: attempt?.expiresAt,
    durationMinutes: exam?.durationMinutes || 60,
    onExpire: handleSubmitExam,
  })

  const { recordAnswer, flushDirtyAnswers, isDirty } = useAnswerAutosave({
    attemptId: attempt?.id,
  })

  const handleViolationDetected = useCallback(() => {
    setViolationCount(prev => prev + 1)
  }, [])

  const { ScreenLostDialog } = useScreenProctoring({
    stream: getScreenStream(),
    attemptId: attempt?.id,
    examId: id,
    onViolation: handleViolationDetected,
  })

  useEffect(() => {
    let mounted = true
    Promise.all([
      apiClient.get(`/exams/${id}`),
      apiClient.post(`/attempts/exams/${id}/start`, {}).catch(() => apiClient.post(`/attempts/${id}/start`, {})),
    ]).then(([examRes, startRes]) => {
      if (!mounted) return
      const ex = examRes.data?.exam || examRes.data
      const att = startRes.data?.attempt || startRes.data
      setExam(ex)
      setQuestions(ensureArray(ex?.questions))
      setAttempt(att)
      if (att?.violationCount) setViolationCount(att.violationCount)
      if (att?.status === 'SUSPENDED') setIsSuspended(true)

      const serverAnswers = startRes.data?.answers
      if (Array.isArray(serverAnswers)) {
        const restored = {}
        const restoredBm = {}
        serverAnswers.forEach(a => {
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
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!attempt?.id) return
    const socket = getSocket()
    socket.emit('attempt:join', { attemptId: attempt.id })
    const onSuspended = () => setIsSuspended(true)
    const onResumed = () => setIsSuspended(false)
    socket.on('attempt:suspended', onSuspended).on('attempt:resumed', onResumed)
    return () => {
      socket.off('attempt:suspended', onSuspended).off('attempt:resumed', onResumed)
    }
  }, [attempt?.id])

  const currentQ = questions[currentIndex] || null
  const currentSelected = currentQ ? answers[currentQ.id] : null
  const isBookmarked = currentQ ? !!bookmarks[currentQ.id] : false

  const handleSelectOption = useCallback((optIdx) => {
    if (!currentQ) return
    setAnswers(prev => ({ ...prev, [currentQ.id]: optIdx }))
    recordAnswer(currentQ.id, optIdx, isBookmarked)
  }, [currentQ, isBookmarked, recordAnswer])

  const handleToggleBookmark = () => {
    if (!currentQ) return
    setBookmarks(prev => ({ ...prev, [currentQ.id]: !isBookmarked }))
    recordAnswer(currentQ.id, currentSelected, !isBookmarked)
  }

  const handleClearAnswer = () => {
    if (!currentQ) return
    setAnswers(prev => { const copy = { ...prev }; delete copy[currentQ.id]; return copy })
    recordAnswer(currentQ.id, null, isBookmarked)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const map = { '1': 0, A: 0, '2': 1, B: 1, '3': 2, C: 2, '4': 3, D: 3 }
      const key = e.key.toUpperCase()
      if (map[key] !== undefined) handleSelectOption(map[key])
      else if (e.key === 'ArrowRight') setCurrentIndex(p => Math.min(questions.length - 1, p + 1))
      else if (e.key === 'ArrowLeft') setCurrentIndex(p => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectOption, questions.length])

  if (loading) {
    return (
      <ExamArenaShell className="items-center justify-center p-8">
        <div className="text-slate-500 text-sm font-medium animate-pulse">Initializing secure exam session...</div>
      </ExamArenaShell>
    )
  }

  return (
    <ExamArenaShell className="h-screen flex flex-col bg-[#fbfcfd] font-sans">
      <header className="h-14 bg-white border-b border-[#e9eaf2] px-6 flex items-center justify-between shadow-xs shrink-0 text-[#28253b]">
        <div className="flex items-center gap-3">
          <span className="font-[480] text-[#28253b] text-sm">{exam?.title || 'Examination'}</span>
          <Badge variant="outline" className="text-xs bg-[#edecfb] text-[#5266eb] border border-[#5266eb]/20 font-mono font-[420]">
            {exam?.courseCode || 'ASSESSMENT'}
          </Badge>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <MonitorCheck className="w-3.5 h-3.5 ml-0.5" />
            <span>Screen Monitoring Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`font-mono text-xs px-2.5 py-1 gap-1 ${
            violationCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Violations: {violationCount} / 3</span>
          </Badge>
          <div className="flex items-center gap-1.5 font-mono text-sm font-[480] bg-[#fbfbff] px-3 py-1 rounded-[40px] border border-[#e9eaf2] text-[#28253b]">
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

      <ScreenLostDialog />
    </ExamArenaShell>
  )
}
