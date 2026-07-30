import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SectionCards({ avgScore = 85, activeCount = 0, scheduledCount = 2, completedCount = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* Card 1: Average Score */}
      <Card className="border-[#27272A] bg-[#141416]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Average Score
            </CardDescription>
            <Badge variant="secondary" className="font-mono text-[9px]">OVERALL</Badge>
          </div>
          <CardTitle className="text-3xl font-bold font-mono text-white mt-1">
            {avgScore}%
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="w-full h-1.5 bg-[#27272A] rounded-full my-2 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${avgScore}%` }} />
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            &ge; 40% passing score
          </p>
        </CardContent>
      </Card>

      {/* Card 2: Active Exams */}
      <Card className="border-[#27272A] bg-[#141416]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Active Exams
            </CardDescription>
            <Badge variant="outline" className="font-mono text-[9px]">LIVE</Badge>
          </div>
          <CardTitle className="text-3xl font-bold font-mono text-white mt-1">
            {activeCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            Exams currently in progress
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Upcoming Exams */}
      <Card className="border-[#27272A] bg-[#141416]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Upcoming Exams
            </CardDescription>
            <Badge variant="secondary" className="font-mono text-[9px]">SCHEDULED</Badge>
          </div>
          <CardTitle className="text-3xl font-bold font-mono text-white mt-1">
            {scheduledCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            Scheduled upcoming exams
          </p>
        </CardContent>
      </Card>

      {/* Card 4: Completed Exams */}
      <Card className="border-[#27272A] bg-[#141416]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Completed Exams
            </CardDescription>
            <Badge variant="secondary" className="font-mono text-[9px]">FINISHED</Badge>
          </div>
          <CardTitle className="text-3xl font-bold font-mono text-white mt-1">
            {completedCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            Evaluated past exams
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
