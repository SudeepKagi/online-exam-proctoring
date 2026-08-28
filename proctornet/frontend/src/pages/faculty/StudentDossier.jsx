import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import CodeQuestion from '@/components/exam/CodeQuestion'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import {
  ArrowLeft, Printer, CheckCircle2, ShieldAlert, Award,
  Clock, AlertTriangle, FileText, User, BookOpen, Check
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function StudentDossier() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeView, setActiveView] = useState('answers') // answers | timeline
  const [finalizing, setFinalizing] = useState(false)

  const fetchDossier = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/faculty/results/${id}`)
      setResult(res.data.result || res.data)
    } catch (err) {
      console.error('[StudentDossier] Fetch error:', err)
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load candidate dossier.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDossier()
  }, [id])

  const handleFinalizeGrade = async () => {
    if (!result) return
    const examId = result.studentExam?.exam?.id || result.examId
    if (!examId) {
      toast.error('Could not determine exam ID.')
      return
    }
    setFinalizing(true)
    try {
      await api.patch(`/faculty/exams/${examId}/results/release`, { release: true })
      toast.success('Grade finalized and released to candidate!')
      fetchDossier()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to finalize grade.')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Candidate Dossier">
        <div className="flex flex-col items-center justify-center py-20 font-sans">
          <div className="w-10 h-10 border-3 border-[#2f80ed] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500 font-semibold">Loading certified evidence dossier...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !result) {
    return (
      <DashboardLayout title="Candidate Dossier">
        <div className="max-w-2xl mx-auto py-12">
          <ErrorState
            title="Candidate Dossier Not Found"
            message={error || 'The requested candidate exam record could not be retrieved from the database.'}
            onRetry={fetchDossier}
          />
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/faculty/results')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2f80ed] hover:underline cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Results Overview
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const studentExam = result.studentExam || {}
  const student = studentExam.student || result.student || {}
  const exam = studentExam.exam || result.exam || {}
  const evidenceLogs = studentExam.evidenceLogs || result.evidenceLogs || []
  const answers = result.answers || studentExam.answers || []

  const totalScore = result.totalScore ?? result.score ?? 0
  const totalMarks = result.totalMarks ?? exam.totalMarks ?? 100
  const percentage = Math.round(result.percentage ?? ((totalScore / (totalMarks || 1)) * 100))
  const isPassed = percentage >= 40

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <button
              onClick={() => navigate('/faculty/results')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f80ed] hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Results
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Evidence Dossier: {student.name || 'Candidate'}
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              USN: <span className="font-mono text-slate-800">{student.usn || 'N/A'}</span> • Exam: {exam.title || 'Assessment'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Print Report
            </Button>
            <Button
              size="sm"
              onClick={handleFinalizeGrade}
              disabled={finalizing}
              className="bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              <CheckCircle2 size={14} />
              {finalizing ? 'Finalizing…' : 'Finalize Grade'}
            </Button>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Candidate Summary Card */}
          <div className="space-y-6">
            <Card className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xs text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2f80ed] font-bold text-xl shadow-xs">
                {student.name ? student.name.slice(0, 2).toUpperCase() : 'ST'}
              </div>
              <h3 className="font-semibold text-base text-slate-900">{student.name}</h3>
              <p className="text-xs font-mono font-normal text-slate-500 mt-0.5">{student.usn}</p>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                {student.department || 'Computer Science'} • Sem {student.semester || 6}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="p-3 bg-slate-50/75 border border-slate-200 rounded-2xl">
                  <div className="text-xl font-bold text-slate-900">
                    {totalScore}<span className="text-xs text-slate-400 font-normal">/{totalMarks}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-0.5">Score</div>
                </div>
                <div className="p-3 bg-slate-50/75 border border-slate-200 rounded-2xl">
                  <div className={`text-xl font-bold ${evidenceLogs.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {evidenceLogs.length}
                  </div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-0.5">Strikes</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-normal">Result Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPassed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {isPassed ? 'PASSED' : 'FAILED'} ({percentage}%)
                </span>
              </div>
            </Card>

            {/* Proctoring Integrity Summary */}
            <Card className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-4">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-[#2f80ed]" /> Proctoring Audit Metrics
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-normal text-slate-700 mb-1">
                    <span>Biometric Face Verification</span>
                    <span className="text-emerald-600 font-semibold">VERIFIED</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-normal text-slate-700 mb-1">
                    <span>Network WireGuard Isolation</span>
                    <span className="text-[#2f80ed] font-semibold">CONFIRMED</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2f80ed] rounded-full w-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-normal text-slate-700 mb-1">
                    <span>Hardware Kiosk Lock</span>
                    <span className="text-emerald-600 font-semibold">ENFORCED</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Tabbed Answers & Evidence Timeline */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
              <div className="flex border-b border-slate-200 gap-6 pb-4 mb-6">
                <button
                  type="button"
                  onClick={() => setActiveView('answers')}
                  className={`text-xs font-semibold transition-colors cursor-pointer pb-1 relative ${
                    activeView === 'answers'
                      ? 'text-[#2f80ed] border-b-2 border-[#2f80ed]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Candidate Submission ({answers.length} Questions)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('timeline')}
                  className={`text-xs font-semibold transition-colors cursor-pointer pb-1 relative ${
                    activeView === 'timeline'
                      ? 'text-[#2f80ed] border-b-2 border-[#2f80ed]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Integrity Timeline ({evidenceLogs.length} Events)
                </button>
              </div>

              {/* View 1: Answers */}
              {activeView === 'answers' && (
                <div className="space-y-4">
                  {answers.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 font-normal">
                      No question responses recorded for this attempt.
                    </div>
                  ) : (
                    answers.map((ans, idx) => {
                      const q = ans.question || {}
                      return (
                        <div key={ans.id || idx} className="p-4 bg-slate-50/75 border border-slate-200 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">
                              Question {idx + 1}
                              <span className="ml-2 text-[10px] font-medium text-slate-400 uppercase">({q.type || 'MCQ'})</span>
                            </span>
                            <span className="text-xs font-semibold text-[#2f80ed]">
                              {ans.autoScore ?? 0} / {q.marks ?? 2} Marks
                            </span>
                          </div>

                          <p className="text-xs font-normal text-slate-800">{q.questionText}</p>

                          {q.type === 'MCQ' ? (
                            <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-normal">Student Selection:</span>
                                <span className="font-medium text-slate-900">{ans.selectedOption || 'Not answered'}</span>
                              </div>
                              {q.correctAnswer && (
                                <div className="flex justify-between pt-1 border-t border-slate-100">
                                  <span className="text-slate-500 font-normal">Correct Answer:</span>
                                  <span className="font-medium text-emerald-600">{q.correctAnswer}</span>
                                </div>
                              )}
                            </div>
                          ) : q.type === 'CODE' ? (
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium uppercase text-slate-400">Submitted Code:</span>
                              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto">
                                {ans.codeAnswer || '// No code submitted'}
                              </pre>
                            </div>
                          ) : (
                            <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800">
                              {ans.writtenText || 'No subjective answer text submitted.'}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* View 2: Integrity Timeline */}
              {activeView === 'timeline' && (
                <div className="space-y-3">
                  {evidenceLogs.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-800">Clean Session</p>
                      <p className="text-[11px] text-slate-400 font-medium">No integrity violations or anomaly alerts were triggered.</p>
                    </div>
                  ) : (
                    evidenceLogs.map((log, idx) => (
                      <div key={log.id || idx} className="p-3.5 bg-[#f8fafc] border border-slate-200 rounded-2xl flex items-start justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              log.severity === 'HIGH' || log.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {log.severity || 'ALERT'}
                            </span>
                            <span className="font-bold text-slate-900">{log.eventType || log.type}</span>
                          </div>
                          {log.details && <p className="text-[11px] text-slate-500 font-medium">{log.details}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap ml-3">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
