import React from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput } from '@/components/common/FormComponents'

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

export default function FacultyStudents() {
  const students = [
    { usn: '1VE22CS001', name: 'John Doe', sem: '4th', status: 'Pending Approval', lastLogin: 'Never' },
    { usn: '1VE22CS045', name: 'Jane Smith', sem: '4th', status: 'Approved', lastLogin: 'Oct 12' },
    { usn: '1VE22CS088', name: 'Alice Johnson', sem: '4th', status: 'Approved', lastLogin: 'Oct 14' },
    { usn: '1VE22CS102', name: 'Bob Williams', sem: '4th', status: 'Approved', lastLogin: 'Oct 10' },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Students</h1>
          <p className="page-subtitle">Manage enrollments and approve student registrations.</p>
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
                <th>Last Login</th>
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
                  <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>{s.lastLogin}</td>
                  <td>
                    {s.status === 'Pending Approval' ? (
                      <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                        Approve
                      </button>
                    ) : (
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                        View Profile
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
