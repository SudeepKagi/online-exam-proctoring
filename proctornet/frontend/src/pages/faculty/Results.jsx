import React from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { SelectInput } from '@/components/common/FormComponents'

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

export default function FacultyResults() {
  const results = [
    { student: 'John Doe (1VE22CS001)', score: 45, total: 50, duration: '40m', flagged: 0 },
    { student: 'Jane Smith (1VE22CS045)', score: 38, total: 50, duration: '45m', flagged: 1 },
    { student: 'Alice Johnson (1VE22CS088)', score: 48, total: 50, duration: '35m', flagged: 0 },
    { student: 'Bob Williams (1VE22CS102)', score: 25, total: 50, duration: '45m', flagged: 3 },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Reports</h1>
          <p className="page-subtitle">Analyze performance and review auto-graded exam submissions.</p>
        </div>
        <button className="btn-secondary">
          <Icon name="download" /> Export CSV
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, maxWidth: '300px' }}>
            <SelectInput id="filter-exam" label="Select Exam" options={[{value: 'ds', label: 'Data Structures Midterm'}, {value: 'os', label: 'Operating Systems Quiz'}]} style={{ marginBottom: 0 }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>78%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Score</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>2</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Time Taken</th>
                <th>Security Flags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{r.student}</td>
                  <td>
                    <span className={`badge ${r.score >= 40 ? 'badge-primary' : r.score >= 30 ? 'badge-success' : 'badge-warning'}`}>
                      {r.score} / {r.total}
                    </span>
                  </td>
                  <td style={{ color: 'var(--on-surface-variant)' }}>{r.duration}</td>
                  <td>
                    {r.flagged > 0 ? (
                      <span className="badge badge-danger"><Icon name="warning" size={14} style={{ marginRight: '0.25rem' }} /> {r.flagged} Flags</span>
                    ) : (
                      <span className="badge badge-success"><Icon name="check_circle" size={14} style={{ marginRight: '0.25rem' }} /> Clean</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                      Review Details
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
