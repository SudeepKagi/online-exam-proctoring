import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/faculty/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/faculty/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/faculty/question-pool', icon: 'quiz', label: 'Question Bank' },
  { to: '/faculty/students', icon: 'groups', label: 'My Students' },
  { to: '/faculty/results', icon: 'analytics', label: 'Results & Reports' },
]

export default function FacultyExams() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('active')

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Exams</h1>
          <p className="page-subtitle">Manage your created exams and monitor active sessions.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/faculty/create-exam" className="btn-primary">
            <Icon name="add" /> Create New Exam
          </Link>
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'active' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'active' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('active')}
          >
            Active & Upcoming
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'drafts' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'drafts' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'past' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'past' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('past')}
          >
            Past Exams
          </button>
        </div>

        <div className="card-body">
          {activeTab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Live Exam Card */}
              <div style={{ padding: '1.5rem', border: '1px solid var(--primary)', borderRadius: '12px', background: 'var(--primary-fixed)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="live-dot" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-primary-fixed)', marginBottom: '0.5rem' }}>Data Structures Midterm</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-primary-fixed-variant)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> Ends in 45 mins</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="group" size={16} /> 45/50 Active Students</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--error)' }}><Icon name="warning" size={16} /> 2 Flagged Sessions</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button className="btn-secondary" style={{ padding: '0.5rem 1rem', background: 'transparent', borderColor: 'var(--primary)' }} onClick={() => navigate('/faculty/exam/123/settings')}>
                      Settings
                    </button>
                    <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => navigate('/faculty/exam/123')}>
                      Monitor Feed
                    </button>
                  </div>
                </div>
              </div>

              {/* Upcoming Exam */}
              <div style={{ padding: '1.5rem', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-neutral">Tomorrow</span>
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>Algorithms Quiz 2</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="event" size={16} /> Oct 15, 10:00 AM</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> 120 Minutes</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={() => navigate('/faculty/exam/124/settings')}>
                      <Icon name="edit" /> Edit
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'drafts' && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--on-surface-variant)' }}>
              <Icon name="edit_document" style={{ fontSize: '3rem', color: 'var(--outline)', marginBottom: '1rem' }} />
              <p>You don't have any drafted exams right now.</p>
            </div>
          )}

          {activeTab === 'past' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Date</th>
                  <th>Attendees</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500 }}>Operating Systems Quiz</td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>Oct 12, 2025</td>
                  <td>58 / 60</td>
                  <td><span className="badge badge-success">Grading Complete</span></td>
                  <td>
                    <Link to="/faculty/results" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>View Reports</Link>
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
