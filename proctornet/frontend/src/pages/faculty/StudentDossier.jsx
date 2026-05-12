import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import CodeQuestion from '@/components/exam/CodeQuestion'

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

export default function StudentDossier() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('answers')

  useEffect(() => {
    fetchDossier()
  }, [id])

  const fetchDossier = async () => {
    try {
      const res = await api.get(`/faculty/results/${id}`)
      setResult(res.data.result)
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>
  if (!result) return <div style={{ padding: '2rem' }}>Result not found.</div>

  const { studentExam } = result
  const { student } = studentExam

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <button className="btn-text" onClick={() => navigate(-1)} style={{ padding: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', color: 'var(--on-surface-variant)' }}>
            <Icon name="arrow_back" size={18} /> Back to Results
          </button>
          <h1 className="page-title">Evidence Dossier: {student.name}</h1>
          <p className="page-subtitle">USN: {student.usn} • Exam: {studentExam.exam.title}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" onClick={() => window.print()}><Icon name="print" /> Print Report</button>
          <button className="btn-primary"><Icon name="verified" /> Finalize Grade</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
        {/* Profile Sidebar */}
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '120px', height: '120px', margin: '0 auto 1.5rem', borderRadius: '50%', overflow: 'hidden', border: '4px solid var(--primary-container)', background: 'var(--surface-container-high)' }}>
              <img src={student.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.usn}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ fontWeight: 800 }}>{student.name}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem' }}>{student.semester}th Semester, CSE</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--surface-container-low)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{result.totalScore}</div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Score</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--surface-container-low)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--error)' }}>{studentExam.evidenceLogs.length}</div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Flags</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h4 style={{ fontSize: '0.875rem', fontWeight: 800 }}>Proctoring Health</h4></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>Face Confidence</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>98.2%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--surface-container-high)', borderRadius: '2px' }}>
                  <div style={{ width: '98.2%', height: '100%', background: 'var(--success)', borderRadius: '2px' }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>Tab Focus Time</span>
                  <span style={{ color: 'var(--warning)', fontWeight: 700 }}>85.4%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--surface-container-high)', borderRadius: '2px' }}>
                  <div style={{ width: '85.4%', height: '100%', background: 'var(--warning)', borderRadius: '2px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div>
          <div className="card">
            <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
              <button 
                style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeView === 'answers' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeView === 'answers' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
                onClick={() => setActiveView('answers')}
              >
                Submitted Answers
              </button>
              <button 
                style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeView === 'timeline' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeView === 'timeline' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
                onClick={() => setActiveView('timeline')}
              >
                Integrity Timeline
              </button>
            </div>

            <div className="card-body">
              {activeView === 'answers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {result.answers.map((ans, idx) => (
                    <div key={ans.id} style={{ padding: '1.5rem', background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h4 style={{ fontWeight: 800 }}>Question {idx + 1}</h4>
                        <span style={{ fontWeight: 800, color: ans.isCorrect ? 'var(--success)' : 'var(--error)' }}>
                          {ans.marksAwarded} / {ans.question.marks} Marks
                        </span>
                      </div>
                      <p style={{ fontWeight: 500, marginBottom: '1.5rem', color: 'var(--on-surface)' }}>{ans.question.questionText}</p>
                      
                      {ans.question.type === 'MCQ' ? (
                        <div style={{ padding: '1rem', background: 'var(--surface-container-low)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8125rem' }}>Student Answer: <strong style={{ color: ans.isCorrect ? 'var(--success)' : 'var(--error)' }}>{ans.selectedOption}</strong></span>
                            {!ans.isCorrect && <span style={{ fontSize: '0.8125rem' }}>Correct Answer: <strong>{ans.question.correctAnswer}</strong></span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Submitted Code</div>
                          <CodeQuestion question={{}} value={ans.codeAnswer} readOnly={true} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeView === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {studentExam.evidenceLogs.map((log, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '1.5rem', padding: '1rem', borderRadius: '12px', borderLeft: `4px solid var(--${log.severity.toLowerCase()})`, background: 'var(--surface-container-lowest)' }}>
                      <div style={{ minWidth: '80px', color: 'var(--on-surface-variant)', fontSize: '0.8125rem', fontWeight: 700 }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{log.type}</div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '0.75rem' }}>{log.details}</p>
                        {log.snapshot && (
                          <div style={{ width: '200px', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--outline-variant)' }}>
                            <img src={log.snapshot} alt="Flag Snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                      <div className={`badge badge-${log.severity.toLowerCase()}`} style={{ height: 'fit-content' }}>{log.severity}</div>
                    </div>
                  ))}
                  {studentExam.evidenceLogs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--success)' }}>
                      <Icon name="verified" size={48} style={{ marginBottom: '1rem' }} />
                      <p>Clean session. No integrity flags reported.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          .nav-sidebar, .page-header button, .card-header, .btn-primary, .btn-secondary { display: none !important; }
          .dashboard-content { margin: 0 !important; padding: 0 !important; }
          .card { border: none !important; box-shadow: none !important; }
          body { background: white !important; color: black !important; }
          .page-header { border-bottom: 2px solid black; padding-bottom: 1rem; margin-bottom: 2rem; }
          .page-title::before { content: "CERTIFIED FORENSIC RECORD: "; font-weight: 400; font-size: 0.75rem; display: block; }
          .integrity-timeline { display: block !important; }
          .signature-box { display: block !important; margin-top: 4rem; border-top: 1px solid black; width: 250px; padding-top: 0.5rem; font-weight: 700; }
        }
        .signature-box { display: none; }
      `}</style>

      <div className="signature-box">
        Examining Faculty Signature
        <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: '0.25rem' }}>Dated: {new Date().toLocaleDateString()}</div>
      </div>
    </DashboardLayout>
  )
}
