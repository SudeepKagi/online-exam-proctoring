import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
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

export default function FacultyExams() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('active')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await api.get('/faculty/exams')
        setExams(res.data.exams)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchExams()
  }, [])

  const activeExams = exams.filter(e => e.status === 'IN_PROGRESS' || e.status === 'SCHEDULED')
  const pastExams = exams.filter(e => e.status === 'COMPLETED' || e.status === 'CANCELLED')
  const draftExams = exams.filter(e => e.status === 'DRAFT')

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Exams</h1>
          <p className="page-subtitle">Manage your created exams and monitor active sessions.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/faculty/exams/create" className="btn-primary">
            <Icon name="add" /> Create New Exam
          </Link>
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'active' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'active' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('active')}
          >
            Active & Upcoming
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'drafts' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'drafts' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'past' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'past' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('past')}
          >
            Past Exams
          </button>
        </div>

        <div className="card-body">
          {loading ? (
             <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>Loading exams...</div>
          ) : (
            <>
              {activeTab === 'active' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {activeExams.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--on-surface-variant)' }}>No active or upcoming exams.</div>
                  )}
                  {activeExams.map(exam => (
                    <div key={exam.id} style={{ padding: '1.5rem', border: exam.status === 'IN_PROGRESS' ? '1px solid var(--primary)' : '1px solid var(--outline-variant)', borderRadius: '12px', background: exam.status === 'IN_PROGRESS' ? 'var(--primary-fixed)' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            {exam.status === 'IN_PROGRESS' && <span className="live-dot" />}
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: exam.status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {exam.status === 'IN_PROGRESS' ? 'In Progress' : new Date(exam.startTime).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: exam.status === 'IN_PROGRESS' ? 'var(--on-primary-fixed)' : 'var(--on-surface)', marginBottom: '0.5rem' }}>{exam.title}</h3>
                          <div style={{ display: 'flex', gap: '1.5rem', color: exam.status === 'IN_PROGRESS' ? 'var(--on-primary-fixed-variant)' : 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> {exam.durationMinutes} Minutes</span>
                            {exam.status === 'IN_PROGRESS' && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--error)' }}><Icon name="warning" size={16} /> Monitor Feed Available</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <button className="btn-secondary" style={{ padding: '0.5rem 1rem', background: 'transparent', borderColor: 'var(--outline-variant)' }} onClick={() => navigate(`/faculty/exams/${exam.id}`)}>
                            Details
                          </button>
                          {exam.status === 'IN_PROGRESS' && (
                            <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => navigate(`/invigilator/exam/${exam.id}`)}>
                              Monitor Feed
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'drafts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {draftExams.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--on-surface-variant)' }}>
                      <Icon name="edit_document" style={{ fontSize: '3rem', color: 'var(--outline)', marginBottom: '1rem' }} />
                      <p>You don't have any drafted exams right now.</p>
                    </div>
                  ) : (
                    draftExams.map(exam => (
                      <div key={exam.id} style={{ padding: '1.5rem', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>{exam.title}</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="event" size={16} /> Unscheduled</span>
                            </div>
                          </div>
                          <button className="btn-secondary" onClick={() => navigate(`/faculty/exams/${exam.id}`)}>
                            <Icon name="edit" /> Edit
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'past' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exam Title</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastExams.map(exam => (
                      <tr key={exam.id}>
                        <td style={{ fontWeight: 500 }}>{exam.title}</td>
                        <td style={{ color: 'var(--on-surface-variant)' }}>{new Date(exam.startTime).toLocaleDateString()}</td>
                        <td><span className="badge badge-neutral">{exam.status}</span></td>
                        <td>
                          <Link to={`/faculty/exams/${exam.id}/results`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>View Reports</Link>
                        </td>
                      </tr>
                    ))}
                    {pastExams.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--on-surface-variant)' }}>No past exams found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
