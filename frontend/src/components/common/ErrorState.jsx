import React from 'react'
import { AlertTriangle, WifiOff, RefreshCw, Lock } from 'lucide-react'

const ICONS = {
  network: WifiOff,
  auth: Lock,
  general: AlertTriangle
}

export default function ErrorState({
  title = 'Unable to load data',
  message = 'An unexpected error occurred while communicating with the service.',
  category = 'general', // network | auth | server | general
  onRetry,
  className = ''
}) {
  const Icon = ICONS[category] || AlertTriangle

  return (
    <div className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center font-sans ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-3.5 border-0">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-[480] text-[#28253b] tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-[#554e7b] max-w-md font-[360] leading-relaxed mb-5">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw size={13} /> Try Again
        </button>
      )}
    </div>
  )
}
