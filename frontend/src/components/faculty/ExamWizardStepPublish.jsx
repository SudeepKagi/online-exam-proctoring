import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Download, KeyRound, ShieldCheck, Check, Sparkles, RefreshCw, Send } from 'lucide-react'

export default function ExamWizardStepPublish({
  publishConfig,
  setPublishConfig,
  schedule,
  audience,
  questions,
  onPublish,
  isPublishing,
  error
}) {
  const [copied, setCopied] = useState(false)

  const copyCredentials = () => {
    const text = `PROCTORNET EXAM CREDENTIAL SLIP
---------------------------------------
Subject: ${schedule.title} (${schedule.subjectCode})
Exam Code: ${publishConfig.examCode}
Invigilator Login ID: ${publishConfig.invigilatorId}
Invigilator Password: ${publishConfig.invigilatorPassword}
Scheduled Start: ${schedule.startTime}
Duration: ${schedule.durationMinutes} Minutes
Department: ${audience.department} | ${audience.semester}
---------------------------------------
Login URL: ${window.location.origin}/login`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadSlip = (format = 'txt') => {
    let content
    let filename = `Exam_Credentials_${publishConfig.examCode || 'Slip'}.${format}`
    let mimeType = 'text/plain'

    if (format === 'csv') {
      mimeType = 'text/csv'
      content = `Subject,SubjectCode,ExamCode,InvigilatorID,InvigilatorPassword,StartTime,DurationMins,Department,Semester\n`
      content += `"${schedule.title}","${schedule.subjectCode}","${publishConfig.examCode}","${publishConfig.invigilatorId}","${publishConfig.invigilatorPassword}","${schedule.startTime}",${schedule.durationMinutes},"${audience.department}","${audience.semester}"\n`
    } else {
      content = `=====================================================
PROCTORNET OFFICIAL EXAM CREDENTIAL SLIP
=====================================================
Subject Name         : ${schedule.title}
Subject Code         : ${schedule.subjectCode}
Exam Code            : ${publishConfig.examCode}
Target Cohort        : ${audience.department} - ${audience.semester}
Start Time           : ${schedule.startTime}
Duration             : ${schedule.durationMinutes} Minutes
Total Questions      : ${questions.length}

INVIGILATOR ACCESS:
Invigilator User ID  : ${publishConfig.invigilatorId}
Temporary Password   : ${publishConfig.invigilatorPassword}
Proctoring Console   : ${window.location.origin}/login
=====================================================`
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-[480] text-foreground">Auto-Generated Invigilator Credentials</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dedicated invigilator credentials have been generated for live session surveillance.
        </p>
      </div>

      {/* Mercury Light Invigilator Credentials Card */}
      <Card className="border border-[#e9eaf2] bg-[#edecfb] text-[#28253b] shadow-xs rounded-[12px] overflow-hidden font-sans">
        <div className="bg-[#fbfbff] px-4 py-2.5 border-b border-[#e9eaf2] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-[#5266eb] animate-pulse" />
            <span className="text-xs font-[500] uppercase tracking-wider text-[#28253b]">
              Invigilator Surveillance Access
            </span>
          </div>
          <Badge className="bg-[#5266eb] text-white font-mono text-[11px] rounded-full border-0">
            Ready to Publish
          </Badge>
        </div>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-[12px] border border-[#e9eaf2]">
              <span className="text-[11px] font-[500] text-[#554e7b] uppercase tracking-wider">Exam Code</span>
              <p className="text-base font-mono font-[480] text-[#28253b] mt-1 select-all">
                {publishConfig.examCode || 'EXM-CODE'}
              </p>
            </div>

            <div className="bg-white p-3 rounded-[12px] border border-[#e9eaf2]">
              <span className="text-[11px] font-[500] text-[#554e7b] uppercase tracking-wider">Invigilator Login ID</span>
              <p className="text-base font-mono font-[480] text-[#5266eb] mt-1 select-all">
                {publishConfig.invigilatorId || 'INV-ID'}
              </p>
            </div>

            <div className="bg-white p-3 rounded-[12px] border border-[#e9eaf2]">
              <span className="text-[11px] font-[500] text-[#554e7b] uppercase tracking-wider">Password</span>
              <p className="text-base font-mono font-[480] text-[#5266eb] mt-1 select-all">
                {publishConfig.invigilatorPassword || 'PASSWORD'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyCredentials}
              className="text-xs bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] rounded-[40px] px-3.5 h-8 border-0 font-[420]"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-[#5266eb]" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadSlip('txt')}
              className="text-xs bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] rounded-[40px] px-3.5 h-8 border-0 font-[420]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download Slip (.txt)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadSlip('csv')}
              className="text-xs bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] rounded-[40px] px-3.5 h-8 border-0 font-[420]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download (.csv)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Recap Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/40 p-3.5 rounded-lg border border-border">
        <div>
          <span className="text-muted-foreground">Subject</span>
          <p className="font-[480] text-foreground truncate">{schedule.title || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Questions</span>
          <p className="font-[480] text-foreground">{questions.length} Items</p>
        </div>
        <div>
          <span className="text-muted-foreground">Duration</span>
          <p className="font-[480] text-foreground">{schedule.durationMinutes} Minutes</p>
        </div>
        <div>
          <span className="text-muted-foreground">Audience</span>
          <p className="font-[480] text-foreground truncate">{audience.department} ({audience.semester})</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md border border-destructive/20 font-medium">
          {error}
        </p>
      )}

      {/* Publish Now Action */}
      <div className="pt-2 flex justify-end">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto px-8 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 font-[480] shadow-md"
          onClick={onPublish}
          disabled={isPublishing || !questions.length}
        >
          {isPublishing ? (
            <>Publishing Exam & Assigning Cohort...</>
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
