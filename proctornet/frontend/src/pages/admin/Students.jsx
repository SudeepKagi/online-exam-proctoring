import React, { useState, useEffect } from 'react'
import api from '@/services/api'
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
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/students')
      setStudents(res.data.students)
    } catch (err) {
      console.error('Error fetching students:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/approve`)
      fetchStudents()
    } catch (err) {
      alert('Failed to approve student')
    }
  }

  const handleRevoke = async (id) => {
    try {
      await api.patch(`/admin/students/${id}/suspend`)
      fetchStudents()
    } catch (err) {
      alert('Failed to suspend student')
    }
  }

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.usn.toLowerCase().includes(search.toLowerCase())
  )

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
            <FormInput 
              id="search-stu" 
              placeholder="Search by name or USN..." 
              prefixIcon="search" 
              style={{ marginBottom: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={fetchStudents}>
            <Icon name="refresh" /> Refresh
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>USN</th>
                  <th>Full Name</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th>Verification Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.usn}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{s.semester}</td>
                    <td>
                      <span className={`badge ${s.approvalStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
                        {s.approvalStatus}
                      </span>
                    </td>
                    <td style={{ color: s.faceMatchScore < 0.7 ? 'var(--error)' : 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>
                      {(s.faceMatchScore * 100).toFixed(1)}% Match
                    </td>
                    <td>
                      {s.approvalStatus !== 'APPROVED' ? (
                        <button onClick={() => handleApprove(s.id)} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', marginRight: '0.5rem' }}>
                          Approve
                        </button>
                      ) : (
                        <button onClick={() => handleRevoke(s.id)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'red', borderColor: 'red' }}>
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No students found.</td>
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
