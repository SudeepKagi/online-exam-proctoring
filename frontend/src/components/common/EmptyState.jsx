import React from 'react'
import { Inbox, Plus } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items matching your criteria at this moment.',
  actionText,
  onAction,
  className = ''
}) {
  return (
    <div className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center font-sans ${className}`}>
      <div className="w-12 h-12 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-3">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-[480] text-[#28253b] tracking-tight mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[#554e7b] max-w-sm font-[360] leading-relaxed mb-4">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] transition-all cursor-pointer shadow-xs"
        >
          <Plus size={14} /> {actionText}
        </button>
      )}
    </div>
  )
}
