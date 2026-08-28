import React, { useState, useRef, useEffect } from 'react'
import {
  Bell, CheckCircle2, ChevronDown, LogOut, Settings, User, ShieldCheck,
  UserCheck, GraduationCap, AlertTriangle, Clock, BookOpen, BellOff, ExternalLink
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '@/utils/api'

export function SiteHeader({ title = 'Console' }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const currentRole = role || 'admin'

  let initials = 'AD'
  if (user?.name) {
    const cleanName = user.name.trim()
    const parts = cleanName.split(/\s+/)
    if (parts[0].toLowerCase().includes('invigilator')) {
      initials = 'IV'
    } else if (parts[0].toLowerCase().includes('faculty') || parts[0].toLowerCase().includes('dr')) {
      initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : 'FC'
    } else {
      initials = parts.map(n => n[0]).join('').slice(0, 2).toUpperCase()
    }
  }
  if (!user?.name && currentRole === 'invigilator') initials = 'IV'
  if (initials === 'II') initials = 'IV'

  const [showNotifications, setShowNotifications] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [rawNotifications, setRawNotifications] = useState([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  // Local storage persistence for read notifications
  const storageKey = `proctornet_read_notifs_${user?.id || 'guest'}`
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch {
      return []
    }
  })

  const notifRef = useRef(null)
  const accountRef = useRef(null)

  // Fetch real notifications from backend
  const fetchNotifications = async () => {
    if (!user) return
    try {
      setLoadingNotifs(true)
      const res = await api.get('/notifications')
      setRawNotifications(res.data?.notifications || [])
    } catch (err) {
      console.warn('[SiteHeader] Could not fetch notifications:', err.message)
    } finally {
      setLoadingNotifs(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user?.id, currentRole])

  // Close dropdowns on outside click
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

  // Calculate unread count
  const unreadCount = rawNotifications.filter(n => !readIds.includes(n.id)).length

  // Mark all notifications as read
  const markAllRead = () => {
    const allIds = rawNotifications.map(n => n.id)
    const updated = Array.from(new Set([...readIds, ...allIds]))
    setReadIds(updated)
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated))
    } catch {}
  }

  // Click individual notification
  const handleNotificationClick = (n) => {
    if (!readIds.includes(n.id)) {
      const updated = [...readIds, n.id]
      setReadIds(updated)
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch {}
    }
    setShowNotifications(false)
    if (n.link) {
      navigate(n.link)
    }
  }

  // Relative time helper
  const formatTime = (timeStr) => {
    if (!timeStr) return 'Recently'
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return 'Recently'
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 172800) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Icon by notification type
  const renderIcon = (type) => {
    switch (type) {
      case 'STUDENT_APPROVAL':
        return (
          <div className="w-7 h-7 rounded-xl bg-[#fffbeb] text-[#d97706] border border-[#fef3c7] flex items-center justify-center shrink-0">
            <UserCheck size={14} />
          </div>
        )
      case 'FACULTY_APPROVAL':
        return (
          <div className="w-7 h-7 rounded-xl bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] flex items-center justify-center shrink-0">
            <GraduationCap size={14} />
          </div>
        )
      case 'VIOLATION':
      case 'REJECTED':
        return (
          <div className="w-7 h-7 rounded-xl bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6] flex items-center justify-center shrink-0">
            <AlertTriangle size={14} />
          </div>
        )
      case 'EXAM_LIVE':
        return (
          <div className="w-7 h-7 rounded-xl bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7] flex items-center justify-center shrink-0">
            <Clock size={14} className="animate-pulse" />
          </div>
        )
      case 'EXAM_UPCOMING':
        return (
          <div className="w-7 h-7 rounded-xl bg-[#eef2ff] text-[#4f46e5] border border-[#e0e7ff] flex items-center justify-center shrink-0">
            <BookOpen size={14} />
          </div>
        )
      case 'APPROVAL':
      case 'SUBMISSION':
      case 'RESULT':
      default:
        return (
          <div className="w-7 h-7 rounded-xl bg-[#ecfdf5] text-[#10b981] border border-[#d1fae5] flex items-center justify-center shrink-0">
            <CheckCircle2 size={14} />
          </div>
        )
    }
  }

  // Footer target by role
  const getFooterAction = () => {
    if (currentRole === 'admin') {
      return { label: 'Review Pending Applications →', path: '/admin/students' }
    }
    if (currentRole === 'faculty') {
      return { label: 'View All Examinations →', path: '/faculty/exams' }
    }
    return { label: 'View Assigned Tests →', path: '/student/exams' }
  }

  const footerAction = getFooterAction()

  return (
    <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 md:px-8 bg-white/95 backdrop-blur sticky top-0 z-20 font-sans">
      {/* Title / Breadcrumb context */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900 capitalize">{currentRole} Workspace</h2>
      </div>

      {/* Right Controls: Real Notifications & Functional User Dropdown */}
      <div className="flex items-center gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) fetchNotifications()
            }}
            className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ring-2 ring-white animate-in zoom-in">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 font-sans animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">Live Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2f80ed] text-[11px] font-semibold border border-blue-200">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-semibold text-[#2f80ed] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-2.5 my-3 max-h-80 overflow-y-auto pr-1">
                {rawNotifications.length > 0 ? (
                  rawNotifications.map((n) => {
                    const isRead = readIds.includes(n.id)
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl flex items-start gap-3 transition-all cursor-pointer ${
                          isRead 
                            ? 'bg-white border border-slate-100 opacity-75 hover:opacity-100' 
                            : 'bg-slate-50 border border-slate-200 border-l-4 border-l-[#2f80ed] shadow-xs'
                        }`}
                      >
                        {renderIcon(n.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {n.title}
                            </p>
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#2f80ed] shrink-0" />
                            )}
                          </div>
                          <p className="text-xs font-normal text-slate-600 leading-snug mt-1 line-clamp-2">
                            {n.desc}
                          </p>
                          <span className="text-[11px] font-normal text-slate-400 mt-1.5 block">
                            {formatTime(n.time)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 border border-slate-200">
                      <BellOff size={18} />
                    </div>
                    <p className="text-xs font-semibold text-slate-900">No Pending Notifications</p>
                    <p className="text-xs font-normal text-slate-500 mt-0.5">
                      You're all caught up! New approvals and assessment events will appear here.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false)
                    navigate(footerAction.path)
                  }}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-[#2f80ed] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{footerAction.label}</span>
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
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-[#f8fafc] hover:bg-white border border-slate-200 shadow-xs transition-all cursor-pointer"
            aria-label="User menu"
          >
            {user?.facePhotoUrl ? (
              <img
                src={user.facePhotoUrl}
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-50 text-[#2f80ed] font-bold text-xs flex items-center justify-center border border-blue-200">
                {initials}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-900">
              {user?.name || (currentRole === 'admin' ? 'Administrator' : 'User')}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showAccountMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 font-sans animate-in fade-in zoom-in-95 duration-100">
              {/* Header Profile Box */}
              <div className="p-3 bg-gradient-to-br from-blue-50/80 to-slate-50 rounded-xl border border-blue-100 mb-2 space-y-2">
                <div className="flex items-center gap-3">
                  {user?.facePhotoUrl ? (
                    <img
                      src={user.facePhotoUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white text-[#2f80ed] font-bold text-sm flex items-center justify-center border border-blue-200 shadow-xs shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Authorized Account'}</p>
                    <p className="text-xs font-normal text-slate-500 truncate mt-0.5">{user?.email || 'user@proctornet.com'}</p>
                  </div>
                </div>

                <div className="pt-1 flex justify-start">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#2f80ed] text-white text-[11px] font-semibold tracking-wider uppercase shadow-xs">
                    {currentRole}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-1">
                {currentRole === 'admin' && (
                  <button
                    onClick={() => { setShowAccountMenu(false); navigate('/admin/settings') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:text-[#2f80ed] hover:bg-blue-50 transition-all cursor-pointer text-left"
                  >
                    <Settings size={16} className="text-[#2f80ed]" />
                    <span>System Settings</span>
                  </button>
                )}
                {currentRole === 'student' && (
                  <button
                    onClick={() => { setShowAccountMenu(false); navigate('/student/profile') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:text-[#2f80ed] hover:bg-blue-50 transition-all cursor-pointer text-left"
                  >
                    <User size={16} className="text-[#2f80ed]" />
                    <span>Candidate Profile</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowAccountMenu(false); navigate('/change-password') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:text-[#2f80ed] hover:bg-blue-50 transition-all cursor-pointer text-left"
                >
                  <ShieldCheck size={16} className="text-[#2f80ed]" />
                  <span>Change Password</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 mt-2">
                <button
                  onClick={() => { setShowAccountMenu(false); logout() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer text-left"
                >
                  <LogOut size={16} className="text-rose-500" />
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
