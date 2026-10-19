import React from 'react'

export default function ConsoleKpiBar({ candidates = [] }) {
  const inProgressCount = candidates.filter(c => c.attemptStatus === 'IN_PROGRESS').length
  const flaggedCount = candidates.filter(c => c.violationCount > 0).length
  const suspendedCount = candidates.filter(c => c.attemptStatus === 'SUSPENDED').length
  const submittedCount = candidates.filter(c => c.attemptStatus === 'SUBMITTED').length

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-sans">
      <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
        <span className="text-[10px] font-medium text-[#554e7b] uppercase tracking-wider block">Assigned Candidates</span>
        <span className="text-xl font-bold text-[#28253b]">{candidates.length}</span>
      </div>
      <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
        <span className="text-[10px] font-medium text-blue-700 uppercase tracking-wider block">In Progress</span>
        <span className="text-xl font-bold text-blue-600">{inProgressCount}</span>
      </div>
      <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
        <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider block">Violations Flagged</span>
        <span className="text-xl font-bold text-amber-600">{flaggedCount}</span>
      </div>
      <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs">
        <span className="text-[10px] font-medium text-rose-700 uppercase tracking-wider block">Suspended</span>
        <span className="text-xl font-bold text-rose-600">{suspendedCount}</span>
      </div>
      <div className="bg-white border border-[#e9eaf2] rounded-[12px] p-3.5 shadow-xs col-span-2 md:col-span-1">
        <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider block">Submitted</span>
        <span className="text-xl font-bold text-emerald-600">{submittedCount}</span>
      </div>
    </div>
  )
}
