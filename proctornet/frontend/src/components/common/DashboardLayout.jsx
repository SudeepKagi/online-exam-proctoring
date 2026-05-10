/**
 * DashboardLayout — Shared sidebar + topbar shell for all dashboard roles.
 * Matches the Stitch SaaS reference design: white sidebar, blue active indicator,
 * clean topbar with search, notifications, and avatar.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/* ── Icon helper (Material Symbols via ligature) ── */
function Icon({ name, size = 20, style = {} }) {
  return (
    <span
      style={{
        fontFamily: "'Material Symbols Outlined'",
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        fontSize: size,
        lineHeight: 1,
        userSelect: 'none',
        display: 'inline-block',
        ...style,
      }}
    >
      {name}
    </span>
  )
}

/* ── Sidebar ── */
function Sidebar({ navItems, supportLabel = 'Support Center' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <nav className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Icon name="verified_user" size={20} />
        </div>
        <div>
          <div className="sidebar-brand-name">ProctorNet</div>
          <div className="sidebar-brand-sub">Academic Integrity</div>
        </div>
      </div>

      {/* Nav items */}
      <div className="sidebar-nav">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to.endsWith('dashboard')}
            className={({ isActive }) =>
              'sidebar-nav-item' + (isActive ? ' active' : '')
            }
          >
            <Icon name={icon} size={20} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className="btn-secondary"
          style={{ width: '100%', fontSize: '0.8125rem', gap: '0.5rem' }}
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          <Icon name="help_center" size={18} />
          {supportLabel}
        </button>
      </div>
    </nav>
  )
}

/* ── Topbar ── */
function Topbar({ topNavLinks = [], searchPlaceholder = 'Search...' }) {
  const { user } = useAuth()

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase()

  return (
    <header className="app-topbar">
      {/* Left: search */}
      <div className="topbar-search">
        <Icon name="search" size={18} style={{ color: 'var(--outline)' }} />
        <input placeholder={searchPlaceholder} />
      </div>

      {/* Center: nav links */}
      {topNavLinks.length > 0 && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem', height: '100%' }}>
          {topNavLinks.map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="topbar-icon-btn" title="Notifications" style={{ position: 'relative' }}>
          <Icon name="notifications" size={20} />
          <span style={{
            position: 'absolute',
            top: 6, right: 6,
            width: 8, height: 8,
            background: 'var(--error)',
            borderRadius: '50%',
          }} />
        </button>
        <button className="topbar-icon-btn" title="Help">
          <Icon name="help_outline" size={20} />
        </button>
        <div className="topbar-avatar" title={user?.name ?? 'User'}>
          {initials}
        </div>
      </div>
    </header>
  )
}

/* ── Main export ── */
export default function DashboardLayout({
  children,
  navItems = [],
  topNavLinks = [],
  searchPlaceholder = 'Search exams, students...',
}) {
  return (
    <>
      <Sidebar navItems={navItems} />
      <Topbar topNavLinks={topNavLinks} searchPlaceholder={searchPlaceholder} />
      <main className="app-main">
        <div className="app-content animate-fade-in">
          {children}
        </div>
      </main>
    </>
  )
}
