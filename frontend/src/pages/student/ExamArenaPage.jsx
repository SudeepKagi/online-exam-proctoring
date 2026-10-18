import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { useExamTimer } from '@/hooks/useExamTimer'
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave'
import { useScreenProctoring } from '@/hooks/useScreenProctoring'
import { getScreenStream } from '@/lib/screenStreamStore'
import { getSocket } from '@/lib/socketClient'
import { Clock, Bookmark, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

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

  const handleSubmitExam = async () => {
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

  const { recordAnswer, flushDirtyAnswers } = useAnswerAutosave({
    attemptId: attempt?.id,
  })

  const { ScreenLostDialog } = useScreenProctoring({
    stream: getScreenStream(),
    attemptId: attempt?.id,
    examId: id,
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
      if (att?.status === 'SUSPENDED') setIsSuspended(true)
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!attempt?.id) return
    const socket = getSocket()
    socket.emit('attempt:join', { attemptId: attempt.id })
    const onSuspended = () => setIsSuspended(true)
    const onResumed = () => setIsSuspended(false)
    socket.on('attempt:suspended', onSuspended)
    socket.on('attempt:resumed', onResumed)

    const poller = setInterval(async () => {
      try {
        const res = await apiClient.get(`/attempts/${attempt.id}`)
        const status = res.data?.attempt?.status || res.data?.status
        if (status === 'SUSPENDED') setIsSuspended(true)
        else if (status === 'IN_PROGRESS') setIsSuspended(false)
      } catch (_) {}
    }, 2000)

    return () => {
      socket.off('attempt:suspended', onSuspended)
      socket.off('attempt:resumed', onResumed)
      clearInterval(poller)
    }
  }, [attempt?.id])

  const currentQ = questions[currentIndex] || null
  const currentSelected = currentQ ? answers[currentQ.id] : null
  const isBookmarked = currentQ ? !!bookmarks[currentQ.id] : false

  const handleSelectOption = (optIdx) => {
    if (!currentQ) return
    setAnswers({ ...answers, [currentQ.id]: optIdx })
    recordAnswer(currentQ.id, optIdx, isBookmarked)
  }

  const handleToggleBookmark = () => {
    if (!currentQ) return
    const nextState = !isBookmarked
    setBookmarks({ ...bookmarks, [currentQ.id]: nextState })
    recordAnswer(currentQ.id, currentSelected, nextState)
  }

  const handleClearAnswer = () => {
    if (!currentQ) return
    const copy = { ...answers }
    delete copy[currentQ.id]
    setAnswers(copy)
    recordAnswer(currentQ.id, null, isBookmarked)
  }

  if (loading) return <ExamArenaShell className="items-center justify-center p-8"><div className="text-slate-500 text-sm">Initializing exam session...</div></ExamArenaShell>

  return (
    <ExamArenaShell className="h-screen flex flex-col bg-[#fbfcfd] font-sans">
      <header className="h-14 bg-white border-b border-[#e9eaf2] px-6 flex items-center justify-between shadow-xs shrink-0 text-[#28253b]">
        <div className="flex items-center gap-3">
          <span className="font-[480] text-[#28253b] text-sm">{exam?.title || 'Exam'}</span>
          <Badge variant="outline" className="text-xs bg-[#edecfb] text-[#5266eb] border border-[#5266eb]/20 font-mono font-[420]">{exam?.courseCode}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-sm font-[480] bg-[#fbfbff] px-3 py-1 rounded-[40px] border border-[#e9eaf2] text-[#28253b]">
            <Clock className="w-4 h-4 text-[#5266eb]" /><span>{formatTime()}</span>
          </div>
          <Button size="sm" onClick={() => setSubmitDialogOpen(true)} className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer">Submit Exam</Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        <div className="col-span-12 lg:col-span-9 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col border-[#e9eaf2] bg-white overflow-hidden shadow-xs rounded-[12px]">
            <CardHeader className="py-3 px-6 border-b border-[#e9eaf2] bg-[#fbfbff] flex flex-row items-center justify-between">
              <span className="text-xs font-[500] text-[#554e7b] uppercase tracking-[0.28px]">Question {currentIndex + 1} of {questions.length}</span>
              <Badge variant="outline" className="text-xs font-[420] text-[#554e7b] border-[#e9eaf2] bg-white">{currentQ?.marks || 1} Point(s)</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-6 overflow-y-auto space-y-4">
              <p className="text-base font-[480] text-[#28253b] leading-relaxed">{currentQ?.questionText || 'Loading question...'}</p>
              <div className="space-y-2.5 pt-2">
                {(Array.isArray(currentQ?.options) ? currentQ.options : []).map((opt, idx) => (
                  <button key={idx} type="button" onClick={() => handleSelectOption(idx)} className={`w-full p-3.5 rounded-[12px] border text-left text-sm flex items-center gap-3 transition-colors cursor-pointer ${currentSelected === idx ? 'border-[#5266eb] bg-[rgba(82,102,235,0.08)] text-[#28253b] font-[480]' : 'border-[#e9eaf2] hover:bg-[#fbfbff] text-[#28253b] font-[400]'}`}>
                    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-[480] shrink-0 ${currentSelected === idx ? 'bg-[#5266eb] text-white' : 'bg-[#fbfbff] text-[#554e7b] border border-[#e9eaf2]'}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </CardContent>
            <CardFooter className="py-3 px-6 border-t border-[#e9eaf2] flex items-center justify-between bg-[#fbfbff]">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))} disabled={currentIndex === 0} className="gap-1 text-xs font-[420] rounded-[40px] px-3.5 h-8 bg-white border-[#c3c3cc]/60"><ChevronLeft className="w-4 h-4" /> Previous</Button>
                <Button variant="outline" size="sm" onClick={handleToggleBookmark} className={`text-xs gap-1.5 font-[420] rounded-[40px] px-3.5 h-8 ${isBookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white border-[#c3c3cc]/60 text-[#28253b]'}`}><Bookmark className="w-3.5 h-3.5" /> Bookmark</Button>
                <Button variant="ghost" size="sm" onClick={handleClearAnswer} className="text-xs text-[#70707d] font-[420] rounded-[40px] px-3 h-8">Clear</Button>
              </div>
              <Button size="sm" onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))} disabled={currentIndex >= questions.length - 1} className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1 text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer">Save & Next <ChevronRight className="w-4 h-4" /></Button>
            </CardFooter>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col border-[#e9eaf2] bg-white overflow-hidden shadow-xs rounded-[12px]">
            <CardHeader className="py-3 px-4 border-b border-[#e9eaf2] bg-[#fbfbff]"><CardTitle className="text-xs font-[500] uppercase text-[#554e7b] tracking-[0.28px]">Question Palette</CardTitle></CardHeader>
            <CardContent className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const answered = answers[q.id] !== undefined
                  const marked = !!bookmarks[q.id]
                  return (
                    <button key={q.id || idx} type="button" onClick={() => setCurrentIndex(idx)} className={`h-9 rounded-lg text-xs font-[480] transition-all cursor-pointer ${currentIndex === idx ? 'ring-2 ring-[#5266eb] ring-offset-1 ' : ''}${marked ? 'bg-amber-500 text-white' : answered ? 'bg-emerald-600 text-white' : 'bg-[#fbfbff] border border-[#e9eaf2] text-[#28253b] hover:bg-[#edecfb]/60'}`}>
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-[480] text-[#28253b]">Submit Examination?</DialogTitle>
            <DialogDescription className="text-xs font-[360] text-[#554e7b]">You have answered {Object.keys(answers).length} of {questions.length} questions. You cannot change answers after submission.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} className="rounded-[40px] px-4 font-[420] text-xs h-9">Continue Exam</Button>
            <Button onClick={handleSubmitExam} disabled={submitting} className="bg-[#5266eb] hover:bg-[#4353c7] text-white rounded-[32px] px-4 font-[420] text-xs h-9">{submitting ? 'Submitting...' : 'Confirm Submission'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-[#171721]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#ededf3] text-center font-sans">
          <div className="w-16 h-16 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-4 border border-red-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-[480] text-[#ededf3] mb-2">Examination Session Suspended</h2>
          <p className="text-sm font-[360] text-[#c3c3cc] max-w-md">Your exam attempt has been temporarily suspended by the proctoring staff. Please await remote review or clearance.</p>
        </div>
      )}

      <ScreenLostDialog />
    </ExamArenaShell>
  )
}
