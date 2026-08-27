import React, { useState, useRef, useEffect } from 'react'
import { Bell, CheckCircle2, ChevronDown, LogOut, Settings, User, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'

export function SiteHeader({ title = 'Console' }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const currentRole = role || 'admin'
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AD'

  const [showNotifications, setShowNotifications] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Database Reset Complete', desc: 'All previous records truncated. Fresh admin account active.', time: 'Just now', read: false },
    { id: 2, title: 'ProctorNet Engine Online', desc: 'Face verification and kiosk monitoring microservices are healthy.', time: '10m ago', read: false },
  ])

  const notifRef = useRef(null)
  const accountRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setShowAccountMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <header className="h-16 border-b border-[#e2e8f0] flex items-center justify-between px-6 md:px-8 bg-white/95 backdrop-blur sticky top-0 z-20 font-sans">
      {/* Title / Breadcrumb context */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-[#0f172a] capitalize">{currentRole} Workspace</h2>
      </div>

      {/* Right Controls: Notifications & Functional User Dropdown */}
      <div className="flex items-center gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#e2e8f0]"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ef4444] rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#e2e8f0] rounded-2xl shadow-xl z-50 p-4 font-sans animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                <span className="text-xs font-bold text-[#0f172a]">System Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-semibold text-[#2563eb] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#f8fafc] my-2 max-h-60 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} className="py-2.5 px-1 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0f172a]">{n.title}</p>
                        <p className="text-[11px] text-[#64748b] leading-tight mt-0.5">{n.desc}</p>
                        <span className="text-[9px] text-[#94a3b8] mt-1 block">{n.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-[#94a3b8]">No notifications</p>
                )}
              </div>

              <div className="pt-2 border-t border-[#f1f5f9] text-center">
                <button
                  onClick={() => { setShowNotifications(false); navigate('/admin/audit-logs') }}
                  className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] cursor-pointer"
                >
                  View Full Audit Log →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-[1px] bg-[#e2e8f0]" />

        {/* User Account Pill & Functional Dropdown */}
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full hover:bg-[#f8fafc] border border-transparent hover:border-[#e2e8f0] transition-all cursor-pointer"
            aria-label="User menu"
          >
            {user?.facePhotoUrl ? (
              <img
                src={user.facePhotoUrl}
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover border border-[#e2e8f0]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#2563eb] font-bold text-xs flex items-center justify-center border border-[#dbeafe]">
                {initials}
              </div>
            )}
            <span className="text-xs font-semibold text-[#0f172a]">
              {user?.name || 'Administrator'}
            </span>
            <ChevronDown size={13} className="text-[#94a3b8]" />
          </button>

          {showAccountMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#e2e8f0] rounded-2xl shadow-xl z-50 p-2 font-sans animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2.5 border-b border-[#f1f5f9] mb-1">
                <p className="text-xs font-bold text-[#0f172a] truncate">{user?.name || 'System Administrator'}</p>
                <p className="text-[11px] text-[#64748b] truncate mt-0.5">{user?.email || 'admin@proctornet.com'}</p>
                <span className="inline-block px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#2563eb] text-[9px] font-bold mt-1.5 uppercase tracking-wider">
                  {currentRole}
                </span>
              </div>

              <div className="space-y-0.5 text-xs">
                <button
                  onClick={() => { setShowAccountMenu(false); navigate('/admin/settings') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Settings size={14} className="text-[#94a3b8]" />
                  <span>Platform Settings</span>
                </button>
                <button
                  onClick={() => { setShowAccountMenu(false); navigate('/admin/audit-logs') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-xl transition-colors cursor-pointer text-left"
                >
                  <ShieldCheck size={14} className="text-[#94a3b8]" />
                  <span>Security Audit Logs</span>
                </button>
              </div>

              <div className="pt-1 border-t border-[#f1f5f9] mt-1">
                <button
                  onClick={() => { setShowAccountMenu(false); logout(); navigate('/') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[#dc2626] hover:bg-[#fef2f2] rounded-xl transition-colors cursor-pointer text-left text-xs font-semibold"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
export default SiteHeader
