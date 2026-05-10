import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, FormTextarea, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'

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

export default function CreateExam() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    title: '',
    courseCode: '',
    duration: '60',
    startTime: '',
    endTime: '',
    description: '',
    securityLevel: 'strict'
  })

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      navigate('/faculty/exams')
    }, 1500)
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/faculty/exams" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Icon name="arrow_back" style={{ fontSize: '1.25rem' }} /> Back to Exams
            </Link>
          </div>
          <h1 className="page-title">Create New Exam</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Main Configuration Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Exam Configuration</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <FormInput 
                  id="exam-title" label="Exam Title" value={form.title} onChange={set('title')}
                  placeholder="e.g. Data Structures Midterm" required
                />
                <FormInput 
                  id="course-code" label="Course Code" value={form.courseCode} onChange={set('courseCode')}
                  placeholder="e.g. CS301" required
                />
              </div>

              <FormTextarea 
                id="exam-desc" label="Instructions / Description" value={form.description} onChange={set('description')}
                placeholder="Enter instructions for students..." rows={3}
              />

              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', marginTop: '1.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--outline-variant)' }}>
                Timing & Schedule
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormInput 
                  id="start-time" label="Start Time" type="datetime-local" value={form.startTime} onChange={set('startTime')} required
                />
                <FormInput 
                  id="end-time" label="End Time" type="datetime-local" value={form.endTime} onChange={set('endTime')} required
                />
              </div>

              <SelectInput
                id="duration" label="Exam Duration" value={form.duration} onChange={set('duration')}
                options={[
                  { value: '30', label: '30 Minutes' },
                  { value: '45', label: '45 Minutes' },
                  { value: '60', label: '1 Hour' },
                  { value: '90', label: '1.5 Hours' },
                  { value: '120', label: '2 Hours' },
                  { value: '180', label: '3 Hours' },
                ]} required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn-secondary" style={{ marginRight: '1rem' }} onClick={() => navigate('/faculty/exams')}>
                  Cancel
                </button>
                <SubmitButton loading={loading} style={{ width: 'auto', marginTop: 0 }}>
                  <Icon name="save" /> Create Exam
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>

        {/* Security Settings Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Security Profile</h3>
            </div>
            <div className="card-body">
              <SelectInput
                id="sec-level" label="Proctoring Strictness" value={form.securityLevel} onChange={set('securityLevel')}
                options={[
                  { value: 'strict', label: 'Strict (High-Stakes)' },
                  { value: 'medium', label: 'Moderate (Standard)' },
                  { value: 'low', label: 'Lenient (Open Book)' },
                ]}
              />

              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ marginTop: '0.25rem', width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)' }}>Continuous Face Verification</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Flag if face is missing or unmatched</div>
                  </div>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ marginTop: '0.25rem', width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)' }}>Multiple Face Detection</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Flag if extra people enter the frame</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ marginTop: '0.25rem', width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)' }}>Browser Lock (VPN Focus)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Flag if focus is lost from exam tab</div>
                  </div>
                </label>
              </div>

            </div>
          </div>

          <InfoBox>
            Once created, you can assign questions from the Question Pool and specify eligible student batches.
          </InfoBox>

        </div>

      </div>
    </DashboardLayout>
  )
}
