import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function StudentExams() {
  const [activeTab, setActiveTab] = useState('upcoming')
  
  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Exams</h1>
          <p className="page-subtitle">View your exam schedule and join active sessions.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'upcoming' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'upcoming' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming & Live
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'past' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'past' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('past')}
          >
            Past Exams
          </button>
        </div>
        
        <div className="card-body">
          {activeTab === 'upcoming' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Live Exam Card */}
              <div style={{ padding: '1.5rem', border: '1px solid var(--primary)', borderRadius: '12px', background: 'var(--primary-fixed)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="live-dot" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Now</span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-primary-fixed)', marginBottom: '0.5rem' }}>Data Structures Midterm</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-primary-fixed-variant)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> 60 Minutes</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="person" size={16} /> Prof. Alan Turing</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--on-primary-fixed-variant)', marginBottom: '1rem' }}>Closes in 45 mins</div>
                    <Link to="/student/exam-lobby" className="btn-primary">
                      Join Lobby <Icon name="arrow_forward" size={16} style={{ marginLeft: '0.5rem' }} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Upcoming Exam Card */}
              <div style={{ padding: '1.5rem', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-neutral">Tomorrow</span>
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>Algorithms Final</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="event" size={16} /> Oct 15, 10:00 AM</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> 120 Minutes</span>
                    </div>
                  </div>
                  <button className="btn-secondary" disabled>
                    Opens in 14h
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'past' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Date Completed</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500 }}>Operating Systems Quiz</td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>Oct 12, 2025</td>
                  <td><span className="badge badge-success">Evaluated</span></td>
                  <td>
                    <Link to="/student/results" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>View Result</Link>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>Computer Networks Midterm</td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>Oct 05, 2025</td>
                  <td><span className="badge badge-success">Evaluated</span></td>
                  <td>
                    <Link to="/student/results" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>View Result</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
