import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { api, errorMessage } from '@/lib/apiClient'
import ExamWizardStepQuestions from './ExamWizardStepQuestions'
import ExamWizardStepSchedule from './ExamWizardStepSchedule'
import ExamWizardStepAudience from './ExamWizardStepAudience'
import ExamWizardStepPublish from './ExamWizardStepPublish'

const DEFAULT_SCHEDULE = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  // Format for datetime-local
  const tzOffset = d.getTimezoneOffset() * 60000
  const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16)
  return {
    title: '',
    subjectCode: '',
    description: '',
    startTime: localISOTime,
    durationMinutes: 60
  }
}

const generateRandomAlphaNum = (len = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function ExamWizardModal({ isOpen, onClose, onExamCreated }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [questions, setQuestions] = useState([])
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [audience, setAudience] = useState({
    department: 'Computer Science and Engineering',
    semester: 'Sem 6'
  })
  const [publishConfig, setPublishConfig] = useState({
    examCode: '',
    invigilatorId: '',
    invigilatorPassword: ''
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [stepError, setStepError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setStepError('')
      const codeSuffix = Math.floor(100 + Math.random() * 900)
      const cleanCode = (schedule.subjectCode || 'EC').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      setPublishConfig({
        examCode: `EXM-${cleanCode || 'EXM'}-${codeSuffix}`,
        invigilatorId: `INV-${cleanCode || 'INV'}-${codeSuffix}`,
        invigilatorPassword: `Pr0c${generateRandomAlphaNum(4)}`
      })
    }
  }, [isOpen])

  // Sync examCode and invigilatorId if subject code changes
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

  const validateCurrentStep = () => {
    setStepError('')
    if (currentStep === 1) {
      if (!questions.length) {
        setStepError('Please add at least 1 question (via PDF AI generation or manual entry).')
        return false
      }
    } else if (currentStep === 2) {
      if (!schedule.title.trim()) {
        setStepError('Subject Name is required.')
        return false
      }
      if (!schedule.subjectCode.trim()) {
        setStepError('Subject Code is required.')
        return false
      }
      if (!schedule.startTime) {
        setStepError('Start Date & Time is required.')
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
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
      const payload = {
        title: schedule.title,
        subjectCode: schedule.subjectCode,
        description: schedule.description,
        startTime: schedule.startTime,
        durationMinutes: parseInt(schedule.durationMinutes, 10) || 60,
        department: audience.department,
        semester: audience.semester,
        questions,
        examCode: publishConfig.examCode,
        invigilatorId: publishConfig.invigilatorId,
        invigilatorPassword: publishConfig.invigilatorPassword
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !isPublishing && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-xs">Step {currentStep} of 4</Badge>
              <DialogTitle className="text-lg font-[480]">4-Step AI Exam Creation Wizard</DialogTitle>
            </div>
            <div className="flex items-center space-x-1.5">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className={`w-7 h-1.5 rounded-full transition-colors ${
                    s === currentStep ? 'bg-primary' : s < currentStep ? 'bg-primary/50' : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Build questions with AI or manually, set schedule, auto-enroll cohort, and publish with invigilator credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {stepError && (
            <div className="mb-4 flex items-center space-x-2 text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stepError}</span>
            </div>
          )}

          {currentStep === 1 && (
            <ExamWizardStepQuestions questions={questions} setQuestions={setQuestions} />
          )}

          {currentStep === 2 && (
            <ExamWizardStepSchedule schedule={schedule} setSchedule={setSchedule} />
          )}

          {currentStep === 3 && (
            <ExamWizardStepAudience audience={audience} setAudience={setAudience} />
          )}

          {currentStep === 4 && (
            <ExamWizardStepPublish
              publishConfig={publishConfig}
              setPublishConfig={setPublishConfig}
              schedule={schedule}
              audience={audience}
              questions={questions}
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
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="bg-primary text-primary-foreground font-medium"
            >
              Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
