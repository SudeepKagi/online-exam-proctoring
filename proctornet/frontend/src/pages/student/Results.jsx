import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function StudentResults() {
  const [selectedResult, setSelectedResult] = useState(null)

  const results = [
    { id: 1, title: 'Operating Systems Quiz', date: 'Oct 12, 2025', score: 85, total: 100, status: 'Passed', rank: 'Top 10%', duration: '40m / 45m' },
    { id: 2, title: 'Computer Networks Midterm', date: 'Oct 05, 2025', score: 92, total: 100, status: 'Passed', rank: 'Top 5%', duration: '55m / 60m' },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Results</h1>
          <p className="page-subtitle">View your scores, performance metrics, and graded exams.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedResult ? '1fr 1fr' : '1fr', gap: '1.5rem', transition: 'all 0.3s ease' }}>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Completed Exams</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} style={{ background: selectedResult?.id === r.id ? 'var(--surface-container-low)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedResult(r)}>
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{r.date}</td>
                    <td>
                      <span className={`badge ${r.score >= 90 ? 'badge-primary' : r.score >= 80 ? 'badge-success' : 'badge-warning'}`}>
                        {r.score} / {r.total}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedResult && (
          <div className="card" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="card-title" style={{ marginBottom: '0.25rem' }}>{selectedResult.title}</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{selectedResult.date}</div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }} onClick={() => setSelectedResult(null)}>
                <Icon name="close" />
              </button>
            </div>
            
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '1.5rem', background: 'var(--surface-container-lowest)', borderRadius: '12px', border: '1px solid var(--outline-variant)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{selectedResult.score}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Total Score</div>
                </div>
                <div style={{ width: '1px', height: '60px', background: 'var(--outline-variant)' }}></div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{selectedResult.status}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Result</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', border: '1px solid var(--outline-variant)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)', marginBottom: '0.25rem' }}>
                    <Icon name="leaderboard" size={18} /> <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Percentile Rank</span>
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)' }}>{selectedResult.rank}</div>
                </div>
                <div style={{ padding: '1rem', border: '1px solid var(--outline-variant)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)', marginBottom: '0.25rem' }}>
                    <Icon name="timer" size={18} /> <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Time Taken</span>
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)' }}>{selectedResult.duration}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.75rem' }}>Detailed Breakdown</h4>
                <div style={{ background: 'var(--surface-container-low)', borderRadius: '8px', padding: '1rem', fontSize: '0.875rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
                  Detailed question-by-question breakdown is disabled by the instructor for this exam.
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </DashboardLayout>
  )
}
