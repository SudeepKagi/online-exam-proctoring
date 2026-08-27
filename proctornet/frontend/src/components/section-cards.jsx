import React from 'react'
import { Award, BookOpen, Clock, CheckCircle2 } from 'lucide-react'

export function SectionCards({ avgScore = 0, activeCount = 0, scheduledCount = 0, completedCount = 0 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* Card 1: Average Score */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">All-Time Average</span>
          <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2f80ed] flex items-center justify-center border border-[#dbeafe]">
            <Award size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-bold text-[#0f172a] tracking-tight">
            {completedCount > 0 ? `${avgScore}%` : '—'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full my-2.5 overflow-hidden">
          <div
            className="h-full bg-[#2f80ed] rounded-full transition-all duration-300"
            style={{ width: completedCount > 0 ? `${avgScore}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-[#94a3b8]">
          {completedCount > 0 ? '≥ 40% passing benchmark' : 'No evaluated exams yet'}
        </p>
      </div>

      {/* Card 2: Active Exams */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Live In-Progress</span>
          <div className="w-9 h-9 rounded-xl bg-[#faf5ff] text-[#7c3aed] flex items-center justify-center border border-[#ede9fe]">
            <BookOpen size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{activeCount}</span>
        </div>
        <p className="text-xs text-[#94a3b8] mt-2.5">Live assessments running</p>
      </div>

      {/* Card 3: Upcoming Exams */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Upcoming Tests</span>
          <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] text-[#10b981] flex items-center justify-center border border-[#dcfce7]">
            <Clock size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{scheduledCount}</span>
        </div>
        <p className="text-xs text-[#94a3b8] mt-2.5">Scheduled this semester</p>
      </div>

      {/* Card 4: Completed Exams */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Submitted Papers</span>
          <div className="w-9 h-9 rounded-xl bg-[#fffbeb] text-[#f59e0b] flex items-center justify-center border border-[#fef3c7]">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{completedCount}</span>
        </div>
        <p className="text-xs text-[#94a3b8] mt-2.5">Evaluated & archived</p>
      </div>
    </div>
  )
}
export default SectionCards
