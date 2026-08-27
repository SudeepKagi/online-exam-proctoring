import React, { useState } from 'react'
import { Award, BarChart3 } from 'lucide-react'

export function ChartAreaInteractive({ results = [] }) {
  const [timeRange, setTimeRange] = useState('7d')

  // Map real results or show empty state
  const hasResults = Array.isArray(results) && results.length > 0

  const points = hasResults
    ? results.map((r, i) => ({
        label: r.code || `Exam ${i + 1}`,
        score: Math.round(r.percentage || (r.score && r.maxScore ? (r.score / r.maxScore) * 100 : 0)),
        exam: r.title || `Test ${i + 1}`,
      }))
    : []

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xs font-sans space-y-6">
      {/* Header with Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
        <div>
          <h3 className="text-sm font-bold text-[#0f172a]">Performance Analytics</h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Average examination scores and competency performance trends.
          </p>
        </div>

        {hasResults && (
          <div className="flex items-center gap-1 bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0]">
            {['7d', '30d', '90d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === range
                    ? 'bg-white text-[#2f80ed] shadow-2xs border border-[#e2e8f0]'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasResults ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] text-[#2f80ed] flex items-center justify-center mx-auto mb-3 border border-[#dbeafe]">
            <BarChart3 size={22} />
          </div>
          <h4 className="text-xs font-bold text-[#0f172a]">No Assessment Performance Data</h4>
          <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
            Your competency progress and examination scores will appear here after attempting your first proctored assessment.
          </p>
        </div>
      ) : (
        <div className="pt-2">
          <div className="h-48 w-full flex items-end justify-around gap-2 px-4 pb-2 border-b border-[#f1f5f9]">
            {points.map((p, idx) => {
              const heightPercent = Math.max(15, p.score)
              return (
                <div key={idx} className="flex-1 max-w-[56px] flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-9 bg-[#0f172a] text-white text-[10px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none whitespace-nowrap z-10">
                    {p.score}% • {p.exam}
                  </div>

                  <span className="text-[11px] font-bold text-[#64748b] group-hover:text-[#2f80ed] transition-colors">
                    {p.score}%
                  </span>

                  <div
                    className="w-8 sm:w-10 rounded-t-xl bg-gradient-to-t from-[#2f80ed] to-[#60a5fa] hover:brightness-110 shadow-2xs transition-all duration-300 relative"
                    style={{ height: `${heightPercent * 1.5}px` }}
                  />

                  <span className="text-xs font-semibold text-[#64748b] mt-1">
                    {p.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#64748b] pt-3.5 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2f80ed]" />
              <span>Metric: <strong className="text-[#0f172a]">Proctored Exam Score Average</strong></span>
            </div>
            <span className="text-[11px] text-[#94a3b8]">Evaluated across authenticated university assessment sessions</span>
          </div>
        </div>
      )}
    </div>
  )
}
export default ChartAreaInteractive
