import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, GraduationCap, BarChart2, Shield, Settings, AlertTriangle, X } from 'lucide-react'

export function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  const items = [
    { title: 'Student Dashboard', path: '/student/dashboard', category: 'Navigation', icon: BookOpen },
    { title: 'My Examinations', path: '/student/exams', category: 'Navigation', icon: BookOpen },
    { title: 'Performance Dossier', path: '/student/results', category: 'Navigation', icon: BarChart2 },
    { title: 'Faculty Console', path: '/faculty/dashboard', category: 'Navigation', icon: GraduationCap },
    { title: 'Admin Security Metrics', path: '/admin/dashboard', category: 'Navigation', icon: Shield },
    { title: 'Live Invigilator Terminal', path: '/invigilator/dashboard', category: 'Console', icon: AlertTriangle },
  ]

  const filtered = items.filter(i => i.title.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (path) => {
    onOpenChange(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-24 px-4 animate-in fade-in-80">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground">
        <div className="flex items-center px-4 border-b border-border">
          <Search size={15} className="text-muted-foreground mr-2.5 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search exams, students, logs..."
            className="w-full h-12 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none font-sans"
            aria-label="Command search"
          />
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No matching commands or navigation routes found.</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl text-foreground hover:bg-[#eff6ff] hover:text-primary dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={15} className="text-primary shrink-0" />
                    {item.title}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.category}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border bg-[#f8fafc] dark:bg-neutral-900 flex items-center justify-between text-xs text-muted-foreground">
          <span>Navigate: <kbd className="px-1.5 py-0.5 bg-card border border-border rounded-md text-foreground font-semibold text-[10px]">↑↓</kbd></span>
          <span>Select: <kbd className="px-1.5 py-0.5 bg-card border border-border rounded-md text-foreground font-semibold text-[10px]">↵</kbd></span>
          <span>Close: <kbd className="px-1.5 py-0.5 bg-card border border-border rounded-md text-foreground font-semibold text-[10px]">ESC</kbd></span>
        </div>
      </div>
    </div>
  )
}
