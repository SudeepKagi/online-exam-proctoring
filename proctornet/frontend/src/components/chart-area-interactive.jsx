import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = useState('7d')

  const points = [
    { label: 'Mon', score: 65 },
    { label: 'Tue', score: 72 },
    { label: 'Wed', score: 80 },
    { label: 'Thu', score: 78 },
    { label: 'Fri', score: 85 },
    { label: 'Sat', score: 88 },
    { label: 'Sun', score: 92 },
  ]

  return (
    <Card className="border-[#27272A] bg-[#141416] font-sans">
      <CardHeader className="pb-3 border-b border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-100">Performance Analytics</CardTitle>
          <CardDescription className="text-xs text-slate-400">Average exam scores and student activity trends over time.</CardDescription>
        </div>
        <div className="flex items-center gap-1 bg-[#09090B] p-0.5 rounded-xl border border-[#27272A]">
          {['7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                timeRange === range ? 'bg-[#27272A] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="h-44 w-full flex items-end justify-between gap-3 pt-4 px-2 border-b border-[#27272A]">
          {points.map((p, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.score}%
              </div>
              <div className="w-full bg-[#27272A] rounded-t-lg transition-all group-hover:bg-white relative overflow-hidden" style={{ height: `${p.score * 1.3}px` }}>
                <div className="w-full h-full bg-white opacity-20" />
              </div>
              <span className="text-[10px] font-mono text-slate-400 mt-1">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-3">
          <span>Metric: <strong className="text-white">Average Exam Scores</strong></span>
          <span>Sample Size: <strong className="text-white">Recent student exams</strong></span>
        </div>
      </CardContent>
    </Card>
  )
}
