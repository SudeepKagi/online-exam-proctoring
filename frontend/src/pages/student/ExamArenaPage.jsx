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
import cameraStore from '@/lib/cameraStore'
import QuestionPalette from '@/components/exam/QuestionPalette'
import QuestionCard from '@/components/exam/QuestionCard'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, CloudOff, Lock, AlertCircle } from 'lucide-react'

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
  const [submitError, setSubmitError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [exitCountdown, setExitCountdown] = useState(5)
  const [isAutoExitCancelled, setIsAutoExitCancelled] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [serverOffsetMs, setServerOffsetMs] = useState(0)
  const [show5MinWarning, setShow5MinWarning] = useState(false)
  const [show1MinWarning, setShow1MinWarning] = useState(false)
  const [isTimeUpSubmitting, setIsTimeUpSubmitting] = useState(false)
  const [showSyncSuccess, setShowSyncSuccess] = useState(false)

  // Re-authentication state mid-exam
  const [reauthOpen, setReauthOpen] = useState(false)
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthEmail, setReauthEmail] = useState('')
  const [reauthError, setReauthError] = useState(null)
  const [reauthSubmitting, setReauthSubmitting] = useState(false)

  const teardownTimerRef = useRef(null)
  const stableIdempotencyKeyRef = useRef(null)

  const getStableIdempotencyKey = useCallback(() => {
    if (!stableIdempotencyKeyRef.current) {
      stableIdempotencyKeyRef.current = `idemp_${attempt?.id || id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
    return stableIdempotencyKeyRef.current
  }, [attempt?.id, id])

  const handleTerminationExit = useCallback((msg = 'Your examination was terminated because maximum violations (3/3) were exceeded.') => {
    cameraStore.releaseCamera('submit')
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate('/student/dashboard', { replace: true, state: { errorMsg: msg } })
  }, [navigate])

  const { isSuspended, setIsSuspended, isDuplicateTab, claimActiveSession } = useArenaSocketAndTab({
    examId: id, attemptId: attempt?.id, onTerminated: handleTerminationExit,
  })

  const { recordAnswer, flushDirtyAnswers, syncStatus, isOffline } = useAnswerAutosave({
    attemptId: attempt?.id,
    onSyncSuccess: () => {
      setShowSyncSuccess(true)
      setTimeout(() => setShowSyncSuccess(false), 4000)
    },
    onFlushError: (err) => {
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') handleTerminationExit()
      else if (err.response?.data?.code === 'ATTEMPT_SUSPENDED') setIsSuspended(true)
    }
  })

  const handleSubmitExam = useCallback(async (options = {}) => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    if (options.isAutoSubmit) {
      setIsTimeUpSubmitting(true)
    }

    const idempotencyKey = getStableIdempotencyKey()
    try {
      if (flushDirtyAnswers) await flushDirtyAnswers()
      if (attempt?.id) {
        await apiClient.post(
          `/attempts/${attempt.id}/submit`,
          { idempotencyKey },
          { headers: { 'Idempotency-Key': idempotencyKey } }
        )
      }
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      cameraStore.releaseCamera('submit')
      setIsSubmitted(true)
    } catch (err) {
      if (err.response?.data?.code === 'ATTEMPT_TERMINATED') return handleTerminationExit()
      setSubmitError(errorMessage(err, 'Submission failed. Please click retry.'))
    } finally {
      setSubmitting(false)
      setIsTimeUpSubmitting(false)
    }
  }, [submitting, flushDirtyAnswers, attempt?.id, getStableIdempotencyKey, handleTerminationExit])

  const { formatTime } = useExamTimer({
    expiresAt: attempt?.expiresAt,
    serverOffsetMs,
    durationMinutes: exam?.durationMinutes || 60,
    on5MinWarning: () => setShow5MinWarning(true),
    on1MinWarning: () => setShow1MinWarning(true),
    onExpire: () => handleSubmitExam({ isAutoSubmit: true }),
    enabled: !!attempt?.expiresAt,
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
    stream: attempt ? cameraStore.getStream() : null,
    attemptId: attempt?.id,
    examId: id,
    onViolation: handleViolationDetected,
  })

  // Listen for mid-exam token expiration
  useEffect(() => {
    const handleSessionExpired = () => {
      setReauthOpen(true)
    }
    window.addEventListener('pn:session-expired', handleSessionExpired)
    return () => window.removeEventListener('pn:session-expired', handleSessionExpired)
  }, [])

  const handleReauthSubmit = async (e) => {
    e.preventDefault()
    if (!reauthPassword || reauthSubmitting) return
    setReauthSubmitting(true)
    setReauthError(null)

    try {
      let storedEmail = reauthEmail
      if (!storedEmail) {
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}')
          storedEmail = u.email || ''
        } catch (_) {}
      }
      if (!storedEmail) {
        storedEmail = localStorage.getItem('proctornet_email') || attempt?.student?.email || attempt?.studentEmail || ''
      }

      await apiClient.post('/auth/student/login', {
        email: storedEmail,
        password: reauthPassword
      }).catch(() => {
        return apiClient.post('/auth/login', {
          email: storedEmail,
          password: reauthPassword
        })
      })

      setReauthOpen(false)
      setReauthPassword('')
      if (flushDirtyAnswers) {
        flushDirtyAnswers()
      }
    } catch (err) {
      setReauthError(errorMessage(err, 'Invalid credentials. Please re-enter your password.'))
    } finally {
      setReauthSubmitting(false)
    }
  }

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

        // Calculate clock offset from server Date header
        const serverDateHeader = examRes.headers?.date || startRes.headers?.date
        if (serverDateHeader) {
          const serverEpoch = new Date(serverDateHeader).getTime()
          if (!isNaN(serverEpoch)) {
            setServerOffsetMs(serverEpoch - Date.now())
          }
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
        cameraStore.releaseCamera('submit')
        navigate('/student/dashboard', { replace: true, state: { errorMsg: errorMessage(err, 'Exam is not currently available.') } })
      }
    }
    initArena()

    const handleBeforeUnload = () => {
      cameraStore.releaseCamera('submit')
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      mounted = false
      window.removeEventListener('beforeunload', handleBeforeUnload)
      teardownTimerRef.current = setTimeout(() => {
        cameraStore.releaseCamera('submit')
      }, 100)
    }
  }, [id, navigate, handleTerminationExit, setIsSuspended])

  const isArenaInteractionLocked = isSuspended || isDuplicateTab || isProctoringInterrupted || isTimeUpSubmitting || reauthOpen
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
        syncStatus={syncStatus}
        onSubmitClick={() => setSubmitDialogOpen(true)}
      />

      {/* Connection Lost Banner */}
      {isOffline && (
        <div
          data-testid="connection-lost-banner"
          className="bg-[#fff8e6] border-b border-[#f5e2b3] px-6 py-2.5 flex items-center justify-between text-xs text-[#73510d] font-[420] shrink-0"
        >
          <div className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-[#73510d] shrink-0" />
            <span>Connection lost. Your answers are saved locally on this computer and will sync automatically when reconnected.</span>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="retry-sync-button"
            onClick={() => flushDirtyAnswers()}
            className="bg-[#73510d] hover:bg-[#5a3f08] text-white text-[11px] font-[420] h-7 rounded-[32px] px-3 cursor-pointer shrink-0"
          >
            Retry sync
          </Button>
        </div>
      )}

      {/* Sync Success Banner */}
      {showSyncSuccess && (
        <div
          data-testid="sync-success-banner"
          className="bg-[#edecfb] border-b border-[#d8d5f7] px-6 py-2.5 flex items-center justify-between text-xs text-[#28253b] font-[420] shrink-0"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#5266eb] shrink-0" />
            <span>Connection restored. All local answers have synced with the server.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSyncSuccess(false)}
            className="text-xs text-[#554e7b] hover:text-[#28253b] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5-minute warning aria-live banner */}
      {show5MinWarning && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="timer-warning-5min"
          className="bg-[#edecfb] border-b border-[#d8d5f7] px-6 py-2 text-xs text-[#28253b] font-[420] flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#5266eb]" />
            <span>5 minutes remaining. Please review your answers.</span>
          </div>
          <button
            type="button"
            onClick={() => setShow5MinWarning(false)}
            className="text-xs text-[#554e7b] hover:text-[#28253b] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1-minute warning aria-live banner */}
      {show1MinWarning && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="timer-warning-1min"
          className="bg-[#fff8e6] border-b border-[#f5e2b3] px-6 py-2 text-xs text-[#73510d] font-[480] flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#73510d]" />
            <span>1 minute remaining. Your exam will submit automatically when time expires.</span>
          </div>
          <button
            type="button"
            onClick={() => setShow1MinWarning(false)}
            className="text-xs text-[#73510d] hover:text-[#28253b] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Examination Grid */}
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
            isDirty={syncStatus === 'SAVING'}
          />
        </div>
      </div>

      <SubmitExamDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        answeredCount={Object.keys(answers).length}
        totalCount={questions.length}
        onConfirm={() => handleSubmitExam()}
        submitting={submitting}
      />

      {/* Submission error alert dialog if submit failed */}
      {submitError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white rounded-xl p-4 shadow-lg border border-[#f5c6cb] font-sans">
          <div className="flex items-start gap-2 text-xs text-[#721c24] mb-3">
            <AlertCircle className="w-4 h-4 text-[#dc3545] shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="retry-submit-btn"
            onClick={() => handleSubmitExam()}
            className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-8 rounded-[32px] cursor-pointer"
          >
            Retry submission
          </Button>
        </div>
      )}

      {/* Time-up auto-submitting overlay */}
      {isTimeUpSubmitting && (
        <div
          data-testid="time-up-overlay"
          className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans"
        >
          <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 animate-pulse text-[#5266eb]" />
          </div>
          <h2 className="text-xl font-[480] text-[#28253b] mb-2">Time is up</h2>
          <p className="text-sm font-[360] text-[#554e7b] max-w-md leading-relaxed mb-4">
            Your examination duration has expired. Submitting your recorded answers to the server now... Please do not close your browser.
          </p>
          <div className="flex items-center gap-2 text-xs text-[#5266eb] font-[420]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5266eb] animate-ping" />
            <span>Finalizing submission on server...</span>
          </div>
        </div>
      )}

      {/* In-place re-authentication modal mid-exam */}
      {reauthOpen && (
        <div
          data-testid="reauth-modal"
          className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] font-sans"
        >
          <div className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-xl border border-[#e9eaf2] space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-[#5266eb]" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-[480] text-[#28253b]">Session Expired</h3>
              <p className="text-xs font-[360] text-[#554e7b] mt-1 leading-relaxed">
                Your login session has expired. Enter your password to refresh your session without losing your current progress. Your answers remain securely saved.
              </p>
            </div>

            {reauthError && (
              <div className="p-2.5 bg-[#fdf2f2] text-[#991b1b] rounded-xl text-xs font-[420] text-center">
                {reauthError}
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-[420] text-[#554e7b] mb-1">Account Password</label>
                <input
                  type="password"
                  data-testid="reauth-password-input"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  required
                  className="w-full h-10 px-3 rounded-xl border border-[#e9eaf2] text-xs font-sans text-[#28253b] focus:outline-none focus:border-[#5266eb]"
                />
              </div>

              <Button
                type="submit"
                disabled={reauthSubmitting}
                data-testid="reauth-submit-btn"
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"
              >
                {reauthSubmitting ? 'Authenticating...' : 'Sign in & resume exam'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {isSuspended && <SuspendedOverlay />}
      {isDuplicateTab && (
        <DuplicateTabOverlay
          onReturn={() => navigate('/student/dashboard')}
          onTakeOver={claimActiveSession}
        />
      )}
      <CameraDisconnectedOverlay />
    </ExamArenaShell>
  )
}
