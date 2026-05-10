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

export default function AdminFaculty() {
  const faculty = [
    { empid: 'EMP001', name: 'Dr. Alan Turing', dept: 'Computer Science', status: 'Pending Approval', lastLogin: 'Never' },
    { empid: 'EMP045', name: 'Dr. Grace Hopper', dept: 'Computer Science', status: 'Approved', lastLogin: 'Oct 12' },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Management</h1>
          <p className="page-subtitle">Approve and manage institutional faculty accounts.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '300px' }}>
            <FormInput id="search-fac" placeholder="Search by name or EMP ID..." prefixIcon="search" style={{ marginBottom: 0 }} />
          </div>
          <button className="btn-secondary">
            <Icon name="filter_list" /> Filter
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Full Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map(f => (
                <tr key={f.empid}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{f.empid}</td>
                  <td style={{ fontWeight: 500 }}>{f.name}</td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>{f.dept}</td>
                  <td>
                    <span className={`badge ${f.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>{f.lastLogin}</td>
                  <td>
                    {f.status === 'Pending Approval' ? (
                      <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                        Approve
                      </button>
                    ) : (
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                        Revoke Access
                      </button>
                    )}
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
