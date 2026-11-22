import React from 'react'
import { AlertCircle, RefreshCw, LogIn, ArrowLeft, WifiOff, FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Enterprise Async State View Component (§Phase 4 Standard)
 * Codifies .agents/skills/client-error-resilience/SKILL.md
 * Renders explicit loading, empty, error, offline, forbidden, and session_expired states.
 */
export function AsyncStateView({
  state = 'success', // 'loading' | 'empty' | 'error' | 'offline' | 'forbidden' | 'session_expired' | 'success'
  error = null,
  actionLabel = null,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items to display at this time.',
  emptyActionLabel = null,
  onEmptyAction = null,
  onRetry = null,
  onAction = null,
  skeletonHeight = '240px',
  children
}) {
  if (state === 'loading') {
    return (
      <div
        className="w-full bg-[#edecfb] rounded-[24px] p-8 animate-pulse flex flex-col justify-center items-center gap-4 text-center"
        style={{ minHeight: skeletonHeight }}
      >
        <div className="w-10 h-10 rounded-full bg-[#f4f3fd]" />
        <div className="w-48 h-4 rounded-full bg-[#f4f3fd]" />
        <div className="w-64 h-3 rounded-full bg-[#f4f3fd]" />
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="w-full bg-[#edecfb] rounded-[24px] p-8 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ffffff] text-[#554e7b] flex items-center justify-center">
          <FileQuestion className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-sm font-[480] text-[#28253b]">{emptyTitle}</h3>
          <p className="text-xs font-[360] text-[#554e7b] leading-relaxed">{emptyMessage}</p>
        </div>
        {emptyActionLabel && onEmptyAction && (
          <Button variant="outline" size="sm" onClick={onEmptyAction} className="rounded-full">
            {emptyActionLabel}
          </Button>
        )}
      </div>
    )
  }

  if (state === 'error') {
    const title = error?.title || 'Unable to load content'
    const message = error?.message || 'An unexpected issue occurred while fetching data.'
    const referenceId = error?.referenceId || null
    const displayActionLabel = actionLabel || error?.actionLabel || 'Try Again'

    return (
      <div data-testid="async-state-error" className="w-full bg-[#edecfb] rounded-[24px] p-6 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ffffff] text-[#5266eb] flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-[480] text-[#28253b]">{title}</h3>
          <p className="text-xs font-[360] text-[#554e7b] leading-relaxed">{message}</p>
          {referenceId && (
            <p className="text-[11px] font-mono text-[#554e7b]/80 pt-1">Reference: {referenceId}</p>
          )}
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <Button data-testid="async-state-retry-btn" variant="primary" size="sm" onClick={onRetry} className="rounded-full flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{displayActionLabel}</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (state === 'offline') {
    return (
      <div className="w-full bg-[#edecfb] rounded-[24px] p-6 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ffffff] text-[#554e7b] flex items-center justify-center">
          <WifiOff className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-[480] text-[#28253b]">Network Connection Interrupted</h3>
          <p className="text-xs font-[360] text-[#554e7b] leading-relaxed">
            Your exam answers and progress are safely preserved in offline storage. Connectivity will resume automatically.
          </p>
        </div>
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry} className="rounded-full flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconnect</span>
          </Button>
        )}
      </div>
    )
  }

  if (state === 'forbidden') {
    return (
      <div className="w-full bg-[#edecfb] rounded-[24px] p-6 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ffffff] text-[#554e7b] flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-[480] text-[#28253b]">Access Restricted</h3>
          <p className="text-xs font-[360] text-[#554e7b] leading-relaxed">
            You do not have permission to view or interact with this examination resource.
          </p>
        </div>
        {onAction && (
          <Button variant="outline" size="sm" onClick={onAction} className="rounded-full flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Button>
        )}
      </div>
    )
  }

  if (state === 'session_expired') {
    return (
      <div className="w-full bg-[#edecfb] rounded-[24px] p-6 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ffffff] text-[#5266eb] flex items-center justify-center">
          <LogIn className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-[480] text-[#28253b]">Session Expired</h3>
          <p className="text-xs font-[360] text-[#554e7b] leading-relaxed">
            Your security session has expired. Please sign in again to continue where you left off.
          </p>
        </div>
        {onAction && (
          <Button variant="primary" size="sm" onClick={onAction} className="rounded-full flex items-center gap-1.5">
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Button>
        )}
      </div>
    )
  }

  return children || null
}

export default AsyncStateView
