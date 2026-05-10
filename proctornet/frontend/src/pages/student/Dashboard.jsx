import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { Alert } from '@/components/common/FormComponents'
import api from '@/services/api'

function Icon({ name, style, size = 20 }) {
  return <span className="material-icon" style={{ fontSize: size, ...style }}>{name}</span>
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [examRes, resultsRes] = await Promise.all([
        api.get('/student/exams?status=upcoming'),
        api.get('/student/results')
      ])
      setExams(examRes.data.exams.slice(0, 3))
      setResults(resultsRes.data.results.slice(0, 5))
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setLoading(false)
    }
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome Back</h1>
          <p className="page-subtitle">View your upcoming exams and recent performance.</p>
        </div>
      </div>

      <Alert type="info" message="Ensure your VPN client is active before joining any exam session." />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Live & Upcoming Exams</h3>
              <Link to="/student/exams" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>View All</Link>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="spinner"></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {exams.length === 0 ? (
                    <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: '2rem' }}>No exams scheduled for your batch.</p>
                  ) : (
                    exams.map(e => (
                      <div key={e.id} style={{ 
                        padding: '1.25rem', 
                        border: e.isLive ? '1px solid var(--primary)' : '1px solid var(--outline-variant)', 
                        borderRadius: '12px', 
                        background: e.isLive ? 'var(--primary-fixed)' : 'var(--surface-container-low)',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              {e.isLive && <span className="live-dot" />}
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: e.isLive ? 'var(--primary)' : 'var(--on-surface-variant)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {e.isLive ? 'Live Now' : 'Upcoming'}
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>
                              {e.title}
                            </h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                              {e.faculty.name} • {e.isLive ? 'Ends at ' : 'Starts '}{new Date(e.isLive ? e.endTime : e.startTime).toLocaleTimeString()}
                            </p>
                          </div>
                          {e.isLive && (
                            <Link to={`/student/exam-lobby/${e.id}`} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                              Join Lobby
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Results</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Date</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.exam.title}</td>
                      <td style={{ color: 'var(--on-surface-variant)' }}>{new Date(r.gradedAt).toLocaleDateString()}</td>
                      <td><span className={`badge ${r.percentage > 40 ? 'badge-success' : 'badge-danger'}`}>{r.totalScore} / {r.exam.totalMarks}</span></td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No results available yet.</td></tr>
                  )}
                </tbody>
              </table>
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
