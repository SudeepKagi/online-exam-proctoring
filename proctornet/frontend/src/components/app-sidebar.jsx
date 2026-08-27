import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, AlertTriangle,
  Megaphone, ClipboardList, BarChart2, Video, Settings, LogOut, UserCheck, Shield,
  HelpCircle
} from 'lucide-react'

// Categorized navigation without sub-items - clean and normal
const ROLE_NAV_GROUPS = {
  admin: [
    {
      section: 'ANALYTICS',
      items: [
        { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
        { to: '/admin/reports', icon: BarChart2, label: 'Reports' },
      ]
    },
    {
      section: 'ACCOUNT CREATION',
      items: [
        { to: '/admin/create-student', icon: GraduationCap, label: 'Student Accounts' },
        { to: '/admin/create-faculty', icon: Users, label: 'Faculty Accounts' },
      ]
    },
    {
      section: 'MANAGEMENT',
      items: [
        { to: '/admin/faculty', icon: Users, label: 'Faculty Roster' },
        { to: '/admin/students', icon: GraduationCap, label: 'Student Directory' },
        { to: '/admin/exams', icon: BookOpen, label: 'Exams' },
        { to: '/admin/violations', icon: AlertTriangle, label: 'Violations' },
        { to: '/admin/invigilators', icon: Video, label: 'Invigilators' },
        { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
      ]
    },
    {
      section: 'CUSTOMIZATION',
      items: [
        { to: '/admin/enrollment-review', icon: Shield, label: 'Biometrics Review' },
        { to: '/admin/settings', icon: Settings, label: 'Settings' },
      ]
    }
  ],
  faculty: [
    {
      section: 'ANALYTICS',
      items: [
        { to: '/faculty/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/faculty/results', icon: BarChart2, label: 'Results & Scoring' },
      ]
    },
    {
      section: 'MANAGEMENT',
      items: [
        { to: '/faculty/exams', icon: BookOpen, label: 'My Exams' },
        { to: '/faculty/students', icon: GraduationCap, label: 'Students' },
      ]
    },
    {
      section: 'CUSTOMIZATION',
      items: [
        { to: '/faculty/question-pool', icon: BookOpen, label: 'Question Pool' },
        { to: '/faculty/settings', icon: Settings, label: 'Settings' },
      ]
    }
  ],
  student: [
    {
      section: 'ANALYTICS',
      items: [
        { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/student/results', icon: BarChart2, label: 'Results & Transcripts' },
      ]
    },
    {
      section: 'MANAGEMENT',
      items: [
        { to: '/student/exams', icon: BookOpen, label: 'My Exams' },
        { to: '/student/profile', icon: UserCheck, label: 'My Profile' },
      ]
    },
    {
      section: 'CUSTOMIZATION',
      items: [
        { to: '/student/device-check/demo', icon: Shield, label: 'Device Check' },
        { to: '/student/support', icon: HelpCircle, label: 'Support & Rules' },
      ]
    }
  ],
  invigilator: [
    {
      section: 'ANALYTICS',
      items: [
        { to: '/invigilator/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/invigilator/live-grid/active', icon: Video, label: 'Live Exam Grid' },
      ]
    },
    {
      section: 'MANAGEMENT',
      items: [
        { to: '/invigilator/violations', icon: AlertTriangle, label: 'Violation Alerts' },
      ]
    },
    {
      section: 'CUSTOMIZATION',
      items: [
        { to: '/invigilator/settings', icon: Settings, label: 'Audio & Camera Config' },
      ]
    }
  ]
}

export function AppSidebar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const currentRole = role || 'student'
  const navGroups = ROLE_NAV_GROUPS[currentRole] || ROLE_NAV_GROUPS.student
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AD'

  return (
    <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen font-sans z-30">
      <div className="overflow-y-auto flex-1">
        {/* Real Brand Header - Uses official /logo.png, no AI badge */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#f1f5f9]">
          <img
            src="/logo.png"
            alt="ProctorNet Logo"
            className="w-8 h-8 rounded-xl object-contain shrink-0 shadow-xs"
          />
          <div className="min-w-0">
            <span className="font-bold text-base text-[#0f172a] tracking-tight block">ProctorNet</span>
            <p className="text-[11px] font-medium text-[#64748b] capitalize leading-none mt-0.5">
              {currentRole} Console
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-4 py-4 space-y-6">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <p className="text-[10px] font-bold text-[#94a3b8] tracking-wider px-3 mb-1.5 uppercase">
                {group.section}
              </p>

              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to.endsWith('dashboard')}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-[#2f80ed] text-white font-semibold shadow-xs'
                        : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] font-medium'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer User Profile & Sign Out */}
      <div className="p-4 border-t border-[#f1f5f9]">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.facePhotoUrl ? (
              <img
                src={user.facePhotoUrl}
                alt={user?.name || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-[#e2e8f0] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#eff6ff] text-[#2563eb] font-bold text-xs flex items-center justify-center shrink-0 border border-[#dbeafe]">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0f172a] truncate">{user?.name || 'System Administrator'}</p>
              <p className="text-[10px] text-[#94a3b8] truncate">{user?.email || 'admin@proctornet.com'}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="text-[#94a3b8] hover:text-[#ef4444] p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
export default AppSidebar
