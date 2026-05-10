import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { Alert } from '@/components/common/FormComponents'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Placeholder loading simulation
    setTimeout(() => {
      setLoading(false)
    }, 800)
  }, [])

  return (
    <DashboardLayout navItems={navItems}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome Back</h1>
          <p className="page-subtitle">View your upcoming exams and recent performance.</p>
        </div>
      </div>

      <Alert type="info" message="Ensure your VPN client is active before joining any exam session." />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Main Content: Upcoming & Active Exams */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Live & Upcoming Exams</h3>
              <Link to="/student/exams" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>View Calendar</Link>
            </div>
            <div className="card-body">
              {loading ? (
                <p style={{ color: 'var(--on-surface-variant)' }}>Loading exams...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Live Exam Card */}
                  <div style={{ 
                    padding: '1.25rem', 
                    border: '1px solid var(--primary)', 
                    borderRadius: '12px', 
                    background: 'var(--primary-fixed)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span className="live-dot" />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Live Now
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--on-primary-fixed)', marginBottom: '0.25rem' }}>
                          Data Structures Midterm
                        </h4>
                        <p style={{ fontSize: '0.875rem', color: 'var(--on-primary-fixed-variant)' }}>
                          Prof. Alan Turing • Closes in 45 mins
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                      <Link to="/student/exam-lobby" className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                        Join Security Lobby
                      </Link>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--on-primary-fixed-variant)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Icon name="vpn_lock" size={16} /> VPN Required
                      </span>
                    </div>
                  </div>

                  {/* Upcoming Exam Card */}
                  <div style={{ 
                    padding: '1.25rem', 
                    border: '1px solid var(--outline-variant)', 
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>
                        Algorithms Final
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                        Tomorrow, 10:00 AM • 120 mins
                      </p>
                    </div>
                    <button className="btn-secondary" disabled>
                      Not Started
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Results</h3>
            </div>
            <div className="card-body">
              {loading ? (
                <p style={{ color: 'var(--on-surface-variant)' }}>Loading results...</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Date</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 500 }}>Operating Systems Quiz</td>
                      <td style={{ color: 'var(--on-surface-variant)' }}>Oct 12, 2025</td>
                      <td><span className="badge badge-success">85 / 100</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 500 }}>Computer Networks Midterm</td>
                      <td style={{ color: 'var(--on-surface-variant)' }}>Oct 05, 2025</td>
                      <td><span className="badge badge-primary">92 / 100</span></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Sidebar widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">System Status</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="vpn_key" size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>VPN Configuration</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Keys provisioned</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="face" size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>Biometric Profile</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Verified by Admin</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Support</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '1rem', lineHeight: 1.6 }}>
                Having trouble with your VPN connection or camera setup?
              </p>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <Icon name="help_center" /> Contact Helpdesk
              </button>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  )
}
