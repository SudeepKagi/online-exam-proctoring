import React from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { Link } from 'react-router-dom'

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
              <tr>
                <td style={{ fontWeight: 500 }}>Data Structures Midterm</td>
                <td style={{ color: 'var(--on-surface-variant)' }}>Dr. Alan Turing</td>
                <td style={{ color: 'var(--on-surface-variant)' }}>Today, 10:00 AM</td>
                <td><span className="badge badge-primary">In Progress</span></td>
                <td>
                  <Link to="/admin/violations" className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                    View Logs
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
