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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start justify-center pt-24 px-4 animate-in fade-in-80">
      <div className="w-full max-w-lg bg-[#111113] border border-[#232326] rounded-xl shadow-2xl overflow-hidden text-slate-100">
        <div className="flex items-center px-3.5 border-b border-[#232326]">
          <Search size={14} className="text-slate-400 mr-2 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search exams, students, logs..."
            className="w-full h-11 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
          />
          <button onClick={() => onOpenChange(false)} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">No matching commands or navigation routes found.</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-slate-300 hover:bg-[#18181B] hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={14} className="text-slate-400" />
                    {item.title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{item.category}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="px-3.5 py-2 border-t border-[#232326] bg-[#0A0A0A] flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Navigate: <kbd className="px-1 bg-[#18181B] border border-[#232326] rounded text-slate-400">↑↓</kbd></span>
          <span>Select: <kbd className="px-1 bg-[#18181B] border border-[#232326] rounded text-slate-400">↵</kbd></span>
          <span>Close: <kbd className="px-1 bg-[#18181B] border border-[#232326] rounded text-slate-400">ESC</kbd></span>
        </div>
      </div>
    </div>
  )
}
