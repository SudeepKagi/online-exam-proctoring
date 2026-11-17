import React from 'react'
import { Inbox, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <Button
          type="button"
          onClick={onAction}
          variant="primary"
          size="sm"
        >
          <Plus size={14} /> {actionText}
        </Button>
      )}
    </div>
  )
}
