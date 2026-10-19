import React from 'react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, BookOpen, Hash, FileText } from 'lucide-react'

export default function ExamWizardStepSchedule({ schedule, setSchedule }) {
  const updateField = (field, val) => {
    setSchedule(prev => ({ ...prev, [field]: val }))
  }

  const duration = parseInt(schedule.durationMinutes, 10) || 60
  const calculatedEndTime = schedule.startTime
    ? new Date(new Date(schedule.startTime).getTime() + duration * 60000)
    : null

  const formattedEndTime = calculatedEndTime && !isNaN(calculatedEndTime.getTime())
    ? calculatedEndTime.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Select a valid start time'

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Subject Details & Schedule</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter subject specifications and session duration. End time is auto-calculated.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <FormField label="Start Date & Time" required>
          <div className="relative">
            <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              type="datetime-local"
              className="pl-9"
              value={schedule.startTime || ''}
              onChange={e => updateField('startTime', e.target.value)}
              required
            />
          </div>
        </FormField>

        <FormField label="Duration (in Minutes)" required>
          <div className="relative">
            <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              type="number"
              min="5"
              max="360"
              className="pl-9 font-mono"
              placeholder="60"
              value={schedule.durationMinutes || 60}
              onChange={e => updateField('durationMinutes', Math.max(5, parseInt(e.target.value, 10) || 60))}
              required
            />
          </div>
        </FormField>
      </div>

      {/* Auto-Calculated End Time Badge (Read-Only) */}
      <Card className="bg-primary/5 border border-primary/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Calculated End Time
              </span>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {formattedEndTime}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
            {duration} Mins Session
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
