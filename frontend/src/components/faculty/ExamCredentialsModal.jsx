import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KeyRound, Copy, Check, ShieldCheck } from 'lucide-react'

export default function ExamCredentialsModal({ isOpen, onClose, exam }) {
  const [copied, setCopied] = useState(false)
  if (!exam) return null

  const pConfig = exam.proctoringConfig || {}
  const creds = pConfig.invigilatorCredentials || {}
  const examCode = pConfig.examCode || creds.examCode || exam.courseCode || 'EXM-N/A'
  const invigilatorId = creds.loginId || creds.invigilatorId || 'INV-NOT-SET'
  const invigilatorPassword = creds.password || creds.invigilatorPassword || '••••••••'

  const handleCopy = () => {
    const text = `PROCTORNET EXAM CREDENTIALS
Exam: ${exam.title}
Exam Code: ${examCode}
Invigilator ID: ${invigilatorId}
Password: ${invigilatorPassword}
URL: ${window.location.origin}/login`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-primary">
            <KeyRound className="w-5 h-5" />
            <DialogTitle className="text-base font-bold text-foreground">
              Invigilator Surveillance Credentials
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Provide these credentials to the proctor assigned to supervise {exam.title}.
          </DialogDescription>
        </DialogHeader>

        <Card className="bg-zinc-950 text-zinc-100 border border-zinc-800">
          <CardContent className="p-4 space-y-3">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Exam Code</span>
              <p className="text-sm font-mono font-bold text-zinc-200 mt-0.5 select-all">{examCode}</p>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Invigilator Login ID</span>
              <p className="text-sm font-mono font-bold text-amber-400 mt-0.5 select-all">{invigilatorId}</p>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Password</span>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5 select-all">{invigilatorPassword}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
          <Button size="sm" onClick={handleCopy} className="text-xs gap-1.5 bg-primary text-primary-foreground">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Credentials'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
