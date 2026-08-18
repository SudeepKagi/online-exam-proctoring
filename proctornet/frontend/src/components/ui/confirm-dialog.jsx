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
      <DialogContent className="max-w-md bg-[#141416] border-[#27272A] text-slate-100 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-col items-center sm:items-start gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              variant === 'destructive'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}>
              {variant === 'destructive' ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
            </div>
            <DialogTitle className="text-base font-bold text-slate-100 font-sans">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400 leading-relaxed font-sans mt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs font-mono border-[#27272A] bg-[#09090B] text-slate-300 hover:bg-[#18181B] hover:text-white"
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
            className={`text-xs font-mono font-bold ${
              variant === 'destructive'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
