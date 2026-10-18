import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, LayoutDashboard, Users, BookOpen, MonitorPlay, LogOut, Settings } from 'lucide-react'

export default function DashboardShell({ children, title = 'Dashboard' }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const role = user?.role || 'STUDENT'

  const navItems = []
  if (role === 'ADMIN') {
    navItems.push(
      { label: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Users & Approvals', path: '/admin/users', icon: Users },
      { label: 'Exams', path: '/admin/exams', icon: BookOpen }
    )
  } else if (role === 'FACULTY') {
    navItems.push(
      { label: 'My Exams', path: '/faculty/exams', icon: BookOpen },
      { label: 'Account Settings', path: '/settings', icon: Settings }
    )
  } else if (role === 'INVIGILATOR') {
    navItems.push({ label: 'Live Console', path: '/invigilator/console', icon: MonitorPlay })
  } else {
    navItems.push(
      { label: 'My Exams', path: '/student/dashboard', icon: BookOpen },
      { label: 'Profile & Settings', path: '/settings', icon: Settings }
    )
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] flex flex-col font-sans">
      {/* Mercury Night Nav Bar: 72px, #171721 with #ededf3 on-dark text */}
      <header className="h-[72px] border-b border-[#28253b] bg-[#171721] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-bold shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-[480] text-[#ededf3] tracking-wide text-base">ProctorNet</span>
            <span className="ml-2 text-xs text-[#c3c3cc] font-mono hidden sm:inline">v2.0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-[420] border-[#9cb4e8]/30 bg-[#9cb4e8]/10 text-[#ededf3] rounded-full px-3 py-0.5">
            {role}
          </Badge>
          <span className="text-xs text-[#c3c3cc] font-[420] hidden md:inline">
            {user?.fullName || user?.email || 'User'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-[#c3c3cc] hover:text-white hover:bg-white/10 gap-1.5 h-8 rounded-full cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Mercury App Shell Sidebar */}
        <aside className="w-60 border-r border-[#e9eaf2] bg-[#fbfcfd] p-4 hidden md:flex flex-col gap-1.5">
          <div className="text-[12px] font-[500] uppercase tracking-wider text-[#554e7b] px-3 py-2">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-[420] transition-colors ${
                  active
                    ? 'bg-[#5266eb] text-white shadow-xs'
                    : 'text-[#28253b] hover:bg-[#edecfb] hover:text-[#5266eb]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </aside>

        {/* Mercury Light-World Main Canvas */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#fbfcfd]">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9eaf2]">
              <h1 className="text-2xl font-[480] tracking-tight text-[#28253b]">{title}</h1>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* Mercury Night World Footer */}
      <footer className="bg-[#171721] text-[#c3c3cc] border-t border-[#28253b] px-6 sm:px-8 py-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-[#ededf3] font-[480]">ProctorNet Academic Integrity</span>
        <span className="text-[11px] text-[#c3c3cc]">Institutional Proctoring Platform • Protected by TLS 1.3 & AWS Rekognition</span>
      </footer>
    </div>
  )
}

export { DashboardShell }
