import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, FormTextarea, SubmitButton, Alert } from '@/components/common/FormComponents'
import api from '@/services/api'

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

export default function ExamDetail() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('questions')
  
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

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>
  if (!exam) return <div style={{ padding: '2rem' }}><Alert type="error" message="Exam not found." /></div>

  return (
    <DashboardLayout navItems={navItems}>
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className={`badge ${exam.status === 'SCHEDULED' ? 'badge-primary' : 'badge-success'}`}>
            {exam.status}
          </span>
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

        <div className="card-body">
          {activeTab === 'questions' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              {/* Question List */}
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                  Exam Questions ({exam.questions.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {exam.questions.map((q, i) => (
                    <div key={q.id} style={{ padding: '1.25rem', background: 'var(--surface-container-low)', borderRadius: '12px', border: '1px solid var(--outline-variant)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Q{i+1} • {q.type}</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>{q.marks} Marks</span>
                      </div>
                      <p style={{ fontWeight: 500, lineHeight: 1.5 }}>{q.questionText}</p>
                    </div>
                  ))}
                  {exam.questions.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '12px' }}>
                      <Icon name="quiz" size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>No questions added yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Add Question Form */}
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
