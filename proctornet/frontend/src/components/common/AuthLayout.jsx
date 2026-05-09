/**
 * AuthLayout — Shared wrapper for all login/register pages.
 * Dark glassmorphism card, centered on page with brand logo.
 */
export default function AuthLayout({ title, subtitle, icon = '🔒', children, maxWidth = '420px' }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth, position: 'relative' }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
            borderRadius: '14px',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem',
            marginBottom: '0.875rem',
            boxShadow: '0 0 30px rgba(59,130,246,0.3)',
          }}>{icon}</div>
          <div style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            Proctor<span style={{ color: '#60a5fa' }}>Net</span>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Secure Exam Proctoring
          </div>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
