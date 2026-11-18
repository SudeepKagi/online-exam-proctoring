import React from 'react'

export default function ConsoleKpiBar({ candidates = [] }) {
  const inProgressCount = candidates.filter(c => c.attemptStatus === 'IN_PROGRESS').length
  const pendingIdentityCount = candidates.filter(c => c.faceStatus === 'PENDING_APPROVAL' || c.faceStatus === 'NO_REFERENCE' || (!c.faceVerified && c.faceStatus && c.faceStatus !== 'MATCH')).length
  const flaggedCount = candidates.filter(c => (c.violationCount || 0) > 0).length
  const suspendedCount = candidates.filter(c => c.attemptStatus === 'SUSPENDED').length
  const submittedCount = candidates.filter(c => ['SUBMITTED', 'TIMED_OUT', 'TERMINATED'].includes(c.attemptStatus)).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-sans">
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">Assigned Candidates</span>
        <span className="text-xl font-[480] text-[#28253b] mt-0.5 block">{candidates.length}</span>
      </div>
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">In Progress</span>
        <span className="text-xl font-[480] text-[#5266eb] mt-0.5 block">{inProgressCount}</span>
      </div>
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">Identity Queue</span>
        <span className={`text-xl font-[480] mt-0.5 block ${pendingIdentityCount > 0 ? 'text-[#5266eb]' : 'text-[#28253b]'}`}>
          {pendingIdentityCount}
        </span>
      </div>
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">Violations Flagged</span>
        <span className="text-xl font-[480] text-[#28253b] mt-0.5 block">{flaggedCount}</span>
      </div>
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">Suspended</span>
        <span className="text-xl font-[480] text-[#554e7b] mt-0.5 block">{suspendedCount}</span>
      </div>
      <div className="bg-white rounded-[16px] p-3.5 shadow-xs">
        <span className="text-[10px] font-[500] text-[#554e7b] uppercase tracking-wider block">Submitted</span>
        <span className="text-xl font-[480] text-[#5266eb] mt-0.5 block">{submittedCount}</span>
      </div>
    </div>
  )
}

