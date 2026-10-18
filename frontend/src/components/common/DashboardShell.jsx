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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 tracking-tight text-base">ProctorNet</span>
            <span className="ml-2 text-xs text-slate-400 font-mono hidden sm:inline">v2.0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-medium border-blue-200 bg-blue-50 text-blue-700">
            {role}
          </Badge>
          <span className="text-xs text-slate-600 font-medium hidden md:inline">
            {user?.fullName || user?.email || 'User'}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-600 hover:text-red-600 gap-1.5 h-8">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-56 border-r border-slate-200 bg-white p-4 hidden md:flex flex-col gap-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 py-2">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </aside>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export { DashboardShell }
