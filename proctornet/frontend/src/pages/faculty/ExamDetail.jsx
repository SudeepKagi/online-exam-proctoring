import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, FormTextarea, SubmitButton, Alert } from '@/components/common/FormComponents'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'

import { 
  ArrowLeft, Key, HelpCircle, CheckCircle2, Check, Lock, 
  AlertTriangle, Copy, Upload, Sparkles, Settings, Info 
} from 'lucide-react'

const ICON_MAP = {
  arrow_back: ArrowLeft,
  key: Key,
  quiz: HelpCircle,
  check_circle: CheckCircle2,
  check: Check,
  lock: Lock,
  warning: AlertTriangle,
  content_copy: Copy,
  publish: Upload,
  bolt: Sparkles,
  auto_awesome: Sparkles,
  settings: Settings,
  info: Info
}

function Icon({ name, size = 20, style = {}, className = '' }) {
  const Component = ICON_MAP[name] || HelpCircle
  return <Component size={size} style={style} className={className} />
}

function getMCQOptions(q) {
  let opts = q.options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch (e) {
      console.error("Failed to parse options", e);
      opts = [];
    }
  }

  // Fallback: If options array is missing or empty, generate 4 default option slots
  if (!Array.isArray(opts) || opts.length === 0) {
    const rawText = q.questionText || '';
    const topicTag = rawText.includes('of ') ? rawText.split('of ').slice(-1)[0].replace('?', '').trim() : 'topic';
    opts = [
      `Core Principle of ${topicTag}`,
      'Secondary Execution Rule',
      'Deprecated Method',
      'External System Dependency'
    ];
  }

  while (opts.length < 4) {
    opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
  }

  const rawCorrect = String(q.correctAnswer ?? 'A').trim().toUpperCase();

  return opts.map((opt, index) => {
    const letter = String.fromCharCode(65 + index); // 'A', 'B', 'C', 'D'
    if (typeof opt === 'string') {
      const isCorrect = rawCorrect === letter || rawCorrect === opt || rawCorrect === String(index) || (index === 0 && (!q.correctAnswer || rawCorrect === '0' || rawCorrect === 'NULL'));
      return {
        letter,
        text: opt,
        isCorrect
      };
    } else if (opt && typeof opt === 'object') {
      const text = opt.text || opt.value || JSON.stringify(opt);
      const isCorrect = opt.isCorrect || rawCorrect === (opt.letter || letter) || rawCorrect === text || rawCorrect === String(index) || (index === 0 && (!q.correctAnswer || rawCorrect === '0' || rawCorrect === 'NULL'));
      return {
        letter: opt.letter || letter,
        text,
        isCorrect
      };
    }
    return { letter, text: String(opt), isCorrect: index === 0 };
  });
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
  const [showPublishModal, setShowPublishModal] = useState(false)
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

  // Settings form state
  const [settingsForm, setSettingsForm] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Enrollment & Results State
  const [deptStudents, setDeptStudents] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])
  const [resultsSearch, setResultsSearch] = useState('')

  useEffect(() => {
    fetchExam()
    fetchDeptStudents()
  }, [id])

  // Sync settingsForm from exam once loaded
  useEffect(() => {
    if (exam && !settingsForm) {
      setSettingsForm({
        title: exam.title || '',
        subject: exam.subject || '',
        description: exam.description || '',
        startTime: exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '',
        endTime: exam.endTime ? new Date(exam.endTime).toISOString().slice(0, 16) : '',
        duration: exam.duration || 60,
        tabSwitchLimit: exam.tabSwitchLimit ?? 3,
        cameraRequired: exam.cameraRequired ?? true,
        browserLock: exam.browserLock ?? true,
        fullScreenMode: exam.fullScreenMode ?? true,
        randomiseQuestions: exam.randomiseQuestions ?? true,
        randomiseOptions: exam.randomiseOptions ?? true,
        negativeMarking: exam.negativeMarking ?? false,
        negativeValue: exam.negativeValue ?? 0.25,
      })
    }
  }, [exam])

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
      toast.success('Question added successfully!')
    } catch (err) {
      toast.error('Error adding question')
    }
  }

  const handleEnroll = async () => {
    try {
      await api.post(`/faculty/exams/${id}/students`, { studentIds: selectedStudents })
      fetchExam()
      setSelectedStudents([])
      toast.success('Students enrolled successfully!')
    } catch (err) {
      toast.error('Error enrolling students')
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await api.patch(`/faculty/exams/${id}`, {
        ...settingsForm,
        startTime: settingsForm.startTime ? new Date(settingsForm.startTime).toISOString() : undefined,
        endTime: settingsForm.endTime ? new Date(settingsForm.endTime).toISOString() : undefined,
        duration: parseInt(settingsForm.duration),
        tabSwitchLimit: parseInt(settingsForm.tabSwitchLimit || 3),
        negativeValue: parseFloat(settingsForm.negativeValue || 0.25),
      })
      await fetchExam()
      toast.success('Exam settings saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handlePublish = () => {
    if (exam.questions.length === 0) {
      toast.error('Cannot publish exam with zero questions. Please add questions first.')
      return
    }
    setShowPublishModal(true)
  }

  const performPublish = async () => {
    try {
      const res = await api.patch(`/faculty/exams/${id}/publish`)
      setCredentials(res.data.invCredentials)
      setShowCredentialsModal(true)
      fetchExam()
      toast.success('Exam published successfully!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish exam.')
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
      toast.error(err.response?.data?.error || 'Could not retrieve credentials. They may have been reset.')
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>
  if (!exam) return <div style={{ padding: '2rem' }}><Alert type="error" message="Exam not found." /></div>

  return (
    <DashboardLayout navItems={navItems}>
      {showCredentialsModal && credentials && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px', border: '1px solid #e2e8f0',
            width: '100%', maxWidth: '520px', padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
            position: 'relative',
            color: '#0f172a'
          }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '0.35rem', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Icon name="key" size={22} style={{ color: '#4f46e5' }} /> Invigilator Access Credentials
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Provide these login credentials to the invigilator assigned to monitor this exam session.
            </p>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.875rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <p style={{ color: '#1e40af', fontSize: '0.8125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon name="info" size={16} /> SECURE INVIGILATION ACCESS
              </p>
              <p style={{ color: '#1e3a8a', fontSize: '0.8125rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
                The invigilator uses these credentials to access the live proctoring grid during the exam session.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', marginBottom: '1.75rem' }}>
              {/* Login Link */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>Invigilator Login URL</label>
                <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <input readOnly value={`${window.location.origin}/invigilator-login`} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#0f172a', fontWeight: 600, outline: 'none' }} />
                  <button onClick={() => copyToClipboard(`${window.location.origin}/invigilator-login`, 'url')} style={{ background: '#f1f5f9', border: 'none', borderLeft: '1.5px solid #cbd5e1', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4f46e5', fontWeight: 700 }}>
                    <Icon name={copiedField === 'url' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Exam ID */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>Exam UUID (Exam ID)</label>
                <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <input readOnly value={exam.id} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#0f172a', fontWeight: 600, outline: 'none' }} />
                  <button onClick={() => copyToClipboard(exam.id, 'examid')} style={{ background: '#f1f5f9', border: 'none', borderLeft: '1.5px solid #cbd5e1', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4f46e5', fontWeight: 700 }}>
                    <Icon name={copiedField === 'examid' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Invigilator ID */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>Invigilator ID</label>
                <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <input readOnly value={credentials.invId} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 1rem', fontSize: '0.9375rem', color: '#0f172a', fontWeight: 800, outline: 'none' }} />
                  <button onClick={() => copyToClipboard(credentials.invId, 'invid')} style={{ background: '#f1f5f9', border: 'none', borderLeft: '1.5px solid #cbd5e1', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4f46e5', fontWeight: 700 }}>
                    <Icon name={copiedField === 'invid' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>

              {/* Passcode */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>Temporary Passcode</label>
                <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                  <input readOnly value={credentials.password} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 1rem', fontSize: '0.9375rem', color: '#4f46e5', fontWeight: 800, letterSpacing: '0.08em', outline: 'none' }} />
                  <button onClick={() => copyToClipboard(credentials.password, 'pass')} style={{ background: '#f1f5f9', border: 'none', borderLeft: '1.5px solid #cbd5e1', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4f46e5', fontWeight: 700 }}>
                    <Icon name={copiedField === 'pass' ? 'check' : 'content_copy'} size={18} />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowCredentialsModal(false)} 
              style={{ 
                width: '100%', 
                padding: '0.875rem', 
                borderRadius: '12px', 
                fontSize: '0.875rem', 
                fontWeight: 700,
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* Top Back Link & Header Card */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link 
          to="/faculty/exams" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontSize: '0.875rem', 
            fontWeight: 800, 
            color: '#2f80ed', 
            textDecoration: 'none',
            marginBottom: '1rem'
          }}
        >
          <Icon name="arrow_back" size={16} /> Back to Exams
        </Link>

        <div style={{ 
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          padding: '1.5rem 2rem',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {exam.title}
              </h1>
              <span style={{ 
                padding: '0.25rem 0.75rem', 
                borderRadius: '9999px', 
                fontSize: '0.75rem', 
                fontWeight: 800, 
                border: '1px solid',
                background: ['SCHEDULED','PUBLISHED'].includes(exam.status) ? '#eff6ff' : exam.status === 'ACTIVE' ? '#ecfdf5' : '#f8fafc',
                color: ['SCHEDULED','PUBLISHED'].includes(exam.status) ? '#2f80ed' : exam.status === 'ACTIVE' ? '#10b981' : '#64748b',
                borderColor: ['SCHEDULED','PUBLISHED'].includes(exam.status) ? '#bfdbfe' : exam.status === 'ACTIVE' ? '#a7f3d0' : '#e2e8f0'
              }}>
                {exam.status}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: 600 }}>
              Subject Code: <strong style={{ color: '#0f172a' }}>{exam.subject}</strong> • Created Date: <strong style={{ color: '#0f172a' }}>{new Date(exam.startTime).toLocaleDateString()}</strong> • Duration: <strong style={{ color: '#0f172a' }}>{exam.duration} mins</strong> • Total Marks: <strong style={{ color: '#2f80ed' }}>{exam.totalMarks} Marks</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {(exam.status === 'SCHEDULED' || exam.status === 'PUBLISHED' || exam.status === 'ACTIVE' || exam.status === 'IN_PROGRESS') && (
              <button
                onClick={handleViewCredentials}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.75rem 1.25rem', 
                  fontSize: '0.875rem', 
                  background: '#eff6ff', 
                  border: '1.5px solid #bfdbfe', 
                  borderRadius: '12px', 
                  color: '#2f80ed', 
                  fontWeight: 800, 
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(47, 128, 237, 0.1)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon name="key" size={18} /> Invigilator Credentials
              </button>
            )}
            {(exam.status === 'DRAFT' || exam.status === 'SCHEDULED') && (
              <button 
                onClick={handlePublish} 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.75rem 1.25rem', 
                  fontSize: '0.875rem',
                  background: '#2f80ed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(47, 128, 237, 0.3)'
                }}
              >
                <Icon name="publish" size={18} /> Publish Exam
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ 
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        marginBottom: '2rem',
        overflow: 'hidden'
      }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem', padding: '0 1.75rem', background: '#f8fafc' }}>
          {[
            { id: 'questions', label: 'Questions' },
            { id: 'submissions', label: 'Student Results & Marks' },
            { id: 'settings', label: 'Settings' }
          ].map(t => (
            <button 
              key={t.id}
              style={{ 
                background: 'none', border: 'none', padding: '1rem 0', fontWeight: 800, 
                color: activeTab === t.id || (activeTab === 'enrollment' && t.id === 'submissions') ? '#2f80ed' : '#64748b', 
                borderBottom: activeTab === t.id || (activeTab === 'enrollment' && t.id === 'submissions') ? '3px solid #2f80ed' : '3px solid transparent', 
                cursor: 'pointer', fontSize: '0.9375rem'
              }}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.75rem 2rem' }}>
          {activeTab === 'questions' && (
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
                                background: '#4f46e5',
                                color: '#ffffff',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                              }}>
                                Q{i+1}
                              </span>
                              <span style={{ 
                                fontWeight: 800, 
                                fontSize: '0.8125rem',
                                color: '#1e40af',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: '#dbeafe',
                                border: '1px solid #bfdbfe',
                                padding: '0.3rem 0.65rem',
                                borderRadius: '6px'
                              }}>
                                {q.type}
                              </span>
                              {q.difficulty && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: q.difficulty === 'EASY' ? '#047857' : q.difficulty === 'MEDIUM' ? '#b45309' : '#b91c1c',
                                  background: q.difficulty === 'EASY' ? '#d1fae5' : q.difficulty === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
                                  border: q.difficulty === 'EASY' ? '1px solid #a7f3d0' : q.difficulty === 'MEDIUM' ? '1px solid #fde68a' : '1px solid #fca5a5',
                                  padding: '0.3rem 0.65rem',
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
                          {q.type === 'MCQ' && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Options:</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem' }}>
                                {mcqOptions.map((opt) => (
                                  <div 
                                    key={opt.letter} 
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      padding: '0.875rem 1.125rem',
                                      borderRadius: '12px',
                                      border: opt.isCorrect ? '1.5px solid #10b981' : '1.5px solid var(--outline-variant, #cbd5e1)',
                                      background: opt.isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-container-high, #f8fafc)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <span 
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        fontSize: '0.8125rem',
                                        fontWeight: 800,
                                        background: opt.isCorrect ? '#10b981' : '#475569',
                                        color: '#ffffff',
                                        flexShrink: 0
                                      }}
                                    >
                                      {opt.letter}
                                    </span>
                                    <span style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: opt.isCorrect ? 700 : 600, 
                                      color: opt.isCorrect ? '#047857' : 'var(--on-surface, #1e293b)',
                                      wordBreak: 'break-word',
                                      lineHeight: '1.4'
                                    }}>
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
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '6px',
                                        flexShrink: 0
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
                                  Correct Answer Key: <strong style={{ color: '#10b981', fontSize: '1rem', marginLeft: '0.25rem' }}>{mcqOptions.find(o => o.isCorrect)?.letter || q.correctAnswer || 'A'}</strong>
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
          {(activeTab === 'submissions' || activeTab === 'enrollment' || activeTab === 'results') && (
            <div style={{ maxWidth: '980px', margin: '0 auto' }}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '1.5rem',
                background: '#ffffff',
                padding: '1.25rem 1.5rem',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Student Submissions & Marks
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    Total Registered: {(exam.studentExams || []).length} • Attempted/Submitted: {(exam.studentExams || []).filter(s => s.status === 'COMPLETED' || s.status === 'SUBMITTED' || s.submittedAt).length} • Avg Score: {
                      (() => {
                        const done = (exam.studentExams || []).filter(s => s.examResult || s.status === 'COMPLETED' || s.status === 'SUBMITTED');
                        if (done.length === 0) return 'N/A';
                        const avg = done.reduce((acc, s) => acc + (s.examResult?.percentage || 0), 0) / done.length;
                        return `${avg.toFixed(1)}%`;
                      })()
                    }
                  </p>
                </div>

                <div style={{ position: 'relative', width: '280px' }}>
                  <input 
                    type="text" 
                    placeholder="Search USN, Student Name, or Status..."
                    value={resultsSearch}
                    onChange={(e) => setResultsSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>

              {/* Table Container Card */}
              <div style={{ 
                background: '#ffffff',
                borderRadius: '16px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
              }}>
                <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                        <th style={{ width: '48px', padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>USN</th>
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Name</th>
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attempt Status</th>
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Marks Obtained</th>
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Submission Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(exam.studentExams && exam.studentExams.length > 0 ? exam.studentExams : deptStudents.map(s => ({
                        id: s.id,
                        student: s,
                        status: 'NOT_ATTEMPTED',
                        submittedAt: null,
                        examResult: null
                      })))
                        .filter(se => {
                          const query = resultsSearch.toLowerCase().trim();
                          if (!query) return true;
                          const usn = (se.student?.usn || '').toLowerCase();
                          const name = (se.student?.name || '').toLowerCase();
                          const status = (se.status || '').toLowerCase();
                          return usn.includes(query) || name.includes(query) || status.includes(query);
                        })
                        .map((se, idx) => {
                          const isSubmitted = se.status === 'COMPLETED' || se.status === 'SUBMITTED' || Boolean(se.submittedAt);
                          const isInProgress = se.status === 'IN_PROGRESS';
                          const isFlagged = se.status === 'FLAGGED' || (se.flagCount && se.flagCount > 2);
                          const res = se.examResult;
                          const scoreText = res ? `${res.totalScore} / ${res.totalMarks || exam.totalMarks || '--'}` : isSubmitted ? `Submitted` : `-- / ${exam.totalMarks || 0}`;

                          return (
                            <tr 
                              key={se.id || idx} 
                              style={{ 
                                borderBottom: '1px solid #f1f5f9',
                                background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <td style={{ padding: '1rem 1.25rem', fontSize: '0.8125rem', fontWeight: 700, color: '#64748b' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '1rem 1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', fontSize: '0.875rem' }}>
                                {se.student?.usn || 'N/A'}
                              </td>
                              <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
                                {se.student?.name || 'Student'}
                              </td>
                              <td style={{ padding: '1rem 1.25rem' }}>
                                {isSubmitted ? (
                                  <span style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    color: '#047857', 
                                    background: '#d1fae5',
                                    border: '1px solid #a7f3d0',
                                    fontWeight: 800, 
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    <Icon name="check" size={12} /> Submitted
                                  </span>
                                ) : isInProgress ? (
                                  <span style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#1d4ed8', 
                                    background: '#dbeafe',
                                    border: '1px solid #bfdbfe',
                                    fontWeight: 800, 
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    In Progress
                                  </span>
                                ) : isFlagged ? (
                                  <span style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#b91c1c', 
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    fontWeight: 800, 
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Flagged
                                  </span>
                                ) : (
                                  <span style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    color: '#475569', 
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    fontWeight: 700, 
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Not Attempted
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                <span style={{ 
                                  fontWeight: 800, 
                                  fontSize: '0.9375rem',
                                  color: isSubmitted ? '#047857' : '#64748b'
                                }}>
                                  {scoreText}
                                </span>
                                {res?.percentage !== undefined && (
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                                    ({res.percentage.toFixed(1)}%)
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
                                {se.submittedAt ? new Date(se.submittedAt).toLocaleString() : 'Not Submitted'}
                              </td>
                            </tr>
                          )
                        })}

                      {(!exam.studentExams || exam.studentExams.length === 0) && deptStudents.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            No student submissions or results recorded yet for this exam.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && settingsForm && (
            <div style={{ maxWidth: '880px', margin: '0 auto' }}>
              <div style={{ 
                background: '#ffffff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                padding: '2rem'
              }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Icon name="settings" size={24} style={{ color: '#4f46e5' }} />
                    Exam Configuration & Security Settings
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
                    Manage exam details, scheduling timeframes, and AI proctoring enforcement rules.
                  </p>
                </div>

                {exam.status !== 'DRAFT' && exam.status !== 'SCHEDULED' && (
                  <div style={{ 
                    background: '#fffbe6', 
                    border: '1px solid #fde68a', 
                    borderRadius: '12px', 
                    padding: '1rem 1.25rem', 
                    marginBottom: '1.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <Icon name="warning" size={20} style={{ color: '#b45309', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Settings Locked ({exam.status})
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#78350f', marginTop: '0.15rem', fontWeight: 500 }}>
                        This exam is currently <strong>{exam.status}</strong>. Configuration settings are in read-only mode and cannot be edited.
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  {/* Basic Information */}
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      1. General Metadata
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          Exam Title
                        </label>
                        <input 
                          type="text"
                          value={settingsForm.title}
                          onChange={e => setSettingsForm(f => ({ ...f, title: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          required
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          Subject / Course
                        </label>
                        <input 
                          type="text"
                          value={settingsForm.subject}
                          onChange={e => setSettingsForm(f => ({ ...f, subject: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          Duration (Minutes)
                        </label>
                        <input 
                          type="number"
                          value={settingsForm.duration}
                          onChange={e => setSettingsForm(f => ({ ...f, duration: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Limits */}
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      2. Timeframe & Violation Limits
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          Start Time
                        </label>
                        <input 
                          type="datetime-local"
                          value={settingsForm.startTime}
                          onChange={e => setSettingsForm(f => ({ ...f, startTime: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          End Time
                        </label>
                        <input 
                          type="datetime-local"
                          value={settingsForm.endTime}
                          onChange={e => setSettingsForm(f => ({ ...f, endTime: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                          Tab Switch Violation Limit
                        </label>
                        <input 
                          type="number"
                          value={settingsForm.tabSwitchLimit}
                          onChange={e => setSettingsForm(f => ({ ...f, tabSwitchLimit: e.target.value }))}
                          disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            background: !['DRAFT','SCHEDULED'].includes(exam.status) ? '#f1f5f9' : '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Proctoring Rules */}
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      3. Security & Proctoring Controls
                    </div>
                    <div style={{ 
                      background: '#f8fafc', 
                      borderRadius: '14px', 
                      padding: '1.25rem 1.5rem', 
                      border: '1.5px solid #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        {[
                          ['cameraRequired', 'Webcam Monitoring'],
                          ['browserLock', 'Browser Lockdown'],
                          ['fullScreenMode', 'Enforce Fullscreen'],
                          ['randomiseQuestions', 'Randomise Questions'],
                          ['randomiseOptions', 'Randomise Options'],
                          ['negativeMarking', 'Negative Marking'],
                        ].map(([key, label]) => (
                          <label key={key} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.6rem', 
                            fontSize: '0.875rem', 
                            fontWeight: 700,
                            color: '#1e293b',
                            cursor: ['DRAFT','SCHEDULED'].includes(exam.status) ? 'pointer' : 'not-allowed' 
                          }}>
                            <input
                              type="checkbox"
                              checked={!!settingsForm[key]}
                              disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                              onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.checked }))}
                              style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      {settingsForm.negativeMarking && (
                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' }}>
                            Negative Marking Deduction (per incorrect answer)
                          </label>
                          <input 
                            type="number"
                            step="0.25"
                            value={settingsForm.negativeValue}
                            onChange={e => setSettingsForm(f => ({ ...f, negativeValue: e.target.value }))}
                            disabled={!['DRAFT','SCHEDULED'].includes(exam.status)}
                            style={{
                              width: '100%',
                              maxWidth: '300px',
                              padding: '0.65rem 1rem',
                              borderRadius: '8px',
                              border: '1.5px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontWeight: 700,
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {['DRAFT','SCHEDULED'].includes(exam.status) && (
                    <button 
                      type="submit"
                      disabled={settingsSaving}
                      style={{
                        padding: '0.875rem 2rem',
                        borderRadius: '12px',
                        fontSize: '0.9375rem',
                        fontWeight: 800,
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                        alignSelf: 'flex-start',
                        marginTop: '0.5rem'
                      }}
                    >
                      {settingsSaving ? 'Saving Changes…' : 'Save Configuration'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showPublishModal}
        onOpenChange={setShowPublishModal}
        title="Publish Examination?"
        description="Are you sure you want to publish this exam? Once published, questions cannot be modified, and invigilator credentials will be automatically generated."
        confirmText="Publish Exam"
        cancelText="Cancel"
        variant="default"
        onConfirm={performPublish}
      />
    </DashboardLayout>
  )
}
