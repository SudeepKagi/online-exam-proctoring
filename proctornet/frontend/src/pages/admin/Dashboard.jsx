import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/services/api'
import { Alert } from '@/components/common/FormComponents'
import VPNStatus from '@/components/admin/VPNStatus'

function Icon({ name, style }) {
  return (
    <span
      className="material-icon"
      style={style}
    >
      {name}
    </span>
  )
}

const navItems = [
  { to: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/faculty', icon: 'groups', label: 'Faculty Approval' },
  { to: '/admin/students', icon: 'school', label: 'Students' },
  { to: '/admin/exams', icon: 'assignment', label: 'Active Exams' },
  { to: '/admin/violations', icon: 'warning', label: 'Violations' },
  { to: '/admin/settings', icon: 'settings', label: 'Settings' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    activeExams: 0,
    facultyPending: 0,
    studentsRegistered: 0,
    violationsToday: 0
  })
  const [recentViolations, setRecentViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const res = await api.get('/admin/dashboard')
        const data = res.data
        setStats({
          activeExams: data.exams.active,
          facultyPending: data.faculty.pending,
          studentsRegistered: data.students.total,
          violationsToday: data.flags.highSeverity
        })
        setRecentViolations(data.recentViolations || [])
    } catch (err) {
        console.error('Error fetching dashboard stats:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardStats()
  }, [])

  return (
    <DashboardLayout navItems={navItems}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview and real-time alerts.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary">
            <Icon name="download" /> Export Report
          </button>
          <button className="btn-primary">
            <Icon name="add" /> New User
          </button>
        </div>
      </div>

      <Alert type="info" message="There are 5 faculty registration requests pending approval." />

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--primary-fixed)', color: 'var(--primary)' }}>
            <Icon name="assignment" />
          </div>
          <div>
            <div className="stats-label">Active Exams</div>
            <div className="stats-value">{loading ? '-' : stats.activeExams}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Icon name="person_add" />
          </div>
          <div>
            <div className="stats-label">Pending Faculty</div>
            <div className="stats-value">{loading ? '-' : stats.facultyPending}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Icon name="school" />
          </div>
          <div>
            <div className="stats-label">Registered Students</div>
            <div className="stats-value">{loading ? '-' : stats.studentsRegistered}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon" style={{ background: 'var(--error-container)', color: 'var(--error)' }}>
            <Icon name="warning" />
          </div>
          <div>
            <div className="stats-label">Violations Today</div>
            <div className="stats-value">{loading ? '-' : stats.violationsToday}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Recent Violations Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Flagged Activity</h3>
            <a href="/admin/violations" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>View All</a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Exam</th>
                  <th>Violation</th>
                  <th>Severity</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>Loading data...</td></tr>
                ) : recentViolations.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.student}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{v.exam}</td>
                    <td>{v.type}</td>
                    <td>
                      <span className={`badge ${v.severity === 'High' ? 'badge-danger' : v.severity === 'Medium' ? 'badge-warning' : 'badge-info'}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>{v.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="check_circle" /> Review Pending Approvals
            </button>
            <button className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="vpn_key" /> Generate VPN Keys
            </button>
            <button className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="campaign" /> Post Announcement
            </button>
            <button className="btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Icon name="history" /> View System Logs
            </button>
          </div>
        </div>

        {/* VPN Status Widget */}
        <VPNStatus />
      </div>
    </DashboardLayout>
  )
}
