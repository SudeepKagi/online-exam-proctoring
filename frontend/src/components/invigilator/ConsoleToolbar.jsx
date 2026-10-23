import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function ConsoleToolbar({
  exams,
  selectedExamId,
  onSelectExamId,
  filter,
  onSelectFilter
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 font-sans">
      <Select value={selectedExamId} onValueChange={onSelectExamId}>
        <SelectTrigger className="w-72 bg-white border border-[#c3c3cc]/60 rounded-xl text-xs font-medium h-9">
          <SelectValue placeholder="Select examination cohort" />
        </SelectTrigger>
        <SelectContent>
          {exams.map(e => (
            <SelectItem key={e.id} value={e.id} className="text-xs">
              {e.title} ({e.courseCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5 bg-[#fbfbff] p-1 border border-[#e9eaf2] rounded-[40px]">
        {['ALL', 'IN_PROGRESS', 'FLAGGED', 'SUSPENDED'].map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'ghost'}
            onClick={() => onSelectFilter(f)}
            className={`text-xs h-7 rounded-[40px] px-3 ${filter === f ? 'bg-[#5266eb] text-white shadow-xs' : 'text-[#554e7b]'}`}
          >
            {f.replace('_', ' ')}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default ConsoleToolbar
