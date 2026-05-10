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

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/audit-logs')
      setLogs(res.data.logs)
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Audit Logs</h1>
          <p className="page-subtitle">Track all administrative and security actions across the platform.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Recent Activity</h2>
          <button className="btn-secondary" onClick={fetchLogs}>
            <Icon name="refresh" /> Refresh Logs
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading logs...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User Role</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--on-surface-variant)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${log.userRole === 'admin' ? 'badge-danger' : log.userRole === 'faculty' ? 'badge-primary' : 'badge-neutral'}`}>
                        {log.userRole}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.action}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{log.details || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{log.ipAddress || 'unknown'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      No audit logs found.
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
