import React from 'react'
import { Award, BookOpen, Clock, CheckCircle2 } from 'lucide-react'

export function SectionCards({ avgScore = 0, activeCount = 0, scheduledCount = 0, completedCount = 0 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* Card 1: Average Score */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">All-Time Average</span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2f80ed] flex items-center justify-center border border-blue-100">
            <Award size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {completedCount > 0 ? `${avgScore}%` : '—'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full my-2.5 overflow-hidden">
          <div
            className="h-full bg-[#2f80ed] rounded-full transition-all duration-300"
            style={{ width: completedCount > 0 ? `${avgScore}%` : '0%' }}
          />
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {completedCount > 0 ? '≥ 40% passing benchmark' : 'No evaluated exams yet'}
        </p>
      </div>

      {/* Card 2: Active Exams */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Live In-Progress</span>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <BookOpen size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeCount}</span>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2.5">Live assessments running</p>
      </div>

      {/* Card 3: Upcoming Exams */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Upcoming Tests</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Clock size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{scheduledCount}</span>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2.5">Scheduled this semester</p>
      </div>

      {/* Card 4: Completed Exams */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Submitted Papers</span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{completedCount}</span>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2.5">Evaluated & archived</p>
      </div>
    </div>
  )
}
export default SectionCards
