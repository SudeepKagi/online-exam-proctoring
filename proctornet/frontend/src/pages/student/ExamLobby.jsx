import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { getExamDetails } from '@/services/student.api'
import { Alert, InfoBox } from '@/components/common/FormComponents'

function Icon({ name, size = 20, style = {} }) {
  return (
    <span
      className="material-icon"
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  )
}

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/student/results', icon: 'military_tech', label: 'Results' },
]

export default function ExamLobby() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cameraStatus, setCameraStatus] = useState('checking') // checking, granted, denied
  const videoRef = useRef(null)

  useEffect(() => {
    fetchData()
    checkCamera()
  }, [id])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await getExamDetails(id)
      setExam(res.data.exam)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load exam details.')
    } finally {
      setLoading(false)
    }
  }

  const checkCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraStatus('granted')
      if (videoRef.current) videoRef.current.srcObject = stream
      // We don't stop it yet so user can see their preview
    } catch (err) {
      setCameraStatus('denied')
    }
  }

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [])

  if (loading) return (
    <DashboardLayout navItems={navItems}>
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    </DashboardLayout>
  )

  if (error) return (
    <DashboardLayout navItems={navItems}>
      <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <Alert type="danger" message={error} />
        <Link to="/student/exams" className="btn-secondary">Back to Exams</Link>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Lobby: {exam.title}</h1>
          <p className="page-subtitle">{exam.subject} — Prof. {exam.faculty.name}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        {/* Instructions */}
        <div className="card">
          <div className="card-header">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Exam Instructions</h2>
          </div>
          <div className="card-body" style={{ lineHeight: 1.6 }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
                Please read the following instructions carefully before starting the exam:
              </p>
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>This is a proctored exam. Your camera and screen will be monitored continuously.</li>
                <li>Do not switch tabs or minimize the browser window. Doing so will trigger a violation log.</li>
                <li>Ensure you are in a quiet, well-lit room with no other person present.</li>
                <li>Keep your face clearly visible to the camera at all times.</li>
                <li>The exam will automatically submit once the timer reaches zero.</li>
              </ul>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--surface-container)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Duration</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{exam.duration} Minutes</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--surface-container)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Marks</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{exam.totalMarks} Points</div>
              </div>
            </div>
          </div>
        </div>

        {/* Readiness Check */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Hardware Check</h2>
            </div>
            <div className="card-body">
              <div style={{ 
                width: '100%', 
                aspectRatio: '4/3', 
                background: '#000', 
                borderRadius: '8px', 
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '1rem'
              }}>
                {cameraStatus === 'granted' ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '2rem', textAlign: 'center' }}>
                    <Icon name={cameraStatus === 'denied' ? 'videocam_off' : 'sync'} size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <p>{cameraStatus === 'denied' ? 'Camera access denied. Please enable it in browser settings.' : 'Detecting camera...'}</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: cameraStatus === 'granted' ? 'var(--success-container)' : 'var(--error-container)', borderRadius: '8px', color: cameraStatus === 'granted' ? 'var(--on-success-container)' : 'var(--on-error-container)', fontSize: '0.875rem' }}>
                <Icon name={cameraStatus === 'granted' ? 'check_circle' : 'error'} size={20} />
                <span style={{ fontWeight: 600 }}>{cameraStatus === 'granted' ? 'Camera is ready' : 'Camera permission required'}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
              disabled={cameraStatus !== 'granted'}
              onClick={() => navigate(`/student/security-check/${id}`)}
            >
              Proceed to Verification <Icon name="verified_user" size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
              Next step: Identity Verification
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
