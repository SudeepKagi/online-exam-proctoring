import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function ConsoleToolbar({
  exams,
  selectedExamId,
  onSelectExamId,
  filter,
  onSelectFilter,
  pendingIdentityCount = 0
}) {
  const filters = [
    { id: 'ALL', label: 'All Candidates' },
    { id: 'IDENTITY_QUEUE', label: pendingIdentityCount > 0 ? `Identity Queue (${pendingIdentityCount})` : 'Identity Queue' },
    { id: 'NEEDS_ATTENTION', label: 'Needs Attention' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'FLAGGED', label: 'Flagged' },
    { id: 'SUSPENDED', label: 'Suspended' }
  ]

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mt-4 font-sans">
      <Select value={selectedExamId} onValueChange={onSelectExamId}>
        <SelectTrigger className="w-full sm:w-80 bg-white border-0 shadow-xs rounded-[16px] text-xs font-[420] h-10 px-3.5 text-[#28253b]">
          <SelectValue placeholder="Select examination cohort" />
        </SelectTrigger>
        <SelectContent className="bg-white border-0 shadow-lg rounded-[16px]">
          {exams.map(e => (
            <SelectItem key={e.id} value={e.id} className="text-xs font-[420] text-[#28253b] py-2">
              {e.title} ({e.courseCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5 bg-[#fbfbff] p-1.5 rounded-[40px] shadow-xs flex-wrap">
        {filters.map(f => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? 'primary' : 'ghost'}
            onClick={() => onSelectFilter(f.id)}
            className={`text-xs h-8 rounded-[40px] px-3.5 font-[420] transition-colors ${
              filter === f.id ? 'bg-[#5266eb] text-white' : 'text-[#554e7b] hover:bg-[#edecfb]'
            }`}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default ConsoleToolbar
