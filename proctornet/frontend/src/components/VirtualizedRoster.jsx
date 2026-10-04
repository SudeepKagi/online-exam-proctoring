/**
 * VirtualizedRoster.jsx
 * High-performance virtualized candidate grid/list utilizing @tanstack/react-virtual.
 * Guarantees 60fps scrolling and bounded DOM size even with 5,000+ candidates (Task 8).
 */

import React, { useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const CandidateRow = memo(({ item, onAction }) => {
  const isOnline = item.online
  const statusColor = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    READY: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    SUBMITTED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    TERMINATED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  }[item.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl transition-colors mb-2">
      {/* Student Identity & Presence */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          {item.thumbUrl ? (
            <img
              src={item.thumbUrl}
              alt={item.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-sm">
              {(item.name || 'S').substring(0, 2).toUpperCase()}
            </div>
          )}
          {/* Realtime Presence Dot */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
              isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse' : 'bg-slate-500'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-100 text-sm truncate">{item.name}</h4>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {item.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{item.usn}</p>
        </div>
      </div>

      {/* Progress & Flags */}
      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400">Progress</p>
          <p className="text-xs font-semibold text-slate-200">
            {item.answered ?? 0} / {item.total ?? 0}
          </p>
        </div>

        <div className="text-center">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              (item.flagCount || 0) > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-slate-800/40 text-slate-400 border-slate-800'
            }`}
          >
            ⚠️ {item.flagCount || 0}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAction?.('warn', item)}
            className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
          >
            Warn
          </button>
          {item.status === 'PAUSED' ? (
            <button
              onClick={() => onAction?.('resume', item)}
              className="px-2.5 py-1 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={() => onAction?.('pause', item)}
              disabled={item.status !== 'ACTIVE'}
              className="px-2.5 py-1 text-xs font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-40"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => onAction?.('terminate', item)}
            disabled={['TERMINATED', 'SUBMITTED'].includes(item.status)}
            className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors disabled:opacity-40"
          >
            Terminate
          </button>
        </div>
      </div>
    </div>
  )
})

CandidateRow.displayName = 'CandidateRow'

export function VirtualizedRoster({ items = [], onAction, height = 600 }) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 6
  })

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
        <p className="text-sm font-medium">No candidates match the active filter</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      style={{ height: `${height}px`, overflowY: 'auto' }}
      className="w-full rounded-2xl custom-scrollbar"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          return (
            <div
              key={item.attemptId || virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <CandidateRow item={item} onAction={onAction} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
