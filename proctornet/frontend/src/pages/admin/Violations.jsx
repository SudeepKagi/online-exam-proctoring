import React, { useState, useEffect } from 'react'
import api from '@/services/api'
import DashboardLayout from '@/components/common/DashboardLayout'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/faculty', icon: 'groups', label: 'Faculty Approval' },
  { to: '/admin/students', icon: 'school', label: 'Students' },
  { to: '/admin/exams', icon: 'assignment', label: 'Active Exams' },
  { to: '/admin/violations', icon: 'warning', label: 'Violations' },
  { to: '/admin/settings', icon: 'settings', label: 'Settings' },
]

export default function AdminViolations() {
  const [activeFilter, setActiveFilter] = useState('all')
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchViolations()
  }, [activeFilter])

  const fetchViolations = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/admin/violations/summary?status=${activeFilter}`)
      setViolations(res.data.violations)
    } catch (err) {
      console.error('Error fetching violations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = violations

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Violations</h1>
          <p className="page-subtitle">Review flagged activity across all active and recent exams.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`btn-${activeFilter === 'all' ? 'primary' : 'secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setActiveFilter('all')}>
              All
            </button>
            <button className={`btn-${activeFilter === 'pending' ? 'primary' : 'secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setActiveFilter('pending')}>
              Pending Review
            </button>
            <button className={`btn-${activeFilter === 'reviewed' ? 'primary' : 'secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setActiveFilter('reviewed')}>
              Reviewed
            </button>
          </div>
          <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <Icon name="filter_list" size={18} /> Filters
          </button>
        </div>
        
        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Exam</th>
                  <th>Violation Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.student}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{v.exam}</td>
                    <td style={{ fontWeight: 500 }}>{v.type}</td>
                    <td>
                      <span className={`badge ${v.severity === 'High' ? 'badge-danger' : v.severity === 'Medium' ? 'badge-warning' : 'badge-info'}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${v.status === 'Pending' ? 'badge-warning' : v.status === 'Reviewed' ? 'badge-success' : 'badge-neutral'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>{v.time}</td>
                    <td>
                      <button className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
                        Review Logs
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      No violations found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
