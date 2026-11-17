import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react'

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive', // 'destructive' | 'default' | 'primary'
  onConfirm,
  loading = false
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-col items-center sm:items-start gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              variant === 'destructive'
                ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                : 'bg-[#eff6ff] border-[#d5e6fb] text-primary'
            }`}>
              {variant === 'destructive' ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
            </div>
            <DialogTitle className="text-base font-[480] text-foreground font-sans">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed font-sans mt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-2 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs px-3.5"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (onConfirm) await onConfirm()
              onOpenChange(false)
            }}
            disabled={loading}
            className="text-xs px-4 h-9 cursor-pointer"
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
