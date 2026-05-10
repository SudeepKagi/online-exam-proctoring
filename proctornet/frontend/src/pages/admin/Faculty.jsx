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

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchFaculty()
  }, [])

  const fetchFaculty = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/faculty')
      setFaculty(res.data.faculty)
    } catch (err) {
      console.error('Error fetching faculty:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/approve`)
      fetchFaculty() // refresh list
    } catch (err) {
      alert('Failed to approve faculty')
    }
  }

  const handleRevoke = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/suspend`)
      fetchFaculty()
    } catch (err) {
      alert('Failed to suspend faculty')
    }
  }

  const handleUnsuspend = async (id) => {
    try {
      await api.patch(`/admin/faculty/${id}/unsuspend`)
      fetchFaculty()
    } catch (err) {
      alert('Failed to unsuspend faculty')
    }
  }

  const filteredFaculty = faculty.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.employeeId.toLowerCase().includes(search.toLowerCase())
  )

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
            <FormInput 
              id="search-fac" 
              placeholder="Search by name or EMP ID..." 
              prefixIcon="search" 
              style={{ marginBottom: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={fetchFaculty}>
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
                  <th>Emp ID</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculty.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{f.employeeId}</td>
                    <td style={{ fontWeight: 500 }}>{f.name}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{f.department}</td>
                    <td>
                      <span className={`badge ${f.isApproved ? (f.isSuspended ? 'badge-danger' : 'badge-success') : 'badge-warning'}`}>
                        {f.isSuspended ? 'Suspended' : (f.isApproved ? 'Approved' : 'Pending Approval')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.8125rem' }}>Never</td>
                    <td>
                      {!f.isApproved ? (
                        <button onClick={() => handleApprove(f.id)} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                          Approve
                        </button>
                      ) : f.isSuspended ? (
                        <button onClick={() => handleUnsuspend(f.id)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                          Unsuspend
                        </button>
                      ) : (
                        <button onClick={() => handleRevoke(f.id)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'red', borderColor: 'red' }}>
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredFaculty.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No faculty members found.</td>
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
