import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, AlertTriangle,
  Megaphone, ClipboardList, BarChart2, Video, Settings, LogOut, UserCheck, Shield
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'

const NAV_ITEMS = {
  admin: [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/bulk-create', icon: UserCheck, label: 'Bulk Accounts' },
    { to: '/admin/enrollment-review', icon: Shield, label: 'Biometrics Review' },
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
    { to: '/student/device-check/demo', icon: Shield, label: 'Device Readiness' },
    { to: '/student/exams', icon: BookOpen, label: 'My Exams' },
    { to: '/student/results', icon: BarChart2, label: 'Results' },
  ],
  invigilator: [
    { to: '/invigilator/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/invigilator/live-grid/active', icon: Video, label: 'Live Exam Grid' },
  ],
}

export function AppSidebar({ variant = 'inset' }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const currentRole = role || 'student'
  const navItems = NAV_ITEMS[currentRole] || NAV_ITEMS.student
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <aside className="w-64 bg-[#09090B] flex flex-col justify-between h-screen sticky top-0 z-40 text-slate-100 font-sans">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#27272A]/50">
          <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs shrink-0">
            <ProctorNetLogo className="w-4 h-4 text-black" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs leading-none text-slate-100 tracking-tight">ProctorNet</p>
            <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{currentRole} Console</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2.5 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Navigation
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to.endsWith('dashboard')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#27272A] text-white font-semibold'
                    : 'text-slate-400 hover:bg-[#141416] hover:text-slate-200'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-[#27272A] bg-[#09090B]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#141416] border border-[#27272A]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7 border border-[#27272A]">
              <AvatarImage src={user?.profilePhoto} alt={user?.name} />
              <AvatarFallback className="font-mono text-[10px] bg-[#27272A] text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-none">
              <p className="text-xs font-semibold text-slate-100 truncate">{user?.name || 'Sudeep'}</p>
              <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{user?.email || 'student@mit.ac.in'}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="text-slate-400 hover:text-white p-1 transition-colors"
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
