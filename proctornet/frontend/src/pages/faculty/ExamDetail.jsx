import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, FormTextarea, SubmitButton, Alert } from '@/components/common/FormComponents'
import api from '@/utils/api'

function Icon({ name, size = 20, style = {} }) {
  return <span className="material-icon" style={{ fontSize: size, ...style }}>{name}</span>
}

function getMCQOptions(q) {
  if (!q.options) return [];
  let opts = q.options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch (e) {
      console.error("Failed to parse options", e);
      return [];
    }
  }
  if (Array.isArray(opts)) {
    return opts.map((opt, index) => {
      const letter = String.fromCharCode(65 + index); // 'A', 'B', 'C', 'D'
      if (typeof opt === 'string') {
        return {
          letter,
          text: opt,
          isCorrect: q.correctAnswer === letter || q.correctAnswer === opt
        };
      } else if (opt && typeof opt === 'object') {
        return {
          letter: opt.letter || letter,
          text: opt.text || opt.value || JSON.stringify(opt),
          isCorrect: opt.isCorrect || q.correctAnswer === (opt.letter || letter) || q.correctAnswer === opt.text
        };
      }
      return { letter, text: String(opt), isCorrect: false };
    });
  }
  return [];
}

function getTestCases(q) {
  if (!q.testCases) return [];
  let cases = q.testCases;
  if (typeof cases === 'string') {
    try {
      cases = JSON.parse(cases);
    } catch (e) {
      console.error("Failed to parse test cases", e);
      return [];
    }
  }
  return Array.isArray(cases) ? cases : [];
}

const navItems = [
  { to: '/faculty/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/faculty/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/faculty/question-pool', icon: 'quiz', label: 'Question Bank' },
  { to: '/faculty/students', icon: 'groups', label: 'My Students' },
  { to: '/faculty/results', icon: 'analytics', label: 'Results & Reports' },
]

