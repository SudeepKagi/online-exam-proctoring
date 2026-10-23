import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KeyRound, Copy, Check } from 'lucide-react'

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
          <div className="flex items-center space-x-2 text-[#5266eb]">
            <KeyRound className="w-5 h-5" />
            <DialogTitle className="text-base font-[480] text-[#28253b]">
              Invigilator Surveillance Credentials
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#554e7b] font-[360]">
            Provide these credentials to the proctor assigned to supervise {exam.title}.
          </DialogDescription>
        </DialogHeader>

        <Card className="bg-[#edecfb] text-[#28253b] border-0 rounded-[12px]">
          <CardContent className="p-4 space-y-3">
            <div>
              <span className="text-[11px] text-[#554e7b] uppercase tracking-wider font-[500]">Exam Code</span>
              <p className="text-sm font-mono font-[480] text-[#28253b] mt-0.5 select-all">{examCode}</p>
            </div>
            <div>
              <span className="text-[11px] text-[#554e7b] uppercase tracking-wider font-[500]">Invigilator Login ID</span>
              <p className="text-sm font-mono font-[480] text-[#5266eb] mt-0.5 select-all">{invigilatorId}</p>
            </div>
            <div>
              <span className="text-[11px] text-[#554e7b] uppercase tracking-wider font-[500]">Password</span>
              <p className="text-sm font-mono font-[480] text-[#5266eb] mt-0.5 select-all">{invigilatorPassword}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0"
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleCopy}
            className="text-xs font-[420] rounded-[32px] px-4 h-9 bg-[#5266eb] hover:bg-[#4353c7] text-white shadow-xs cursor-pointer gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Credentials'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
