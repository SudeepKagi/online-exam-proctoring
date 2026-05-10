/**
 * AuthLayout — Split-panel login layout matching the Stitch reference.
 * Left: deep blue gradient with brand info + feature list
 * Right: white panel with form card
 */

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

const FEATURES = [
  {
    icon: 'smart_toy',
    title: 'AI-Powered Verification',
    desc: 'Continuous identity confirmation utilizing multimodal biometrics.',
  },
  {
    icon: 'videocam',
    title: 'Real-Time Monitoring Feed',
    desc: 'Low-latency video and screen capture streams with automated flagging.',
  },
  {
    icon: 'lock',
    title: 'Secure Browser Lock',
    desc: 'Prevents unauthorized application access and systemic navigation.',
  },
]

export default function AuthLayout({ title, subtitle, children, maxWidth = '420px' }) {
  return (
    <div className="auth-layout">
      {/* ── Left panel ── */}
      <div className="auth-left">
        {/* Abstract blobs */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%',
          width: '50%', height: '50%',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '60%', height: '60%',
          background: 'rgba(37,99,235,0.2)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{
              width: 40, height: 40,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <Icon name="verified_user" size={22} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              ProctorNet
            </span>
          </div>

          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '1rem', maxWidth: 400 }}>
            Secure Exam Proctoring
          </h2>

          <p style={{ color: 'rgba(180,197,255,0.85)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '3rem', maxWidth: 380 }}>
            Ensuring academic integrity through advanced monitoring and real-time behavioral analysis
            for high-stakes digital environments.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {FEATURES.map(f => (
              <li key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  marginTop: 2,
                  width: 28, height: 28,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="check" size={16} style={{ color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>{f.title}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'rgba(180,197,255,0.8)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8125rem', color: 'rgba(180,197,255,0.7)' }}>
          <span>© 2025 ProctorNet Inc.</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(180,197,255,0.5)' }} />
          <a href="#" style={{ color: 'inherit' }}>Privacy Policy</a>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(180,197,255,0.5)' }} />
          <a href="#" style={{ color: 'inherit' }}>Support</a>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div style={{ width: '100%', maxWidth }}>
          {/* Mobile logo */}
          <div style={{ display: 'none' }}>
            <Icon name="verified_user" size={28} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 800 }}>ProctorNet</span>
          </div>

          <div className="auth-card">
            {/* Title */}
            {(title || subtitle) && (
              <div style={{ marginBottom: '1.5rem' }}>
                {title && (
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.375rem' }}>
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
