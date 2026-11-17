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
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Continue Exam
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Confirm Submission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { AlertTriangle, Copy } from 'lucide-react'

export function SuspendedOverlay() {
  return (
    <div
      data-testid="suspended-overlay"
      className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans"
    >
      <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-[480] text-[#28253b] mb-2">Paused by Invigilator</h2>
      <p className="text-sm font-[360] text-[#554e7b] max-w-md leading-relaxed">
        Your exam attempt has been paused by the invigilator. Please wait for the invigilator to resume your exam.
      </p>
    </div>
  )
}

export function DuplicateTabOverlay({ onReturn, onTakeOver }) {
  return (
    <div
      data-testid="duplicate-tab-overlay"
      className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans"
    >
      <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
        <Copy className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-[480] text-[#28253b] mb-2">Exam Open in Another Window</h2>
      <p className="text-sm font-[360] text-[#554e7b] max-w-md leading-relaxed mb-6">
        This exam is already open in another window. An exam session can only run in a single active window. You can return to your dashboard or continue in this window.
      </p>
      <div className="flex items-center gap-3">
        {onTakeOver && (
          <Button
            type="button"
            data-testid="duplicate-tab-takeover-btn"
            onClick={onTakeOver}
            className="h-10 px-6 cursor-pointer"
          >
            Continue in this window
          </Button>
        )}
        {onReturn && (
          <Button
            type="button"
            data-testid="duplicate-tab-return-btn"
            onClick={onReturn}
            variant={onTakeOver ? "secondary" : "primary"}
            className="h-10 px-6 cursor-pointer"
          >
            Return to Student Dashboard
          </Button>
        )}
      </div>
    </div>
  )
}
