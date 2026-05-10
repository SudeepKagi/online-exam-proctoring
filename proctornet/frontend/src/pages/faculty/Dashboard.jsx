import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { Alert } from '@/components/common/FormComponents'
import { Link } from 'react-router-dom'

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

export default function FacultyDashboard() {
  const [stats, setStats] = useState({
    activeExams: 0,
    upcomingExams: 0,
    totalStudents: 0,
    flaggedSessions: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Placeholder for API call
    setTimeout(() => {
      setStats({
        activeExams: 1,
        upcomingExams: 3,
        totalStudents: 145,
        flaggedSessions: 2
      })
      setLoading(false)
    }, 1000)
  }, [])

  return (
    <DashboardLayout navItems={navItems}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Dashboard</h1>
          <p className="page-subtitle">Manage your exams, monitor sessions, and review results.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/faculty/create-exam" className="btn-primary">
            <Icon name="add" /> Create New Exam
          </Link>
        </div>
      </div>

      <Alert type="warning" message="You have 2 exam sessions that require manual review of flagged behavior." />

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--primary-fixed)', color: 'var(--primary)' }}>
            <Icon name="radio_button_checked" />
          </div>
          <div>
            <div className="stats-label">Active Exams (Now)</div>
            <div className="stats-value">{loading ? '-' : stats.activeExams}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--tertiary-fixed)', color: 'var(--tertiary)' }}>
            <Icon name="event" />
          </div>
          <div>
            <div className="stats-label">Upcoming Exams</div>
            <div className="stats-value">{loading ? '-' : stats.upcomingExams}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}>
            <Icon name="groups" />
          </div>
          <div>
            <div className="stats-label">Enrolled Students</div>
            <div className="stats-value">{loading ? '-' : stats.totalStudents}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--error-container)', color: 'var(--error)' }}>
            <Icon name="flag" />
          </div>
          <div>
            <div className="stats-label">Flagged Sessions</div>
            <div className="stats-value">{loading ? '-' : stats.flaggedSessions}</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Active/Upcoming Exams */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Schedule Overview</h3>
            <Link to="/faculty/exams" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>View All</Link>
          </div>
          <div className="card-body">
            {loading ? (
              <p style={{ color: 'var(--on-surface-variant)' }}>Loading schedule...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', border: '1px solid var(--primary)', borderRadius: '8px', background: 'var(--primary-fixed)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="live-dot" />
                      <strong style={{ color: 'var(--on-primary-fixed)' }}>Data Structures Midterm</strong>
                    </div>
                    <span className="badge badge-primary">In Progress</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-primary-fixed-variant)', marginBottom: '1rem' }}>
                    45 / 50 students joined • Ends in 45 mins
                  </p>
                  <button className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
                    Monitor Live Feed
                  </button>
                </div>

                <div style={{ padding: '1rem', border: '1px solid var(--outline-variant)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--on-surface)' }}>Algorithms Quiz 2</strong>
                    <span className="badge badge-neutral">Tomorrow</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                    Starts at 10:00 AM • 120 mins duration
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to="/faculty/question-pool" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="post_add" /> Add Questions to Pool
            </Link>
            <Link to="/faculty/results" className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="fact_check" /> Review Auto-Grading
            </Link>
            <button className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="people" /> Manage Student Approvals
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
