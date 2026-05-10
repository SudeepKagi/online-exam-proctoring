import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { getMyExams } from '@/services/student.api'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function StudentExams() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExams()
  }, [activeTab])

  const fetchExams = async () => {
    try {
      setLoading(true)
      const res = await getMyExams({ status: activeTab })
      setExams(res.data.exams)
    } catch (err) {
      console.error('Error fetching exams:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Exams</h1>
          <p className="page-subtitle">View your exam schedule and join active sessions.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'upcoming' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'upcoming' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming & Live
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
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--on-surface-variant)' }}>Loading exams...</p>
            </div>
          ) : (
            <>
              {activeTab === 'upcoming' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {exams.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      <Icon name="event_busy" size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                      <p>No upcoming exams scheduled for your department.</p>
                    </div>
                  )}
                  {exams.map(exam => (
                    <div key={exam.id} style={{ 
                      padding: '1.5rem', 
                      border: `1px solid ${exam.isLive ? 'var(--primary)' : 'var(--outline-variant)'}`, 
                      borderRadius: '12px',
                      background: exam.isLive ? 'var(--primary-fixed)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          {exam.isLive && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span className="live-dot" />
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Now</span>
                            </div>
                          )}
                          {!exam.isLive && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span className="badge badge-neutral">{formatDate(exam.startTime)}</span>
                            </div>
                          )}
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>{exam.title}</h3>
                          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" size={16} /> {exam.duration} Minutes</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="person" size={16} /> {exam.faculty.name}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
                            {exam.isLive ? `Closes at ${formatTime(exam.endTime)}` : `Starts at ${formatTime(exam.startTime)}`}
                          </div>
                          {exam.isLive ? (
                            <Link to={`/student/exam-lobby/${exam.id}`} className="btn-primary">
                              Join Lobby <Icon name="arrow_forward" size={16} style={{ marginLeft: '0.5rem' }} />
                            </Link>
                          ) : (
                            <button className="btn-secondary" disabled>
                              Lobby Not Open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
                    {exams.map(exam => (
                      <tr key={exam.id}>
                        <td style={{ fontWeight: 500 }}>{exam.title}</td>
                        <td style={{ color: 'var(--on-surface-variant)' }}>{formatDate(exam.startTime)}</td>
                        <td>
                          <span className={`badge ${exam.studentStatus === 'SUBMITTED' ? 'badge-success' : 'badge-neutral'}`}>
                            {exam.studentStatus === 'SUBMITTED' ? 'Completed' : 'Absent'}
                          </span>
                        </td>
                        <td>
                          {exam.studentStatus === 'SUBMITTED' ? (
                            <Link to={`/student/results/${exam.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>View Result</Link>
                          ) : (
                            <span style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No Data</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {exams.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                          No past exams found.
                        </td>
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
