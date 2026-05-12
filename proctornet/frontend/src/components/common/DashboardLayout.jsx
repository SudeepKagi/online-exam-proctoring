import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Shield, Bell, ChevronDown, LogOut, User, Settings,
  LayoutDashboard, Users, GraduationCap, BookOpen, AlertTriangle,
  Megaphone, ClipboardList, BarChart2, Video, Menu, X
} from 'lucide-react'

const NAV_ITEMS = {
  admin: [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/faculty', icon: Users, label: 'Faculty' },
    { to: '/admin/students', icon: GraduationCap, label: 'Students' },
    { to: '/admin/exams', icon: BookOpen, label: 'Exams' },
    { to: '/admin/violations', icon: AlertTriangle, label: 'Violations' },
    { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
    { to: '/admin/invigilators', icon: Video, label: 'Invigilators' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
    { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
    { to: '/admin/reports', icon: BarChart2, label: 'Reports' },
  ],
  faculty: [
    { to: '/faculty/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/faculty/exams', icon: BookOpen, label: 'My Exams' },
    { to: '/faculty/students', icon: GraduationCap, label: 'Students' },
    { to: '/faculty/results', icon: BarChart2, label: 'Results' },
  ],
  student: [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/exams', icon: BookOpen, label: 'My Exams' },
    { to: '/student/results', icon: BarChart2, label: 'Results' },
  ],
}

const ROLE_COLORS = {
  admin: 'bg-blue-600',
  faculty: 'bg-indigo-600',
  student: 'bg-emerald-600',
}

const ROLE_ACCENT = {
  admin: 'text-blue-600 bg-blue-50 border-blue-600',
  faculty: 'text-indigo-600 bg-indigo-50 border-indigo-600',
  student: 'text-emerald-600 bg-emerald-50 border-emerald-600',
}

function ProfileDropdown() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => { logout(); navigate('/') }
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const roleColor = ROLE_COLORS[role] || 'bg-gray-500'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2.5 py-1.5 transition-colors">
        <div className={`w-8 h-8 rounded-full ${roleColor} text-white flex items-center justify-center font-semibold text-xs overflow-hidden flex-shrink-0`}>
          {user?.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.email}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1.5 inline-block font-medium border capitalize ${ROLE_ACCENT[role] || 'bg-gray-100 text-gray-600'}`}>
              {role}
            </span>
          </div>
          <div className="py-1">
            <button onClick={() => { setOpen(false); navigate(`/${role}/profile`) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
              <User size={15} className="text-gray-400" /> My Profile
            </button>
            <button onClick={() => { setOpen(false); navigate(`/${role}/settings`) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
              <Settings size={15} className="text-gray-400" /> Account Settings
            </button>
          </div>
          <div className="border-t border-gray-100 py-1">
            <button onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children, title }) {
  const { role } = useAuth()
  const navItems = NAV_ITEMS[role] || []
  const roleColor = ROLE_COLORS[role] || 'bg-blue-600'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className={`w-9 h-9 rounded-xl ${roleColor} flex items-center justify-center flex-shrink-0`}>
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base leading-none">ProctorNet</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{role} Portal</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to.endsWith('dashboard')}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? `${ROLE_ACCENT[role] || 'bg-blue-50 text-blue-600'} border-l-[3px] pl-3`
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent pl-3'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">ProctorNet v1.0 © 2025</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-500 hover:text-gray-700 p-1" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            {title && <h1 className="text-base font-semibold text-gray-800 hidden sm:block">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <ProfileDropdown />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
