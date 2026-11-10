import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import { api, errorMessage } from '@/lib/apiClient'
import {
  getClientTimezone,
  utcIsoToDatetimeLocal,
  datetimeLocalToUtcIso,
  validateWindow
} from '@/lib/scheduleUtils'

import ExamWizardStepUpload from './ExamWizardStepUpload'
import ExamWizardStepAIReview from './ExamWizardStepAIReview'
import ExamWizardStepSchedule from './ExamWizardStepSchedule'
import ExamWizardStepSecurity from './ExamWizardStepSecurity'
import ExamWizardStepReview from './ExamWizardStepReview'

const DEFAULT_SCHEDULE = () => {
  const tz = getClientTimezone()
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30) // default 30 min ahead
  const dtLocal = utcIsoToDatetimeLocal(d.toISOString(), tz)

  return {
    title: '',
    subjectCode: '',
    description: '',
    startTime: dtLocal,
    durationMinutes: 60,
    lateEntryMinutes: 15,
    timezone: tz
  }
}

const generateRandomAlphaNum = (len = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function ExamWizardModal({ isOpen, onClose, onExamCreated, existingExams = [] }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [questions, setQuestions] = useState([])
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [audience, setAudience] = useState({
    department: 'Computer Science and Engineering',
    semester: 'Sem 6'
  })
  const [securityConfig, setSecurityConfig] = useState({
    sebRequired: false,
    violationLimit: 3
  })
  const [publishConfig, setPublishConfig] = useState({
    examCode: '',
    invigilatorId: '',
    invigilatorPassword: '',
    invigilatorRoom: 'Main Examination Hall'
  })

  const [draftStatus, setDraftStatus] = useState({ hasDraft: false, updatedAt: null })
  const [isPublishing, setIsPublishing] = useState(false)
  const [stepError, setStepError] = useState('')
  const autosaveTimerRef = useRef(null)

  // Initialize or resume on modal open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setStepError('')

      const cleanCode = (schedule.subjectCode || 'EC').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const codeSuffix = Math.floor(100 + Math.random() * 900)
      setPublishConfig(prev => ({
        ...prev,
        examCode: `EXM-${cleanCode || 'EXM'}-${codeSuffix}`,
        invigilatorId: `INV-${cleanCode || 'INV'}-${codeSuffix}`,
        invigilatorPassword: `Pr0c${generateRandomAlphaNum(4)}`
      }))

      // Check for saved draft on backend
      api.get('/exams/draft')
        .then(res => {
          if (res.data?.draft?.payload) {
            setDraftStatus({
              hasDraft: true,
              updatedAt: res.data.draft.updatedAt,
              payload: res.data.draft.payload
            })
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Sync codes when subjectCode changes
  useEffect(() => {
    if (schedule.subjectCode) {
      const clean = schedule.subjectCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      setPublishConfig(prev => {
        const rand = (prev.examCode || '').split('-')[2] || '101'
        return {
          ...prev,
          examCode: `EXM-${clean}-${rand}`,
          invigilatorId: `INV-${clean}-${rand}`
        }
      })
    }
  }, [schedule.subjectCode])

  // Debounced draft autosave
  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      const draftPayload = {
        questions,
        schedule,
        audience,
        securityConfig,
        currentStep
      }
      api.post('/exams/draft', draftPayload).catch(() => {})
    }, 2000)
  }, [questions, schedule, audience, securityConfig, currentStep])

  useEffect(() => {
    if (isOpen && currentStep > 1) {
      triggerAutosave()
    }
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [questions, schedule, audience, securityConfig, currentStep, isOpen, triggerAutosave])

  const handleResumeDraft = () => {
    if (!draftStatus.payload) return
    const p = draftStatus.payload
    if (p.questions) setQuestions(p.questions)
    if (p.schedule) setSchedule(p.schedule)
    if (p.audience) setAudience(p.audience)
    if (p.securityConfig) setSecurityConfig(p.securityConfig)
    if (p.currentStep && p.currentStep > 1) setCurrentStep(p.currentStep)
    setDraftStatus({ hasDraft: false, updatedAt: null })
  }

  // Handle PDF extraction success
  const handlePdfExtracted = (result) => {
    if (result.metadata) {
      setSchedule(prev => ({
        ...prev,
        title: result.metadata.title || prev.title,
        subjectCode: result.metadata.courseCode || prev.subjectCode,
        description: result.metadata.description || prev.description,
        durationMinutes: result.metadata.suggestedDuration || prev.durationMinutes
      }))
    }
    if (result.questions && result.questions.length) {
      setQuestions(result.questions)
    }
    setCurrentStep(2) // Move to AI review & question bank
  }

  const validateCurrentStep = () => {
    setStepError('')

    if (currentStep === 1) {
      return true
    } else if (currentStep === 2) {
      if (!questions.length) {
        setStepError('Please add at least 1 question to continue.')
        return false
      }
      const hasUnreviewed = questions.some(q => q.needsReview)
      if (hasUnreviewed) {
        setStepError('Please acknowledge or verify all questions flagged "Needs Review" before continuing.')
        return false
      }
    } else if (currentStep === 3) {
      if (!schedule.title?.trim()) {
        setStepError('Subject Name is required.')
        return false
      }
      if (!schedule.subjectCode?.trim()) {
        setStepError('Subject Code is required.')
        return false
      }
      if (!schedule.startTime) {
        setStepError('Start Date & Time is required.')
        return false
      }

      try {
        const startUtcIso = datetimeLocalToUtcIso(schedule.startTime, schedule.timezone || getClientTimezone())
        const val = validateWindow(
          startUtcIso,
          parseInt(schedule.durationMinutes, 10) || 60,
          parseInt(schedule.lateEntryMinutes, 10) || 15,
          Date.now()
        )
        if (!val.valid) {
          setStepError(val.message || 'Invalid scheduling window.')
          return false
        }
      } catch (err) {
        setStepError(err.message || 'Invalid start date format.')
        return false
      }
    } else if (currentStep === 4) {
      if (!audience.department || !audience.semester) {
        setStepError('Please select both department and semester.')
        return false
      }
    }

    return true
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    }
  }

  const handleBack = () => {
    setStepError('')
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handlePublish = async () => {
    if (!validateCurrentStep()) return
    setIsPublishing(true)
    setStepError('')

    try {
      const userTz = schedule.timezone || getClientTimezone()
      const startUtcIso = datetimeLocalToUtcIso(schedule.startTime, userTz)

      const payload = {
        title: schedule.title.trim(),
        subjectCode: schedule.subjectCode.trim(),
        description: schedule.description || '',
        startTime: startUtcIso,
        startTimeUtc: startUtcIso,
        timezone: userTz,
        durationMinutes: parseInt(schedule.durationMinutes, 10) || 60,
        lateEntryMinutes: parseInt(schedule.lateEntryMinutes, 10) || 15,
        department: audience.department,
        semester: audience.semester,
        questions,
        sebRequired: Boolean(securityConfig.sebRequired),
        examCode: publishConfig.examCode,
        invigilatorId: publishConfig.invigilatorId,
        invigilatorPassword: publishConfig.invigilatorPassword,
        invigilatorCredentials: {
          institutionId: publishConfig.invigilatorId,
          loginId: publishConfig.invigilatorId,
          password: publishConfig.invigilatorPassword,
          room: publishConfig.invigilatorRoom || 'Main Examination Hall'
        }
      }

      const res = await api.post('/exams/publish-wizard', payload)
      onExamCreated?.(res.data?.exam, publishConfig)
      onClose()
    } catch (err) {
      setStepError(errorMessage(err, 'Failed to publish exam.'))
    } finally {
      setIsPublishing(false)
    }
  }

  const stepTitles = [
    'Document Upload',
    'Question Review',
    'Schedule & Timezone',
    'Cohort & Security',
    'Finalize & Publish'
  ]

  return (
    <Dialog open={isOpen} onOpenChange={open => !isPublishing && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 font-sans">
        <DialogHeader className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-xs">
                Step {currentStep} of 5
              </Badge>
              <DialogTitle className="text-lg font-[480]">
                {stepTitles[currentStep - 1]}
              </DialogTitle>
            </div>
            <div className="flex items-center space-x-1.5">
              {[1, 2, 3, 4, 5].map(s => (
                <div
                  key={s}
                  className={`w-6 h-1.5 rounded-full transition-colors ${
                    s === currentStep
                      ? 'bg-primary'
                      : s < currentStep
                      ? 'bg-primary/50'
                      : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Build questions with AI or manual input, configure timezone-aware schedule, assign cohort, and publish securely.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {stepError && (
            <div className="mb-4 flex items-center space-x-2 text-xs text-destructive bg-destructive/10 p-3 rounded-[12px] font-[420]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stepError}</span>
            </div>
          )}

          {currentStep === 1 && (
            <ExamWizardStepUpload
              onPdfExtracted={handlePdfExtracted}
              onSkipToManual={() => setCurrentStep(2)}
              draftStatus={draftStatus}
              onDraftResume={handleResumeDraft}
            />
          )}

          {currentStep === 2 && (
            <ExamWizardStepAIReview
              questions={questions}
              setQuestions={setQuestions}
              metadata={schedule}
              setMetadata={setSchedule}
            />
          )}

          {currentStep === 3 && (
            <ExamWizardStepSchedule
              schedule={schedule}
              setSchedule={setSchedule}
              existingExams={existingExams}
              audience={audience}
            />
          )}

          {currentStep === 4 && (
            <ExamWizardStepSecurity
              audience={audience}
              setAudience={setAudience}
              securityConfig={securityConfig}
              setSecurityConfig={setSecurityConfig}
              publishConfig={publishConfig}
              setPublishConfig={setPublishConfig}
            />
          )}

          {currentStep === 5 && (
            <ExamWizardStepReview
              schedule={schedule}
              audience={audience}
              questions={questions}
              securityConfig={securityConfig}
              publishConfig={publishConfig}
              onPublish={handlePublish}
              isPublishing={isPublishing}
              error={stepError}
            />
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 1 || isPublishing}
            className="rounded-[40px] px-4 text-xs font-[420]"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>

          {currentStep < 5 && (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="bg-primary text-primary-foreground font-medium rounded-[40px] px-5 text-xs h-9"
            >
              Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
