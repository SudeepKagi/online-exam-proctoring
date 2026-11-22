import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/apiClient'
import { mapClientError } from '@/lib/clientErrorMapper'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Award,
  ArrowLeft,
  Printer,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FileText,
  RefreshCw
} from 'lucide-react'

export default function StudentResultsPage() {
  const { attemptId, id: examId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  usePageTitle(data?.exam?.title ? `${data.exam.title} — Results` : 'Examination Results')

  const fetchResults = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      let endpoint = ''
      if (attemptId) {
        endpoint = `/attempts/${attemptId}/results`
      } else if (examId) {
        endpoint = `/attempts/exams/${examId}/my-result`
      } else {
        throw new Error('No assessment or attempt identifier provided.')
      }

      const res = await api.get(endpoint, { signal })
      setData(res.data)
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return
      setError(mapClientError(err, 'retry'))
    } finally {
      setLoading(false)
    }
  }, [attemptId, examId])

  useEffect(() => {
    const controller = new AbortController()
    fetchResults(controller.signal)
    return () => { controller.abort() }
  }, [fetchResults])

  if (loading) {
    return (
      <DashboardShell title="Examination Results">
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-44 bg-[#edecfb] rounded-[16px]" />
          <div className="h-64 bg-[#fbfbff] rounded-[16px]" />
        </div>
      </DashboardShell>
    )
  }

  if (error || !data) {
    const errorDetails = error || { title: 'Results Not Available', message: 'The requested examination attempt results could not be located.' }

    return (
      <DashboardShell title="Examination Results">
        <div className="max-w-xl mx-auto my-12 text-center p-8 bg-[#edecfb] rounded-[24px]">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white flex items-center justify-center text-[#5266eb]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-[480] text-[#28253b] mb-2">{errorDetails.title || 'Results Not Available'}</h2>
          <p className="text-xs text-[#554e7b] font-[360] leading-relaxed mb-4">
            {errorDetails.message}
          </p>
          {errorDetails.referenceId && (
            <p className="text-[11px] font-mono text-[#554e7b]/80 mb-6">
              Reference: {errorDetails.referenceId}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => fetchResults()}
              className="rounded-[32px] px-6 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/student/dashboard')}
              className="rounded-[32px] px-6 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Button>
          </div>
        </div>
      </DashboardShell>
    )
  }

  const { attempt, exam, student, resultsReleased, releaseNotice, questions } = data
  const isPassed = attempt?.isPassed

  return (
    <DashboardShell title="Examination Results">
      <div className="max-w-4xl mx-auto space-y-6 font-sans pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-[#554e7b] hover:text-[#28253b] font-[420] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Dashboard
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-[40px] text-xs font-[420]"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-[#554e7b]" /> Print Summary
          </Button>
        </div>

        {/* Hero Score Breakdown Card */}
        <div className="bg-[#edecfb] rounded-[16px] p-6 md:p-8 text-[#28253b]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-[420] bg-white/80 text-[#28253b] border-transparent">
                  {exam?.courseCode}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-[420] border-transparent ${
                    isPassed
                      ? 'bg-[#5266eb]/15 text-[#5266eb]'
                      : 'bg-[#554e7b]/15 text-[#554e7b]'
                  }`}
                >
                  {isPassed ? 'Passed' : 'Needs Review'}
                </Badge>
              </div>
              <h1 className="text-xl md:text-2xl font-[480] tracking-tight text-[#28253b]">
                {exam?.title}
              </h1>
              <p className="text-xs text-[#554e7b] font-[360]">
                Candidate: <strong className="text-[#28253b] font-[420]">{student?.fullName}</strong> • Roll No: <strong className="text-[#28253b] font-mono font-[420]">{student?.institutionId}</strong>
              </p>
            </div>

            {/* Score Pill */}
            <div className="bg-white rounded-[16px] px-6 py-4 shadow-[0_4px_20px_rgba(40,37,59,0.04)] text-center shrink-0 min-w-[180px]">
              <span className="block text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] mb-0.5">
                Final Score
              </span>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl font-[480] text-[#5266eb] tracking-tight">
                  {attempt?.score}
                </span>
                <span className="text-xs text-[#554e7b] font-[360]">
                  / {attempt?.totalMarks} pts
                </span>
              </div>
              <span className="inline-block text-[11px] font-[420] text-[#554e7b] mt-1 bg-[#fbfbff] px-2 py-0.5 rounded-full">
                {attempt?.percentage}% Achieved
              </span>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="mt-6 pt-6 border-t border-[#c3c3cc]/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-[360]">
            <div>
              <span className="block text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] mb-1">Passing Mark</span>
              <span className="font-[480] text-[#28253b]">{attempt?.passingMarks} pts</span>
            </div>
            <div>
              <span className="block text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] mb-1">Questions Attempted</span>
              <span className="font-[480] text-[#28253b]">{attempt?.attemptedCount} of {attempt?.questionsCount}</span>
            </div>
            <div>
              <span className="block text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] mb-1">Unattempted</span>
              <span className="font-[480] text-[#28253b]">{attempt?.unattemptedCount}</span>
            </div>
            <div>
              <span className="block text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] mb-1">Submission Date</span>
              <span className="font-[480] text-[#28253b]">
                {attempt?.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString([], { dateStyle: 'short' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Release Status or Question Review */}
        {!resultsReleased ? (
          <div className="bg-[#fbfbff] rounded-[16px] p-6 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-[480] text-[#28253b]">Question Review Restricted</h3>
            <p className="text-xs text-[#554e7b] font-[360] max-w-lg mx-auto leading-relaxed">
              {releaseNotice || 'Detailed question review and answer keys are protected by the institutional examination policy and will be unlocked once all submissions are finalized.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-[480] text-[#28253b] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#5266eb]" /> Question-by-Question Review
              </h2>
              <span className="text-xs text-[#554e7b] font-[360]">
                {questions?.length || 0} Questions Evaluated
              </span>
            </div>

            {questions && questions.map((q) => {
              const hasAnswered = q.selectedOptionIndex !== null && q.selectedOptionIndex !== undefined
              const optionsList = Array.isArray(q.options) ? q.options : []

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-[16px] p-5 shadow-[0_2px_12px_rgba(40,37,59,0.02)] space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] font-[480] text-xs flex items-center justify-center">
                        {q.questionNumber}
                      </span>
                      <span className="text-xs font-[420] text-[#28253b]">
                        Question {q.questionNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {q.isCorrect ? (
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[#5266eb]/10 text-[#5266eb] border-transparent flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Correct (+{q.scoreAwarded} pts)
                        </Badge>
                      ) : hasAnswered ? (
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[#554e7b]/10 text-[#554e7b] border-transparent flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Incorrect ({q.scoreAwarded} pts)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-[420] bg-[#fbfbff] text-[#70707d] border-transparent">
                          Unattempted (0 pts)
                        </Badge>
                      )}
                      <span className="text-xs text-[#70707d] font-[360]">
                        Weight: {q.marks} pts
                      </span>
                    </div>
                  </div>

                  <p className="text-xs md:text-sm text-[#28253b] font-[420] leading-relaxed pl-8">
                    {q.questionText}
                  </p>

                  {/* Options List */}
                  <div className="space-y-2 pl-8">
                    {optionsList.map((opt, optIdx) => {
                      const isSelected = q.selectedOptionIndex === optIdx
                      const isCorrect = q.correctOptionIndex === optIdx

                      let optionBg = 'bg-[#fbfbff] text-[#28253b]'
                      let borderRing = ''

                      if (isCorrect) {
                        optionBg = 'bg-[#edecfb] text-[#5266eb] font-[480]'
                      } else if (isSelected && !isCorrect) {
                        optionBg = 'bg-[#fbfbff] text-[#554e7b]'
                        borderRing = 'ring-1 ring-[#554e7b]/30'
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between p-3 rounded-[12px] text-xs transition-colors ${optionBg} ${borderRing}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-white/80 text-[10px] font-mono flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="font-[360]">{typeof opt === 'string' ? opt : opt?.text || JSON.stringify(opt)}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSelected && (
                              <span className="text-[10px] font-[420] text-[#554e7b] bg-white/80 px-2 py-0.5 rounded-full">
                                Your choice
                              </span>
                            )}
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-[480] text-[#5266eb] bg-white px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Correct Answer
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action Button Footer */}
        <div className="pt-4 text-center">
          <Button
            asChild
            variant="primary"
            className="rounded-[32px] px-8 h-10"
          >
            <Link to="/student/dashboard">
              Return to Student Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  )
}
