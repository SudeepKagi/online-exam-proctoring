import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'

const features = [
  {
    icon: '🛡️',
    title: 'Network-Level Security',
    desc: 'WireGuard VPN locks students to the exam network. iptables + Unbound DNS block all external access during exams.',
  },
  {
    icon: '🎭',
    title: 'AI Face Verification',
    desc: 'face_recognition library matches live camera to registered photo. Periodic reverification every 10 minutes.',
  },
  {
    icon: '🔏',
    title: 'Invisible Watermarking',
    desc: 'LSB steganography embeds student USN in every screenshot. Zero-width characters encode identity in question text.',
  },
  {
    icon: '📡',
    title: 'Real-Time Monitoring',
    desc: 'Socket.io streams live flag alerts to the invigilator. Camera thumbnails, event timeline, and private chat.',
  },
  {
    icon: '🧠',
    title: 'Collusion Detection',
    desc: 'Post-exam analysis compares all student answer pairs. Flags pairs with >85% similarity on common questions.',
  },
  {
    icon: '📋',
    title: 'Forensic Reports',
    desc: 'PDF evidence reports with identity photos, flag screenshots, event timelines, and decoded watermarks.',
  },
]

const roles = [
  {
    role: 'Admin',
    icon: '⚙️',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.15)',
    border: 'rgba(167,139,250,0.3)',
    desc: 'Platform control — approves faculty & students, manages settings, views analytics and audit logs.',
    path: '/admin/login',
    label: 'Admin Login',
  },
  {
    role: 'Faculty',
    icon: '🎓',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.15)',
    border: 'rgba(96,165,250,0.3)',
    desc: 'Creates exams, manages question pools, monitors results, runs collusion checks, downloads reports.',
    path: '/faculty/login',
    label: 'Faculty Login',
  },
  {
    role: 'Student',
    icon: '📝',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.15)',
    border: 'rgba(52,211,153,0.3)',
    desc: 'Registers with face + ID, takes fully locked-down exams with 9-step pre-exam security checks.',
    path: '/student/login',
    label: 'Student Login',
  },
  {
    role: 'Invigilator',
    icon: '👁️',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.15)',
    border: 'rgba(251,146,60,0.3)',
    desc: 'Physical invigilator in the lab. Temporary credential-based access per exam session.',
    path: '/invigilator-login',
    label: 'Invigilator Login',
  },
]

const steps = [
  { n: '01', title: 'Register', desc: 'Submit face photo + ID card. AI verifies identity match.' },
  { n: '02', title: '9 Security Checks', desc: 'VPN, browser, fullscreen, camera, face, ID, VM detection, watermark.' },
  { n: '03', title: 'Monitored Exam', desc: 'Randomised questions, live camera, anti-cheat enforcement.' },
  { n: '04', title: 'Forensic Results', desc: 'Auto-scoring, collusion check, PDF evidence report.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      const dash = {
        admin: '/admin/dashboard',
        faculty: '/faculty/dashboard',
        student: '/student/dashboard',
        invigilator: '/invigilator-login',
      }
      navigate(dash[user.role] || '/')
    }
  }, [isAuthenticated, user, navigate])

  return (
    <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,14,26,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 2rem',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>🔒</div>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
            Proctor<span style={{ color: '#60a5fa' }}>Net</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem' }}
            onClick={() => navigate('/faculty/register')}>
            Register Faculty
          </button>
          <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem' }}
            onClick={() => navigate('/student/register')}>
            Student Register
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '5rem 2rem 4rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow blobs */}
        <div style={{
          position: 'absolute', top: '-100px', left: '50%',
          transform: 'translateX(-50%)',
          width: '600px', height: '400px',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50px', left: '10%',
          width: '300px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.375rem 0.875rem',
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '9999px',
          fontSize: '0.8125rem',
          color: '#93c5fd',
          marginBottom: '1.5rem',
          fontWeight: 600,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', animation: 'blink 1.5s infinite', display: 'inline-block' }} />
          College Lab Proctoring & Network Isolation System
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          marginBottom: '1.25rem',
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Secure Online Exams,</span>
          <br />
          <span className="text-gradient">Forensic-Grade Integrity</span>
        </h1>

        <p style={{
          fontSize: '1.125rem',
          color: 'var(--color-text-secondary)',
          maxWidth: '600px',
          margin: '0 auto 2.5rem',
          lineHeight: 1.7,
        }}>
          ProctorNet combines AI face verification, WireGuard VPN, invisible watermarking,
          and real-time anti-cheat monitoring — purpose-built for college lab environments.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary animate-pulse-glow" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            onClick={() => navigate('/student/register')}>
            Get Started as Student
          </button>
          <button className="btn-secondary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            onClick={() => navigate('/admin/login')}>
            Admin Portal →
          </button>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '3rem',
          marginTop: '3.5rem', flexWrap: 'wrap',
        }}>
          {[
            ['9', 'Security Checks'],
            ['4', 'User Roles'],
            ['AI', 'Face + OCR'],
            ['VPN', 'Network Lock'],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa' }}>{val}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '4rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 800, marginBottom: '2.5rem', letterSpacing: '-0.02em' }}>
          How It Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {steps.map((s, i) => (
            <div key={i} className="glass-card animate-fade-in" style={{
              padding: '1.5rem',
              animationDelay: `${i * 0.1}s`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
              }} />
              <div style={{
                fontSize: '2.5rem', fontWeight: 900, color: 'rgba(59,130,246,0.15)',
                letterSpacing: '-0.04em', marginBottom: '0.5rem', lineHeight: 1,
              }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '3rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Enterprise-Grade Security Features
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '2.5rem', fontSize: '0.9375rem' }}>
          Built for college labs — not home proctoring.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {features.map((f, i) => (
            <div key={i} className="stats-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                fontSize: '1.75rem', width: '48px', height: '48px',
                background: 'var(--color-bg-elevated)',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.375rem' }}>{f.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROLE PORTALS ── */}
      <section style={{ padding: '3rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 800, marginBottom: '2.5rem', letterSpacing: '-0.02em' }}>
          Access Your Portal
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {roles.map((r) => (
            <div key={r.role} style={{
              background: 'var(--color-bg-card)',
              border: `1px solid ${r.border}`,
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 0 0 0 ${r.glow}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 30px ${r.glow}`; e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; e.currentTarget.style.transform = 'translateY(0)' }}
              onClick={() => navigate(r.path)}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: r.color, marginBottom: '0.5rem' }}>{r.role}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>{r.desc}</div>
              <button style={{
                width: '100%', padding: '0.5rem',
                background: `${r.glow}`,
                border: `1px solid ${r.border}`,
                borderRadius: 'var(--radius-md)',
                color: r.color,
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>{r.label} →</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.8125rem',
        marginTop: '2rem',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>ProctorNet</span>
        {' '} — Secure Exam Proctoring System · Built with React, Node.js, Python Flask, WireGuard
        <br />
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Enterprise-Grade Lab Security · 2026</span>
      </footer>
    </div>
  )
}
