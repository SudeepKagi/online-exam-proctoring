import React from 'react'
import { AlertTriangle, WifiOff, RefreshCw, Lock, HelpCircle } from 'lucide-react'

export default function ErrorState({
  title = 'Unable to load data',
  message = 'An unexpected error occurred while communicating with the service.',
  category = 'general', // network | auth | server | general
  onRetry,
  className = ''
}) {
  const getIcon = () => {
    switch (category) {
      case 'network':
        return WifiOff
      case 'auth':
        return Lock
      default:
        return AlertTriangle
    }
  }

  const Icon = getIcon()

  return (
    <div className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center font-sans ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mb-3.5 shadow-2xs">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 max-w-md font-normal leading-relaxed mb-5">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw size={13} /> Try Again
        </button>
      )}
    </div>
  )
}
