import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamArenaShell } from '@/components/exam/ExamArenaShell'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { apiClient, ensureArray, errorMessage } from '@/lib/apiClient'
import { Clock, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ExamArenaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [bookmarks, setBookmarks] = useState({})
  const [timeLeft, setTimeLeft] = useState(3600)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      apiClient.get(`/exams/${id}`),
      apiClient.post(`/attempts/exams/${id}/start`, {}).catch(() => apiClient.post(`/attempts/${id}/start`, {})),
    ]).then(([examRes, startRes]) => {
      if (!mounted) return
      const ex = examRes.data?.exam || examRes.data
      setExam(ex)
      setQuestions(ensureArray(ex?.questions))
      setAttempt(startRes.data?.attempt || startRes.data)
      if (ex?.durationMinutes) setTimeLeft(ex.durationMinutes * 60)
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const currentQ = questions[currentIndex] || null
  const currentSelected = currentQ ? answers[currentQ.id] : null
  const isBookmarked = currentQ ? !!bookmarks[currentQ.id] : false

  const handleSelectOption = (optIdx) => {
    if (!currentQ) return
    setAnswers({ ...answers, [currentQ.id]: optIdx })
    if (attempt?.id) apiClient.post(`/attempts/${attempt.id}/answers`, { questionId: currentQ.id, selectedOptionIndex: optIdx, isBookmarked }).catch(() => {})
  }

  const handleToggleBookmark = () => {
    if (!currentQ) return
    setBookmarks({ ...bookmarks, [currentQ.id]: !isBookmarked })
    if (attempt?.id) apiClient.post(`/attempts/${attempt.id}/answers`, { questionId: currentQ.id, selectedOptionIndex: currentSelected, isBookmarked: !isBookmarked }).catch(() => {})
  }

  const handleClearAnswer = () => {
    if (!currentQ) return
    const copy = { ...answers }
    delete copy[currentQ.id]
    setAnswers(copy)
  }

  const handleSubmitExam = async () => {
    setSubmitting(true)
    try {
      if (attempt?.id) await apiClient.post(`/attempts/${attempt.id}/submit`, {})
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      navigate('/student/dashboard')
    } catch (err) {
      alert(errorMessage(err, 'Submission failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (secs) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`

  if (loading) return <ExamArenaShell className="items-center justify-center p-8"><div className="text-slate-500 text-sm">Initializing arena...</div></ExamArenaShell>

  return (
    <ExamArenaShell className="h-screen flex flex-col bg-slate-100">
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 text-sm">{exam?.title || 'Exam'}</span>
          <Badge variant="outline" className="text-xs bg-slate-50 font-mono">{exam?.courseCode}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-sm font-semibold bg-slate-50 px-3 py-1 rounded-md border border-slate-200 text-slate-800">
            <Clock className="w-4 h-4 text-blue-600" /><span>{formatTime(timeLeft)}</span>
          </div>
          <Button size="sm" onClick={() => setSubmitDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Submit Exam</Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        <div className="col-span-12 lg:col-span-9 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col border-slate-200 bg-white overflow-hidden shadow-xs">
            <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Question {currentIndex + 1} of {questions.length}</span>
              <Badge variant="outline" className="text-xs text-slate-600">{currentQ?.marks || 1} Point(s)</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-6 overflow-y-auto space-y-4">
              <p className="text-base font-medium text-slate-900 leading-relaxed">{currentQ?.questionText || 'Loading question...'}</p>
              <div className="space-y-2.5 pt-2">
                {(Array.isArray(currentQ?.options) ? currentQ.options : []).map((opt, idx) => (
                  <button key={idx} type="button" onClick={() => handleSelectOption(idx)} className={`w-full p-3.5 rounded-lg border text-left text-sm flex items-center gap-3 transition-colors ${currentSelected === idx ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-800'}`}>
                    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${currentSelected === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </CardContent>
            <CardFooter className="py-3 px-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))} disabled={currentIndex === 0} className="gap-1 text-xs"><ChevronLeft className="w-4 h-4" /> Previous</Button>
                <Button variant="outline" size="sm" onClick={handleToggleBookmark} className={`text-xs gap-1.5 ${isBookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : ''}`}><Bookmark className="w-3.5 h-3.5" /> Bookmark</Button>
                <Button variant="ghost" size="sm" onClick={handleClearAnswer} className="text-xs text-slate-500">Clear</Button>
              </div>
              <Button size="sm" onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))} disabled={currentIndex >= questions.length - 1} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs">Save & Next <ChevronRight className="w-4 h-4" /></Button>
            </CardFooter>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col border-slate-200 bg-white overflow-hidden shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100"><CardTitle className="text-xs font-semibold uppercase text-slate-500">Question Palette</CardTitle></CardHeader>
            <CardContent className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const answered = answers[q.id] !== undefined
                  const marked = !!bookmarks[q.id]
                  return (
                    <button key={q.id || idx} type="button" onClick={() => setCurrentIndex(idx)} className={`h-9 rounded-md text-xs font-bold transition-all ${currentIndex === idx ? 'ring-2 ring-blue-600 ring-offset-1 ' : ''}${marked ? 'bg-amber-500 text-white' : answered ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Examination?</DialogTitle>
            <DialogDescription>You have answered {Object.keys(answers).length} of {questions.length} questions. You cannot change answers after submission.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Continue Exam</Button>
            <Button onClick={handleSubmitExam} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{submitting ? 'Submitting...' : 'Confirm Submission'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExamArenaShell>
  )
}
