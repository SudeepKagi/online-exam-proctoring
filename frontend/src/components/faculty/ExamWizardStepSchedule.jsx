import React, { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, BookOpen, Hash, FileText, Globe, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  getClientTimezone,
  formatTimezoneLabel,
  datetimeLocalToUtcIso,
  utcIsoToDatetimeLocal,
  computeEnd,
  formatWithZone,
  validateWindow
} from '@/lib/scheduleUtils'

export default function ExamWizardStepSchedule({ schedule, setSchedule, existingExams = [], audience }) {
  const timezone = schedule.timezone || getClientTimezone()

  const updateField = (field, val) => {
    setSchedule(prev => ({ ...prev, [field]: val }))
  }

  const duration = parseInt(schedule.durationMinutes, 10) || 60
  const lateEntry = schedule.lateEntryMinutes !== undefined ? parseInt(schedule.lateEntryMinutes, 10) : 15

  // Compute UTC start, end, late entry window, and window validation
  const scheduleCalculations = useMemo(() => {
    if (!schedule.startTime) {
      return {
        startUtcIso: null,
        endUtcIso: null,
        lateDeadlineUtcIso: null,
        previewText: 'Select a start time to see student join window',
        validation: { valid: false, message: 'Start date & time is required' }
      }
    }

    try {
      const startUtcIso = datetimeLocalToUtcIso(schedule.startTime, timezone)
      const { endUtcIso, lateEntryDeadlineUtcIso } = computeEnd(startUtcIso, duration, lateEntry)
      const validation = validateWindow(startUtcIso, duration, lateEntry, Date.now())

      const startFormatted = formatWithZone(startUtcIso, timezone)
      const lateFormatted = formatWithZone(lateEntryDeadlineUtcIso, timezone)
      const endFormatted = formatWithZone(endUtcIso, timezone)

      const previewText = `Students can start any time between ${startFormatted} and ${lateFormatted} and get ${duration} minutes.`

      return {
        startUtcIso,
        endUtcIso,
        lateDeadlineUtcIso: lateEntryDeadlineUtcIso,
        startFormatted,
        lateFormatted,
        endFormatted,
        previewText,
        validation
      }
    } catch {
      return {
        startUtcIso: null,
        endUtcIso: null,
        lateDeadlineUtcIso: null,
        previewText: 'Invalid start time selected',
        validation: { valid: false, message: 'Invalid start time format' }
      }
    }
  }, [schedule.startTime, duration, lateEntry, timezone])

  // Presets handlers
  const applyPreset = (type) => {
    const now = new Date()
    let targetDate = new Date()

    if (type === '10min') {
      targetDate = new Date(now.getTime() + 10 * 60 * 1000)
    } else if (type === '1hour') {
      targetDate = new Date(now.getTime() + 60 * 60 * 1000)
    } else if (type === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1)
      targetDate.setHours(10, 0, 0, 0)
    }

    const utcIso = targetDate.toISOString()
    const dtLocal = utcIsoToDatetimeLocal(utcIso, timezone)
    setSchedule(prev => ({
      ...prev,
      startTime: dtLocal,
      timezone
    }))
  }

  // Check for cohort overlap warning
  const overlapWarning = useMemo(() => {
    if (!scheduleCalculations.startUtcIso || !scheduleCalculations.endUtcIso || !audience?.department) {
      return null
    }
    const startMs = new Date(scheduleCalculations.startUtcIso).getTime()
    const endMs = new Date(scheduleCalculations.endUtcIso).getTime()

    const overlapping = (existingExams || []).find(ex => {
      if (ex.status !== 'PUBLISHED') return false
      const exDept = ex.proctoringConfig?.department || ex.department
      const exSem = ex.proctoringConfig?.semester || ex.semester
      if (exDept && audience.department && !exDept.toLowerCase().includes(audience.department.toLowerCase())) {
        return false
      }
      if (exSem && audience.semester && exSem !== audience.semester) {
        return false
      }
      const exStart = new Date(ex.startTime).getTime()
      const exEnd = new Date(ex.endTime).getTime()
      return (startMs < exEnd && endMs > exStart)
    })

    if (overlapping) {
      return `Warning: Overlaps with scheduled exam "${overlapping.title}" (${overlapping.courseCode}) for this cohort.`
    }
    return null
  }, [scheduleCalculations, existingExams, audience])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-[480] text-foreground">Subject Details & Schedule</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter subject specifications, start time, and session duration with timezone precision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Subject Name" required>
          <div className="relative">
            <BookOpen className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              className="pl-9"
              placeholder="e.g. Digital Signal Processing"
              value={schedule.title || ''}
              onChange={e => updateField('title', e.target.value)}
              required
            />
          </div>
        </FormField>

        <FormField label="Subject Code" required>
          <div className="relative">
            <Hash className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              className="pl-9 font-mono uppercase"
              placeholder="e.g. 22EC71"
              value={schedule.subjectCode || ''}
              onChange={e => updateField('subjectCode', e.target.value.toUpperCase())}
              required
            />
          </div>
        </FormField>
      </div>

      <FormField label="Description / Instructions">
        <div className="relative">
          <FileText className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <textarea
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
            rows={3}
            placeholder="e.g. Module 1 & 2 Internal Assessment. Calculators not permitted."
            value={schedule.description || ''}
            onChange={e => updateField('description', e.target.value)}
          />
        </div>
      </FormField>

      {/* Schedule Configuration */}
      <div className="p-4 bg-muted/20 rounded-[16px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-muted-foreground font-[420]">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>Timezone:</span>
            <Badge variant="outline" className="font-mono text-[11px] py-0 px-2 border-primary/30 text-primary">
              {formatTimezoneLabel(timezone)}
            </Badge>
          </div>

          {/* Quick Schedule Presets */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-muted-foreground">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset('10min')}
              className="h-6 text-[11px] px-2.5 rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-foreground border-transparent"
            >
              In 10 min
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset('1hour')}
              className="h-6 text-[11px] px-2.5 rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-foreground border-transparent"
            >
              In 1 hour
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset('tomorrow')}
              className="h-6 text-[11px] px-2.5 rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-foreground border-transparent"
            >
              Tomorrow 10 AM
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Start Date & Time" required>
            <div className="relative">
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                type="datetime-local"
                className="pl-9 text-xs"
                value={schedule.startTime || ''}
                onChange={e => updateField('startTime', e.target.value)}
                required
              />
            </div>
          </FormField>

          <FormField label="Duration (Minutes)" required>
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                type="number"
                min="5"
                max="480"
                className="pl-9 font-mono text-xs"
                value={schedule.durationMinutes || 60}
                onChange={e => updateField('durationMinutes', Math.max(5, parseInt(e.target.value, 10) || 60))}
                required
              />
            </div>
          </FormField>

          <FormField label="Late-Entry Window (Min)">
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                type="number"
                min="0"
                max="60"
                className="pl-9 font-mono text-xs"
                placeholder="15"
                value={schedule.lateEntryMinutes !== undefined ? schedule.lateEntryMinutes : 15}
                onChange={e => updateField('lateEntryMinutes', Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)))}
              />
            </div>
          </FormField>
        </div>

        {/* Validation Warning / Error */}
        {schedule.startTime && !scheduleCalculations.validation.valid && (
          <div className="flex items-center space-x-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-[12px] font-[420]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{scheduleCalculations.validation.message}</span>
          </div>
        )}

        {/* Overlap Warning */}
        {overlapWarning && (
          <div className="flex items-center space-x-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-[12px] font-[420]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{overlapWarning}</span>
          </div>
        )}

        {/* Student View Live Preview Line */}
        <Card className="bg-primary/5 border-0 rounded-[14px]">
          <CardContent className="p-3.5 flex items-start space-x-3">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[11px] font-[480] uppercase tracking-wider text-muted-foreground">
                Student Window Preview
              </span>
              <p className="text-xs font-[420] text-foreground leading-relaxed">
                {scheduleCalculations.previewText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
