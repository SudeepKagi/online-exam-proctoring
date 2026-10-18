import React from 'react'

/**
 * ExamArenaShell Component
 * Dedicated container for Student System & Identity Check and Live Exam Arena
 * Enforces:
 * - Viewport lockdown & select-none
 * - Standard canvas styling (bg-slate-50 / dark:bg-slate-950)
 * - Zero outer scroll leakage
 */
export default function ExamArenaShell({ children, className = '' }) {
  return (
    <div className={`min-h-screen w-full bg-[#fbfcfd] text-[#28253b] flex flex-col font-sans select-none relative overflow-x-hidden ${className}`}>
      {children}
    </div>
  )
}

export { ExamArenaShell }
