import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { Link } from 'react-router-dom'
import api from '@/services/api'

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

export default function AdminExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await api.get('/admin/exams/all')
        setExams(res.data.exams)
      } catch (err) {
        console.error('Error fetching exams:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchExams()
  }, [])

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Active & Scheduled Exams</h1>
          <p className="page-subtitle">Monitor platform-wide exam status.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading exams...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Faculty</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.title}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{e.faculty?.name || 'Unknown'}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{new Date(e.startTime).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${e.status === 'ACTIVE' ? 'badge-success' : 'badge-primary'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td>
                      <Link to="/admin/violations" className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                        View Logs
                      </Link>
                    </td>
                  </tr>
                ))}
                {exams.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No exams found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
