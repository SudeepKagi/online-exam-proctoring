import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput } from '@/components/common/FormComponents'
import api from '@/services/api'

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
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStudents = async () => {
    try {
      const res = await api.get('/faculty/students')
      setStudents(res.data.students)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/faculty/students/${id}/approve`, {})
      fetchStudents()
    } catch (e) {
      alert('Error approving student')
      console.error(e)
    }
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Students</h1>
          <p className="page-subtitle">Manage enrollments and approve student registrations in your department.</p>
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
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>Loading students...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>USN</th>
                  <th>Full Name</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.usn}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{s.semester}th</td>
                    <td>
                      <span className={`badge ${s.approvalStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
                        {s.approvalStatus}
                      </span>
                    </td>
                    <td>
                      {s.approvalStatus === 'PENDING_FACULTY' ? (
                        <button className="btn-primary" onClick={() => handleApprove(s.id)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
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
                {students.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--on-surface-variant)' }}>
                      No students found in your department.
                    </td>
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
