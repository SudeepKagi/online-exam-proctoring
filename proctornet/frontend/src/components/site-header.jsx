import { useState } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Search, Bell } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CommandPalette } from '@/components/ui/command-palette'

export function SiteHeader({ title = 'Student Console' }) {
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 h-13 bg-[#09090B]/95 backdrop-blur border-b border-[#27272A] flex items-center justify-between px-4 lg:px-6 text-slate-100 font-sans">
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="h-4 w-[1px] bg-[#27272A] hidden sm:block" />
        <span className="text-xs font-mono font-semibold tracking-wide text-slate-200 uppercase hidden sm:block">{title}</span>
      </div>

      {/* ⌘K Command Search Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center justify-between gap-6 px-3 py-1.5 text-xs text-slate-400 bg-[#141416] border border-[#27272A] rounded-xl hover:bg-[#18181A] transition-colors"
        >
          <span className="flex items-center gap-2 text-[11px]">
            <Search size={12} className="text-slate-400" />
            Search exams or commands...
          </span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-[#27272A] bg-[#09090B] px-1 font-mono text-[9px] text-slate-400">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />

        <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#27272A] transition-colors relative">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white rounded-full" />
        </button>
      </div>
    </header>
  )
}
