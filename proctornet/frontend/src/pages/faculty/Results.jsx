import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, Alert } from '@/components/common/FormComponents'
import api from '@/services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

function Icon({ name, size = 20, style = {} }) {
  return <span className="material-icon" style={{ fontSize: size, ...style }}>{name}</span>
}

const navItems = [
  { to: '/faculty/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/faculty/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/faculty/question-pool', icon: 'quiz', label: 'Question Bank' },
  { to: '/faculty/students', icon: 'groups', label: 'My Students' },
  { to: '/faculty/results', icon: 'analytics', label: 'Results & Reports' },
]

export default function FacultyResults() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [showCollusionModal, setShowCollusionModal] = useState(false)
  const [collusionFlags, setCollusionFlags] = useState([])

  useEffect(() => {
    if (examId) fetchData()
    else fetchAllExams()
  }, [examId])

  const fetchAllExams = async () => {
    try {
      const res = await api.get('/faculty/exams')
      // Only show completed exams in results
      setResults(res.data.exams.filter(e => e.status === 'COMPLETED' || e.status === 'IN_PROGRESS'))
      setLoading(false)
    } catch (e) {
      setError('Failed to fetch exams.')
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [examRes, resultsRes] = await Promise.all([
        api.get(`/faculty/exams/${examId}`),
        api.get(`/faculty/exams/${examId}/results`)
      ])
      setExam(examRes.data.exam)
      setResults(resultsRes.data.results)
      setLoading(false)
    } catch (err) {
      setError('Failed to fetch exam results.')
      setLoading(false)
    }
  }

  const handleRunCollusion = async () => {
    setChecking(true)
    try {
      const res = await api.post(`/faculty/exams/${examId}/collusion-check`)
      setCollusionFlags(res.data.flags)
      setShowCollusionModal(true)
    } catch (e) {
      alert('Collusion check failed.')
    } finally {
      setChecking(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>

  // If no specific exam is selected, show list of completed exams
  if (!examId) {
    return (
      <DashboardLayout navItems={navItems}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Results & Reports</h1>
            <p className="page-subtitle">Analyze performance and review proctoring evidence for completed exams.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {results.map(e => (
            <div key={e.id} className="card hover-lift" style={{ cursor: 'pointer' }} onClick={() => navigate(`/faculty/exams/${e.id}/results`)}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className="badge badge-success">{e.subject}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{new Date(e.endTime).toLocaleDateString()}</span>
                </div>
                <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>{e.title}</h3>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Graded</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Status</div>
                  </div>
                </div>
              </div>
              <div className="card-footer" style={{ borderTop: '1px solid var(--outline-variant)', textAlign: 'center', color: 'var(--primary)', fontWeight: 600, padding: '1rem' }}>
                View Full Analysis →
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem' }}>
              <Icon name="analytics" size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--on-surface-variant)' }}>No exams available for result analysis.</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  // Statistics for the chart
  const scoreData = [
    { name: '0-20', count: results.filter(r => r.percentage < 20).length },
    { name: '21-40', count: results.filter(r => r.percentage >= 20 && r.percentage < 40).length },
    { name: '41-60', count: results.filter(r => r.percentage >= 40 && r.percentage < 60).length },
    { name: '61-80', count: results.filter(r => r.percentage >= 60 && r.percentage < 80).length },
    { name: '81-100', count: results.filter(r => r.percentage >= 80).length },
  ]

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/faculty/results" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Icon name="arrow_back" size={18} /> All Results
            </Link>
          </div>
          <h1 className="page-title">{exam.title} - Analysis</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary"><Icon name="file_download" /> Export CSV</button>
          <button className="btn-primary" onClick={handleRunCollusion} disabled={checking}>
            <Icon name={checking ? 'sync' : 'psychology'} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} /> 
            {checking ? 'Analyzing...' : 'Run Collusion Check'}
          </button>
        </div>
      </div>

      {/* Collusion Modal */}
      {showCollusionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Collusion Analysis</h2>
              <button className="btn-text" onClick={() => setShowCollusionModal(false)}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {collusionFlags.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Icon name="verified_user" size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                  <p>No high-similarity pairs detected above the threshold.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>The following student pairs show {'>'}85% similarity in their submitted answers.</p>
                  {collusionFlags.map((flag, idx) => (
                    <div key={idx} style={{ padding: '1rem', background: 'var(--error-container)', borderRadius: '12px', border: '1px solid var(--error-outline)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 800 }}>{flag.student1.name} & {flag.student2.name}</span>
                        <span style={{ color: 'var(--error)', fontWeight: 800 }}>{flag.similarity.toFixed(1)}% Match</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--on-error-container)' }}>{flag.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowCollusionModal(false)}>Close Results</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Score Distribution</h3></div>
          <div className="card-body" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Exam Integrity Summary</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Total Submissions</span>
                <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>{results.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Active Flags</span>
                <span style={{ color: 'var(--error)', fontWeight: 800, fontSize: '1.25rem' }}>
                  {results.reduce((acc, curr) => acc + curr.studentExam.evidenceLogs.length, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Student Submissions</h3>
          <div style={{ width: '300px' }}>
            <FormInput placeholder="Search student name or USN..." prefixIcon="search" style={{ marginBottom: 0 }} />
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Flags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.studentExam.student.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{r.studentExam.student.usn}</div>
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{r.totalScore} / {exam.totalMarks}</td>
                  <td>{r.percentage.toFixed(1)}%</td>
                  <td>
                    <span className={`badge ${r.studentExam.evidenceLogs.length > 5 ? 'badge-error' : r.studentExam.evidenceLogs.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                      {r.studentExam.evidenceLogs.length} Flags
                    </span>
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => navigate(`/faculty/results/dossier/${r.id}`)}>
                      Review Dossier
                    </button>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>No results found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
          display: flex; alignItems: center; justifyContent: center; z-index: 1000;
        }
        .modal-content {
          background: var(--surface-container-high); border-radius: 24px;
          width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </DashboardLayout>
  )
}
