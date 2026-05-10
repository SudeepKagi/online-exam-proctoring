import React from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput } from '@/components/common/FormComponents'

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

export default function AdminStudents() {
  const students = [
    { usn: '1VE22CS001', name: 'John Doe', sem: '4th', status: 'Pending Review', issue: 'Low Face Match' },
    { usn: '1VE22CS045', name: 'Jane Smith', sem: '4th', status: 'Approved', issue: null },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Management</h1>
          <p className="page-subtitle">Verify identities and manage student access.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '300px' }}>
            <FormInput id="search-stu" placeholder="Search by name or USN..." prefixIcon="search" style={{ marginBottom: 0 }} />
          </div>
          <button className="btn-secondary">
            <Icon name="filter_list" /> Filter
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>USN</th>
                <th>Full Name</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Verification Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.usn}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.usn}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>{s.sem}</td>
                  <td>
                    <span className={`badge ${s.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{s.issue || '-'}</td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                      Review Identity
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
