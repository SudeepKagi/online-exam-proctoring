import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'

export function SubmitExamDialog({ open, onOpenChange, answeredCount, totalCount, onConfirm, submitting }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="text-base font-[480] text-[#28253b]">Submit Examination?</DialogTitle>
          <DialogDescription className="text-xs font-[360] text-[#554e7b]">
            You have answered {answeredCount} of {totalCount} questions. You cannot change your answers once submitted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-[40px] px-4 font-[420] text-xs h-9">
            Continue Exam
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="bg-[#5266eb] hover:bg-[#4353c7] text-white rounded-[32px] px-4 font-[420] text-xs h-9">
            {submitting ? 'Submitting...' : 'Confirm Submission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { AlertTriangle } from 'lucide-react'

export function SuspendedOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans">
      <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-[480] text-[#28253b] mb-2">Examination Session Suspended</h2>
      <p className="text-sm font-[360] text-[#554e7b] max-w-md">
        Your exam attempt has been temporarily suspended by the proctoring staff. Please await remote review or clearance.
      </p>
    </div>
  )
}