export default function ExamDetail() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('questions')
  
  // Credentials modal state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [copiedField, setCopiedField] = useState('')

  // Question Form State
  const [qForm, setQForm] = useState({
    type: 'MCQ',
    questionText: '',
    marks: '5',
    difficulty: 'MEDIUM',
    options: ['', '', '', ''],
    correctAnswer: 'A'
  })

  // Enrollment State
  const [deptStudents, setDeptStudents] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])

  useEffect(() => {
    fetchExam()
    fetchDeptStudents()
  }, [id])

  const fetchExam = async () => {
    try {
      const res = await api.get(`/faculty/exams/${id}`)
      setExam(res.data.exam)
      setLoading(false)
    } catch (err) {
      setError('Failed to fetch exam details.')
      setLoading(false)
    }
  }

  const fetchDeptStudents = async () => {
    try {
      const res = await api.get('/faculty/students?status=APPROVED')
      setDeptStudents(res.data.students)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddQuestion = async (e) => {
    e.preventDefault()
    try {
      await api.post('/faculty/questions', { ...qForm, examId: id })
      fetchExam()
      setQForm({ type: 'MCQ', questionText: '', marks: '5', difficulty: 'MEDIUM', options: ['', '', '', ''], correctAnswer: 'A' })
    } catch (err) {
      alert('Error adding question')
    }
  }

  const handleEnroll = async () => {
    try {
      await api.post(`/faculty/exams/${id}/students`, { studentIds: selectedStudents })
      fetchExam()
      setSelectedStudents([])
      alert('Students enrolled successfully')
    } catch (err) {
      alert('Error enrolling students')
    }
  }

  const handlePublish = async () => {
    if (exam.questions.length === 0) {
      alert('Cannot publish exam with zero questions. Please add questions first.')
      return
    }
    if (!confirm('Are you sure you want to publish this exam? Once published, questions cannot be modified, and invigilator credentials will be generated.')) {
      return
    }
    try {
      const res = await api.patch(`/faculty/exams/${id}/publish`)
      setCredentials(res.data.invCredentials)
      setShowCredentialsModal(true)
      fetchExam()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to publish exam.')
    }
  }

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const handleViewCredentials = async () => {
    try {
      const res = await api.get(`/faculty/exams/${id}/credentials`)
      setCredentials(res.data.invCredentials)
      setShowCredentialsModal(true)
    } catch (err) {
      alert(err.response?.data?.error || 'Could not retrieve credentials. They may have been reset.')
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>
  if (!exam) return <div style={{ padding: '2rem' }}><Alert type="error" message="Exam not found." /></div>

  return (
    <DashboardLayout navItems={navItems}>
      {showCredentialsModal && credentials && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--surface-container)',
            borderRadius: '24px', border: '1px solid var(--outline-variant)',
            width: '100%', maxWidth: '520px', padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="lock" size={24} style={{ color: 'var(--primary)' }} /> Exam Published Successfully!
            </h2>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              The exam is now live. Share these credentials with your assigned invigilator.
            </p>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgb(239, 68, 68)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <p style={{ color: 'rgb(239, 68, 68)', fontSize: '0.8125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="warning" size={16} /> IMPORTANT WARNING
              </p>
              <p style={{ color: 'var(--on-surface)', fontSize: '0.8125rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
                This is the only time the temporary password will be shown. Please copy these credentials immediately!
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {/* Login Link */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Invigilator Login URL</label>
                <div style={{ display: 'flex', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px', overflow: 'hidden' }}>
                  <input readOnly value={`${window.location.origin}/invigilator-login`} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', fontSize: '0.875rem', color: 'var(--on-surface)', outline: 'none' }} />
                  <button onClick={() => copyToClipboard(`${window.location.origin}/invigilator-login`, 'url')} style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--outline-variant)', padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                    <Icon name={copiedField === 'url' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Exam ID */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Exam UUID (Exam ID)</label>
                <div style={{ display: 'flex', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px', overflow: 'hidden' }}>
                  <input readOnly value={exam.id} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', fontSize: '0.875rem', color: 'var(--on-surface)', outline: 'none' }} />
                  <button onClick={() => copyToClipboard(exam.id, 'examid')} style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--outline-variant)', padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                    <Icon name={copiedField === 'examid' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Invigilator ID */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Invigilator ID</label>
                <div style={{ display: 'flex', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px', overflow: 'hidden' }}>
                  <input readOnly value={credentials.invId} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', fontSize: '0.875rem', color: 'var(--on-surface)', fontWeight: 'bold', outline: 'none' }} />
                  <button onClick={() => copyToClipboard(credentials.invId, 'invid')} style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--outline-variant)', padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                    <Icon name={copiedField === 'invid' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Passcode */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Temporary Passcode</label>
                <div style={{ display: 'flex', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px', overflow: 'hidden' }}>
                  <input readOnly value={credentials.password} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', fontSize: '0.875rem', color: 'var(--on-surface)', fontWeight: 'bold', letterSpacing: '0.1em', outline: 'none' }} />
                  <button onClick={() => copyToClipboard(credentials.password, 'pass')} style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--outline-variant)', padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                    <Icon name={copiedField === 'pass' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowCredentialsModal(false)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700 }}>
              Done & Close
            </button>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/faculty/exams" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Icon name="arrow_back" size={18} /> Back to Exams
            </Link>
          </div>
          <h1 className="page-title">{exam.title}</h1>
          <p className="page-subtitle">{exam.subject} • {new Date(exam.startTime).toLocaleDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={`badge ${exam.status === 'SCHEDULED' || exam.status === 'DRAFT' ? 'badge-primary' : 'badge-success'}`}>
            {exam.status}
          </span>
          {/* View Invigilator Credentials - shown for published/scheduled exams */}
          {(exam.status === 'SCHEDULED' || exam.status === 'PUBLISHED' || exam.status === 'ACTIVE' || exam.status === 'IN_PROGRESS') && (
            <button
              onClick={handleViewCredentials}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '8px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
            >
              <Icon name="key" size={16} /> Invigilator Credentials
            </button>
          )}
          {(exam.status === 'DRAFT' || exam.status === 'SCHEDULED') && (
            <button 
              onClick={handlePublish} 
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              <Icon name="publish" size={16} /> Publish Exam
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          {['questions', 'enrollment', 'settings'].map(tab => (
            <button 
              key={tab}
              style={{ 
                background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, 
                color: activeTab === tab ? 'var(--primary)' : 'var(--on-surface-variant)', 
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', 
                cursor: 'pointer', textTransform: 'capitalize'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="card-body">          {activeTab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Premium AI Generator Callout */}
              {exam.status === 'DRAFT' && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)', 
                  border: '1px solid rgba(124, 58, 237, 0.25)', 
                  borderRadius: '16px', 
                  padding: '1.5rem', 
                  backdropFilter: 'blur(10px)',
                  gap: '1.5rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flex: 1, minWidth: '280px' }}>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
                      borderRadius: '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                    }}>
                      <Icon name="bolt" size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)' }}>AI-Supported Question Generator & Pool</h4>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                        Generate exam questions instantly from lecture notes or PDFs using Gemini AI, or manage the advanced question pool.
                      </p>
                    </div>
                  </div>
                  <Link 
                    to={`/faculty/exams/${exam.id}/questions`} 
                    className="btn-primary" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.75rem 1.25rem', 
                      fontSize: '0.875rem', 
                      textDecoration: 'none',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                  >
                    <Icon name="auto_awesome" size={16} /> Open AI Generator
                  </Link>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: exam.status === 'DRAFT' ? '1.5fr 1fr' : '1fr', gap: '2rem' }}>
                {/* Question List */}
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon name="quiz" size={20} style={{ color: 'var(--primary)' }} />
                    Exam Questions ({exam.questions.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {exam.questions.map((q, i) => {
                      const mcqOptions = getMCQOptions(q);
                      const testCases = getTestCases(q);
                      
                      return (
                        <div key={q.id} style={{ 
                          padding: '1.5rem', 
                          background: 'var(--surface-container-low)', 
                          borderRadius: '16px', 
                          border: '1px solid var(--outline-variant)',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ 
                                background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                                color: '#fff',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Q{i+1}
                              </span>
                              <span style={{ 
                                fontWeight: 700, 
                                fontSize: '0.875rem',
                                color: 'var(--on-surface-variant)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: 'var(--surface-container-high)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px'
                              }}>
                                {q.type}
                              </span>
                              {q.difficulty && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: q.difficulty === 'EASY' ? '#10b981' : q.difficulty === 'MEDIUM' ? '#f59e0b' : '#ef4444',
                                  background: q.difficulty === 'EASY' ? 'rgba(16, 185, 129, 0.1)' : q.difficulty === 'MEDIUM' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '6px',
                                  textTransform: 'capitalize'
                                }}>
                                  {q.difficulty.toLowerCase()}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>{q.marks} Marks</span>
                          </div>
                          
                          <p style={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem 0', color: 'var(--on-surface)' }}>{q.questionText}</p>

                          {/* MCQ Options Display */}
                          {q.type === 'MCQ' && mcqOptions.length > 0 && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Options:</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                {mcqOptions.map((opt) => (
                                  <div 
                                    key={opt.letter} 
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      padding: '0.75rem 1rem',
                                      borderRadius: '10px',
                                      border: opt.isCorrect ? '1.5px solid #10b981' : '1px solid var(--outline-variant)',
                                      background: opt.isCorrect ? 'rgba(16, 185, 129, 0.06)' : 'var(--surface-container-high)',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <span 
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        fontSize: '0.8125rem',
                                        fontWeight: 800,
                                        background: opt.isCorrect ? '#10b981' : 'var(--outline-variant)',
                                        color: '#fff'
                                      }}
                                    >
                                      {opt.letter}
                                    </span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: opt.isCorrect ? 700 : 500, color: opt.isCorrect ? '#10b981' : 'var(--on-surface)' }}>
                                      {opt.text}
                                    </span>
                                    {opt.isCorrect && (
                                      <span style={{
                                        marginLeft: 'auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        color: '#10b981',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '6px'
                                      }}>
                                        <Icon name="check" size={12} /> Correct
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div style={{ 
                                marginTop: '0.5rem', 
                                padding: '0.75rem 1rem', 
                                background: 'rgba(16, 185, 129, 0.08)', 
                                border: '1px solid rgba(16, 185, 129, 0.2)', 
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <Icon name="check_circle" size={16} style={{ color: '#10b981' }} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                                  Correct Answer Key: <strong style={{ color: '#10b981', fontSize: '1rem', marginLeft: '0.25rem' }}>{q.correctAnswer || mcqOptions.find(o => o.isCorrect)?.letter || 'N/A'}</strong>
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Code Display */}
                          {q.type === 'CODE' && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {q.codeLanguage && (
                                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Language: <span style={{ fontFamily: 'monospace', color: 'var(--primary)', background: 'var(--surface-container-high)', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.875rem' }}>{q.codeLanguage}</span>
                                </div>
                              )}
                              {q.codeTemplate && (
                                <div>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Starter Code Template:</div>
                                  <pre style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.8125rem',
                                    padding: '1rem',
                                    background: 'var(--surface-container-highest)',
                                    color: 'var(--on-surface)',
                                    borderRadius: '10px',
                                    overflowX: 'auto',
                                    margin: 0,
                                    border: '1px solid var(--outline-variant)'
                                  }}>
                                    {q.codeTemplate}
                                  </pre>
                                </div>
                              )}
                              {testCases.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Test Cases:</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {testCases.map((tc, idx) => (
                                      <div key={idx} style={{ 
                                        padding: '0.75rem 1rem', 
                                        background: 'var(--surface-container-high)', 
                                        borderRadius: '10px', 
                                        fontSize: '0.8125rem', 
                                        border: '1px solid var(--outline-variant)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem'
                                      }}>
                                        <div style={{ fontWeight: 700, color: 'var(--primary)', borderBottom: '1px dashed var(--outline-variant)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>Test Case #{idx+1}</div>
                                        <div><strong style={{ color: 'var(--on-surface-variant)' }}>Input:</strong> <code style={{ fontFamily: 'monospace', padding: '0.1rem 0.3rem', background: 'var(--surface-container-highest)', borderRadius: '4px' }}>{tc.input || tc.Input || '(None)'}</code></div>
                                        <div><strong style={{ color: 'var(--on-surface-variant)' }}>Expected Output:</strong> <code style={{ fontFamily: 'monospace', padding: '0.1rem 0.3rem', background: 'var(--surface-container-highest)', borderRadius: '4px', color: '#10b981', fontWeight: 700 }}>{tc.output || tc.Output || tc.expectedOutput}</code></div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Subjective/Other Answer Guide */}
                          {q.type !== 'MCQ' && q.type !== 'CODE' && q.correctAnswer && (
                            <div style={{ 
                              marginTop: '1rem', 
                              padding: '1rem', 
                              borderRadius: '10px', 
                              background: 'rgba(16, 185, 129, 0.06)', 
                              border: '1px solid rgba(16, 185, 129, 0.2)' 
                            }}>
                              <span style={{ 
                                fontSize: '0.8125rem', 
                                fontWeight: 700, 
                                color: '#10b981', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.35rem', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em', 
                                marginBottom: '0.5rem' 
                              }}>
                                <Icon name="info" size={16} /> Reference Answer Guide / Solution
                              </span>
                              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5, color: 'var(--on-surface)' }}>{q.correctAnswer}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {exam.questions.length === 0 && (
                      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '12px' }}>
                        <Icon name="quiz" size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No questions added yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Question Form */}
                {exam.status === 'DRAFT' && (
                  <div style={{ background: 'var(--surface-container-highest)', padding: '1.5rem', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Add New Question</h3>
                    <form onSubmit={handleAddQuestion}>
                      <SelectInput 
                        label="Type" value={qForm.type} onChange={(e) => setQForm({...qForm, type: e.target.value})}
                        options={[{value: 'MCQ', label: 'Multiple Choice'}, {value: 'CODE', label: 'Coding'}]}
                      />
                      <FormTextarea 
                        label="Question Text" value={qForm.questionText} onChange={(e) => setQForm({...qForm, questionText: e.target.value})}
                        placeholder="Enter the question prompt..." rows={3} required
                      />
                      
                      {qForm.type === 'MCQ' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Options</label>
                          {['A', 'B', 'C', 'D'].map((opt, i) => (
                            <div key={opt} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <button 
                                type="button" 
                                onClick={() => setQForm({...qForm, correctAnswer: opt})}
                                style={{ 
                                  width: '32px', height: '32px', borderRadius: '4px', border: 'none',
                                  background: qForm.correctAnswer === opt ? 'var(--success)' : 'var(--outline-variant)',
                                  color: '#fff', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                {opt}
                              </button>
                              <FormInput 
                                value={qForm.options[i]} 
                                onChange={(e) => {
                                  const newOpts = [...qForm.options]
                                  newOpts[i] = e.target.value
                                  setQForm({...qForm, options: newOpts})
                                }}
                                placeholder={`Option ${opt}`}
                                style={{ marginBottom: 0, flex: 1 }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <FormInput label="Marks" type="number" value={qForm.marks} onChange={(e) => setQForm({...qForm, marks: e.target.value})} required />
                        <SelectInput label="Difficulty" value={qForm.difficulty} onChange={(e) => setQForm({...qForm, difficulty: e.target.value})} options={[{value:'EASY', label:'Easy'}, {value:'MEDIUM', label:'Medium'}, {value:'HARD', label:'Hard'}]} />
                      </div>

                      <SubmitButton style={{ marginTop: '1rem' }}>Save Question</SubmitButton>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Enroll Students</h3>
                <button 
                  className="btn-primary" 
                  disabled={selectedStudents.length === 0}
                  onClick={handleEnroll}
                >
                  Enroll Selected ({selectedStudents.length})
                </button>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input type="checkbox" onChange={(e) => {
                          if (e.target.checked) setSelectedStudents(deptStudents.map(s => s.id))
                          else setSelectedStudents([])
                        }} />
                      </th>
                      <th>USN</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStudents.map(s => {
                      const isEnrolled = exam.students.some(e => e.studentId === s.id)
                      return (
                        <tr key={s.id} style={{ opacity: isEnrolled ? 0.6 : 1 }}>
                          <td>
                            <input 
                              type="checkbox" 
                              disabled={isEnrolled}
                              checked={selectedStudents.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudents([...selectedStudents, s.id])
                                else setSelectedStudents(selectedStudents.filter(id => id !== s.id))
                              }}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.usn}</td>
                          <td>{s.name}</td>
                          <td>
                            {isEnrolled ? (
                              <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.75rem' }}>ENROLLED</span>
                            ) : (
                              <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem' }}>Available</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
