import React from 'react'
import { AlertTriangle, AlertCircle, Trash2, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ConfirmDialog({
  isOpen,
  title = 'Are you absolutely sure?',
  description = 'This action cannot be undone and will immediately take effect.',
  confirmText = 'Confirm Action',
  cancelText = 'Cancel',
  variant = 'destructive', // destructive | warning | primary
  loading = false,
  onConfirm,
  onClose,
  children
}) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <ShieldAlert size={24} className="text-rose-600" />
      case 'warning':
        return <AlertTriangle size={24} className="text-amber-600" />
      default:
        return <AlertCircle size={24} className="text-[#2f80ed]" />
    }
  }

  const getConfirmStyle = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-rose-600 hover:bg-rose-700 text-white'
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white'
      default:
        return 'bg-[#2f80ed] hover:bg-[#2563eb] text-white'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            variant === 'destructive' ? 'bg-rose-50 border border-rose-100' : 'bg-amber-50 border border-amber-100'
          }`}>
            {getIcon()}
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-normal leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${getConfirmStyle()}`}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
