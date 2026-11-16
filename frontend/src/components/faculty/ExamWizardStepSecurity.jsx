import React, { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  GraduationCap,
  Building2,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  Info
} from 'lucide-react'
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

export default function ExamWizardStepSecurity({
  audience,
  setAudience,
  securityConfig,
  setSecurityConfig,
  publishConfig,
  setPublishConfig
}) {
  const [studentCount, setStudentCount] = useState(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [sebStatus, setSebStatus] = useState(null)
  const [loadingSeb, setLoadingSeb] = useState(false)

  const department = audience.department || DEPARTMENTS[0]
  const semester = audience.semester || 'Sem 6'

  // Fetch cohort size
  useEffect(() => {
    let isMounted = true
    const fetchCohortSize = async () => {
      setLoadingCount(true)
      try {
        const res = await api.get('/users/students/count', {
          params: { department, semester }
        })
        if (isMounted) setStudentCount(res.data?.count ?? 0)
      } catch {
        if (isMounted) setStudentCount(0)
      } finally {
        if (isMounted) setLoadingCount(false)
      }
    }
    fetchCohortSize()
    return () => { isMounted = false }
  }, [department, semester])

  // Fetch institution SEB status
  useEffect(() => {
    let isMounted = true
    const fetchSebStatus = async () => {
      setLoadingSeb(true)
      try {
        const res = await api.get('/exams/seb-status')
        if (isMounted) setSebStatus(res.data)
      } catch {
        if (isMounted) setSebStatus({ configured: false })
      } finally {
        if (isMounted) setLoadingSeb(false)
      }
    }
    fetchSebStatus()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-[480] text-foreground">Cohort, Invigilators & Security</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select target student cohort, configure invigilator surveillance credentials, and set proctoring safeguards.
        </p>
      </div>

      {/* Cohort Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Target Department" required>
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
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Target Semester" required>
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
                <SelectItem key={sem} value={sem}>{sem}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Live Cohort Count Preview */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-[420] text-foreground">
              Enrolling <strong className="font-[480]">{loadingCount ? '...' : studentCount}</strong> active students in {department} ({semester})
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
            {loadingCount ? '...' : `${studentCount} Enrolled`}
          </Badge>
        </CardContent>
      </Card>

      {/* Security & Safe Exam Browser (SEB) Settings */}
      <Card className="border border-border bg-card rounded-[14px]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-primary" />
                <span className="text-xs font-[480] text-foreground">Safe Exam Browser (SEB) Enforcement</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Locks down student PCs to prevent opening other applications or tabs during the exam.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(securityConfig.sebRequired)}
                onChange={e => setSecurityConfig(prev => ({ ...prev, sebRequired: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Institution SEB Status Indicator */}
          <div className="p-3 bg-muted/20 rounded-[12px] flex items-start space-x-2.5 text-xs">
            {loadingSeb ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0 mt-0.5" />
            ) : sebStatus?.configured ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-[480] text-foreground">
                {loadingSeb
                  ? 'Checking institution Safe Exam Browser setup...'
                  : sebStatus?.configured
                  ? `Institution SEB Profile Active (Key ending â€¢â€¢â€¢${sebStatus.keyLast4 || 'XXXX'})`
                  : 'Institution SEB Profile Not Uploaded'}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {sebStatus?.configured
                  ? 'Your institution has verified a master SEB configuration key. Students will be cryptographically gated through Safe Exam Browser.'
                  : 'Institution has not uploaded a master .seb configuration. If enabled, a per-exam 64-hex Config Key or environment key will be required at publish.'}
              </p>
            </div>
          </div>

          {/* Violation Limit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-[420] text-muted-foreground">Violation Warning Limit</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={securityConfig.violationLimit || 3}
                onChange={e => setSecurityConfig(prev => ({
                  ...prev,
                  violationLimit: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3))
                }))}
                className="text-xs h-8 font-mono"
              />
              <span className="text-[10px] text-muted-foreground">
                Attempts with violations exceeding this threshold are flagged for invigilator incident review.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-[420] text-muted-foreground">Invigilator Room / Hall</Label>
              <Input
                value={publishConfig.invigilatorRoom || 'Main Examination Hall'}
                onChange={e => setPublishConfig(prev => ({ ...prev, invigilatorRoom: e.target.value }))}
                className="text-xs h-8"
                placeholder="e.g. Lab 4 / Hall A"
              />
              <span className="text-[10px] text-muted-foreground">
                Assigned physical hall or digital lab proctoring room.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

