import React, { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, GraduationCap, Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { api, errorMessage } from '@/lib/apiClient'

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Science and Engineering',
  'Electronics & Communication Engineering',
  'Artificial Intelligence & Data Science',
  'Mechanical Engineering',
  'Civil Engineering'
]

const SEMESTERS = [
  'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4',
  'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'
]

export default function ExamWizardStepAudience({ audience, setAudience }) {
  const [studentCount, setStudentCount] = useState(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const department = audience.department || DEPARTMENTS[0]
  const semester = audience.semester || 'Sem 6'

  useEffect(() => {
    let isMounted = true
    const fetchCohortSize = async () => {
      setLoadingCount(true)
      setFetchError('')
      try {
        const res = await api.get('/users/students/count', {
          params: { department, semester }
        })
        if (isMounted) {
          setStudentCount(res.data?.count ?? 0)
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(errorMessage(err, 'Unable to calculate student cohort.'))
          setStudentCount(0)
        }
      } finally {
        if (isMounted) setLoadingCount(false)
      }
    }

    fetchCohortSize()
    return () => { isMounted = false }
  }, [department, semester])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Target Semester & Department</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select the student cohort for this examination. Matching active students will be automatically enrolled.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Department" required>
          <Select
            value={department}
            onValueChange={val => setAudience(prev => ({ ...prev, department: val }))}
          >
            <SelectTrigger>
              <Building2 className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Semester" required>
          <Select
            value={semester}
            onValueChange={val => setAudience(prev => ({ ...prev, semester: val }))}
          >
            <SelectTrigger>
              <GraduationCap className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
              <SelectValue placeholder="Select Semester" />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map(sem => (
                <SelectItem key={sem} value={sem}>
                  {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Live Cohort Count Preview Card */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-foreground">Target Cohort</span>
                {loadingCount && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">
                  {loadingCount ? '...' : studentCount} Active Students
                </span>{' '}
                in <span className="font-medium text-foreground">{department}</span> •{' '}
                <span className="font-medium text-foreground">{semester}</span> will be automatically assigned to this exam.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary shrink-0 ml-3">
            {loadingCount ? 'Checking...' : `${studentCount} Enrolled`}
          </Badge>
        </CardContent>
      </Card>

      {fetchError && (
        <div className="flex items-center space-x-2 text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-md border border-amber-500/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-1">
        <div className="flex items-center space-x-1.5 text-foreground font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Instant Assignment Execution</span>
        </div>
        <p>
          Students in this department and semester will immediately see this exam appear on their dashboard when scheduled.
        </p>
      </div>
    </div>
  )
}
