import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  Copy,
  Download,
  Sparkles,
  ShieldCheck,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Share2,
  ExternalLink,
  KeyRound
} from 'lucide-react'
import { formatWithZone, computeEnd } from '@/lib/scheduleUtils'

export default function ExamWizardStepReview({
  schedule,
  audience,
  questions,
  securityConfig,
  publishConfig,
  onPublish,
  isPublishing,
  error
}) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedInstructions, setCopiedInstructions] = useState(false)
  const [copiedCredentials, setCopiedCredentials] = useState(false)

  const timezone = schedule.timezone || 'Asia/Kolkata'
  const duration = parseInt(schedule.durationMinutes, 10) || 60
  const lateEntry = parseInt(schedule.lateEntryMinutes, 10) || 15

  // Calculations for display
  let startFormatted = 'Not scheduled'
  let endFormatted = 'Not scheduled'
  let lateDeadlineFormatted = 'Not scheduled'
  if (schedule.startTime) {
    try {
      const { endUtcIso, lateEntryDeadlineUtcIso } = computeEnd(schedule.startTime, duration, lateEntry)
      startFormatted = formatWithZone(schedule.startTime, timezone)
      endFormatted = formatWithZone(endUtcIso, timezone)
      lateDeadlineFormatted = formatWithZone(lateEntryDeadlineUtcIso, timezone)
    } catch {
      startFormatted = schedule.startTime
    }
  }

  const examUrl = `${window.location.origin}/student/exams`

  const studentInstructions = `EXAMINATION NOTICE: ${schedule.title} (${schedule.subjectCode})
--------------------------------------------------------------
Date & Time        : ${startFormatted}
Late Entry Deadline: ${lateDeadlineFormatted}
Duration           : ${duration} Minutes
Total Questions    : ${questions.length} Multiple Choice Questions
Target Cohort      : ${audience.department} â€¢ ${audience.semester}
Proctoring Mode    : Web Camera & Live Face Verification Required${securityConfig.sebRequired ? '\nSecurity Browser   : Safe Exam Browser (SEB) Required on Windows' : ''}

INSTRUCTIONS:
1. Ensure you have a functioning webcam and stable internet.
2. Join the exam before the late entry deadline (${lateDeadlineFormatted}).
3. Login at: ${examUrl}
--------------------------------------------------------------`

  const copyStudentInstructions = () => {
    navigator.clipboard.writeText(studentInstructions)
    setCopiedInstructions(true)
    setTimeout(() => setCopiedInstructions(false), 2000)
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(examUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const copyCredentials = () => {
    const text = `PROCTORNET INVIGILATOR SURVEILLANCE CREDENTIALS
Exam: ${schedule.title} (${schedule.subjectCode})
Exam Code: ${publishConfig.examCode}
Invigilator ID: ${publishConfig.invigilatorId}
Password: ${publishConfig.invigilatorPassword}
Room: ${publishConfig.invigilatorRoom || 'Main Examination Hall'}
Console: ${window.location.origin}/login`
    navigator.clipboard.writeText(text)
    setCopiedCredentials(true)
    setTimeout(() => setCopiedCredentials(false), 2000)
  }

  const downloadSlip = (format = 'txt') => {
    let content = `=====================================================
PROCTORNET OFFICIAL EXAM CREDENTIAL SLIP
=====================================================
Subject Name         : ${schedule.title}
Subject Code         : ${schedule.subjectCode}
Exam Code            : ${publishConfig.examCode}
Target Cohort        : ${audience.department} - ${audience.semester}
Start Time           : ${startFormatted}
Duration             : ${duration} Minutes
Total Questions      : ${questions.length}

INVIGILATOR ACCESS:
Invigilator User ID  : ${publishConfig.invigilatorId}
Temporary Password   : ${publishConfig.invigilatorPassword}
Room                 : ${publishConfig.invigilatorRoom || 'Main Examination Hall'}
Console              : ${window.location.origin}/login
=====================================================`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Exam_Slip_${publishConfig.examCode || 'Slip'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Pre-publish checklist
  const hasUnreviewedQuestions = questions.some(q => q.needsReview)
  const checklist = [
    { label: `${questions.length} Question(s) ready`, passed: questions.length > 0 },
    { label: 'All question reviews acknowledged', passed: !hasUnreviewedQuestions },
    { label: 'Valid schedule window configured', passed: Boolean(schedule.startTime) },
    { label: 'Target cohort assigned', passed: Boolean(audience.department && audience.semester) }
  ]

  const canPublish = checklist.every(c => c.passed) && !isPublishing

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-[480] text-foreground">Review & Finalize Publication</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify the exam summary exactly as students will see it on their portal before publishing.
        </p>
      </div>

      {/* Student View Live Simulation Card */}
      <Card className="border border-border bg-[#fbfbff] rounded-[16px] overflow-hidden">
        <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-[500] uppercase tracking-wider text-muted-foreground">
              Student Portal Preview
            </span>
            <Badge variant="outline" className="font-mono text-[10px] py-0 px-2 text-primary border-primary/30">
              {schedule.subjectCode || 'EXM'}
            </Badge>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 text-[10px] border-0 font-[420]">
            Scheduled
          </Badge>
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h4 className="text-base font-[480] text-foreground">{schedule.title || 'Untitled Assessment'}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {schedule.description || 'Standard internal assessment'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-1">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{startFormatted}</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{duration} Minutes Session</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{audience.department} ({audience.semester})</span>
            </div>
          </div>

          {/* Security Features Required for Students */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary">
              <ShieldCheck className="w-2.5 h-2.5 mr-1" /> Web Camera Proctored
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary">
              Full-screen Lock
            </Badge>
            {securityConfig.sebRequired && (
              <Badge variant="outline" className="text-[10px] py-0 px-2 border-indigo-400 text-indigo-700">
                Safe Exam Browser (SEB)
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-muted-foreground/30 text-muted-foreground">
              Late Entry: {lateEntry} Min Window
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Invigilator Surveillance Credentials Card */}
      <Card className="border border-border bg-[#edecfb] rounded-[14px]">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-[480] text-foreground">
              <KeyRound className="w-4 h-4 text-primary" />
              <span>Invigilator Live Surveillance Access</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyCredentials}
                className="h-6 text-[10px] px-2.5 rounded-[40px] bg-white text-foreground border-border hover:bg-muted/20"
              >
                {copiedCredentials ? <Check className="w-3 h-3 mr-1 text-primary" /> : <Copy className="w-3 h-3 mr-1" />}
                {copiedCredentials ? 'Copied' : 'Copy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadSlip('txt')}
                className="h-6 text-[10px] px-2.5 rounded-[40px] bg-white text-foreground border-border hover:bg-muted/20"
              >
                <Download className="w-3 h-3 mr-1" /> Slip (.txt)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white p-2 rounded-[10px]">
              <span className="text-[10px] text-muted-foreground uppercase">Exam Code</span>
              <p className="font-mono font-medium text-foreground">{publishConfig.examCode}</p>
            </div>
            <div className="bg-white p-2 rounded-[10px]">
              <span className="text-[10px] text-muted-foreground uppercase">Invigilator ID</span>
              <p className="font-mono font-medium text-primary">{publishConfig.invigilatorId}</p>
            </div>
            <div className="bg-white p-2 rounded-[10px]">
              <span className="text-[10px] text-muted-foreground uppercase">Password</span>
              <p className="font-mono font-medium text-primary">{publishConfig.invigilatorPassword}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shareable Link & Student Instructions */}
      <div className="p-3.5 bg-muted/20 rounded-[14px] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-[480] text-foreground flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-primary" />
            Share With Students
          </span>
          <div className="flex items-center space-x-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyShareLink}
              className="h-6 text-[10px] px-2.5 rounded-[40px] bg-white text-foreground border-border"
            >
              {copiedLink ? <Check className="w-3 h-3 mr-1 text-primary" /> : <ExternalLink className="w-3 h-3 mr-1" />}
              {copiedLink ? 'Link Copied' : 'Copy Portal Link'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyStudentInstructions}
              className="h-6 text-[10px] px-2.5 rounded-[40px] bg-white text-foreground border-border"
            >
              {copiedInstructions ? <Check className="w-3 h-3 mr-1 text-primary" /> : <Copy className="w-3 h-3 mr-1" />}
              {copiedInstructions ? 'Copied' : 'Copy Full Instructions'}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Students can navigate directly to the examination portal at: <span className="font-mono text-foreground select-all">{examUrl}</span>
        </p>
      </div>

      {/* Pre-publish Checklist */}
      <div className="p-3 bg-muted/10 rounded-[14px] space-y-1.5">
        <span className="text-[11px] font-[500] uppercase tracking-wider text-muted-foreground">
          Pre-Publish Verification
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              {item.passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className={item.passed ? 'text-foreground' : 'text-amber-800 font-medium'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-[12px] font-[420] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Publish Exam Primary Action */}
      <div className="pt-2 flex justify-end">
        <Button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          className="bg-primary text-primary-foreground font-[480] text-sm rounded-[32px] px-6 h-10 shadow-sm"
        >
          {isPublishing ? (
            'Publishing Exam & Enrolling Students...'
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Publish Exam Now
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

