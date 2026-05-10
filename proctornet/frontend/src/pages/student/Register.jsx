import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SelectInput, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'
import { studentRegister } from '@/services/auth.api'

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

const DEPARTMENTS = [
  { value: '', label: '— Select Department —' },
  { value: 'Computer Science & Engineering', label: 'CSE' },
  { value: 'Information Science & Engineering', label: 'ISE' },
  { value: 'Electronics & Communication', label: 'ECE' },
  { value: 'Electrical & Electronics', label: 'EEE' },
  { value: 'Mechanical Engineering', label: 'ME' },
  { value: 'Civil Engineering', label: 'CE' },
  { value: 'Artificial Intelligence & ML', label: 'AI & ML' },
  { value: 'Data Science', label: 'Data Science' },
]

const SEMESTERS = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1), label: `${i + 1}${['st','nd','rd','th','th','th','th','th'][i]} Semester`,
}))
SEMESTERS.unshift({ value: '', label: '— Select Semester —' })

const STEPS = ['Personal Info', 'Face Photo', 'ID Card', 'Review']

export default function StudentRegister() {
  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({
    name: '', usn: '', email: '', password: '', confirmPassword: '',
    department: '', semester: '',
  })
  const [errors, setErrors]     = useState({})
  const [facePhoto, setFacePhoto]   = useState(null)
  const [facePreview, setFacePreview] = useState(null)
  const [idCardPhoto, setIdCardPhoto] = useState(null)
  const [idCardPreview, setIdCardPreview] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(null)

  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const idFileRef = useRef(null)

  const set = (field) => (e) => {
    const val = field === 'usn' ? e.target.value.toUpperCase() : e.target.value
    setForm(prev => ({ ...prev, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  // ── Camera ─────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (e) {
      setError('Cannot access camera: ' + e.message)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const capturePhoto = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width  = videoRef.current.videoWidth  || 640
    canvas.height = videoRef.current.videoHeight || 480
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setFacePhoto(dataUrl)
    setFacePreview(dataUrl)
    stopCamera()
  }, [])

  const retakePhoto = () => {
    setFacePhoto(null)
    setFacePreview(null)
    startCamera()
  }

  // ── ID Card file upload ─────────────────────────
  const handleIdCardFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setIdCardPhoto(ev.target.result)
      setIdCardPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // ── Step validation ─────────────────────────────
  const validateStep0 = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Full name is required.'
    if (!form.usn.trim())   e.usn   = 'USN is required.'
    if (!/^[A-Z0-9]{8,12}$/.test(form.usn)) e.usn = 'USN format invalid (e.g. 1VE22CS001)'
    if (!form.email.trim()) e.email = 'Email is required.'
    if (!form.department)   e.department = 'Department is required.'
    if (!form.semester)     e.semester   = 'Semester is required.'
    if (form.password.length < 8) e.password = 'Minimum 8 characters.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    return e
  }

  const nextStep = () => {
    if (step === 0) {
      const e = validateStep0()
      if (Object.keys(e).length) { setErrors(e); return }
    }
    if (step === 1 && !facePhoto) {
      setError('Please capture your face photo before continuing.')
      return
    }
    if (step === 2 && !idCardPhoto) {
      setError('Please upload your ID card photo before continuing.')
      return
    }
    setError('')
    setStep(s => s + 1)
  }

  // ── Submit ──────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await studentRegister({
        name:           form.name.trim(),
        usn:            form.usn.trim(),
        email:          form.email.trim().toLowerCase(),
        password:       form.password,
        department:     form.department,
        semester:       form.semester,
        facePhotoBase64: facePhoto,
        idCardBase64:   idCardPhoto,
      })
      setSuccess(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
      setStep(0)
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ─────────────────────────────
  if (success) {
    const isPendingFaculty = success.status === 'PENDING_FACULTY'
    return (
      <AuthLayout title="Registration Submitted!" maxWidth="480px">
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: isPendingFaculty ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: isPendingFaculty ? 'var(--success)' : 'var(--warning)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name={isPendingFaculty ? 'hourglass_empty' : 'policy'} size={32} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.75rem' }}>
            {isPendingFaculty ? 'Awaiting Faculty Approval' : 'Under Admin Review'}
          </h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {isPendingFaculty
              ? 'Your registration is complete! Your faculty will approve your account before exams.'
              : 'Your identity match score was below threshold. Admin will manually verify your registration.'}
          </p>
          {success.matchScore && (
            <div style={{
              background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px',
              padding: '1rem', marginBottom: '1.5rem',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', alignItems: 'center'
            }}>
              <span style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>Face match score</span>
              <span className="badge badge-success" style={{ fontSize: '0.875rem' }}>
                {(success.matchScore * 100).toFixed(1)}%
              </span>
            </div>
          )}
          <Link to="/student/login" className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            Return to Login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout maxWidth="520px">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>
          Student Registration
        </h2>
        
        {/* Progress Timeline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 2, background: 'var(--surface-container-high)', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: 14, left: 0, height: 2, background: 'var(--primary)', zIndex: 0, transition: 'width 0.3s ease', width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.5rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i <= step ? 'var(--primary)' : 'var(--surface-container-lowest)',
                border: `2px solid ${i <= step ? 'var(--primary)' : 'var(--outline-variant)'}`,
                color: i <= step ? 'var(--on-primary)' : 'var(--outline)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.3s ease'
              }}>
                {i < step ? <Icon name="check" size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.6875rem', fontWeight: i === step ? 600 : 500, color: i <= step ? 'var(--on-surface)' : 'var(--outline)' }}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Alert type="danger" message={error} />

      {/* ── Step 0: Personal Info ── */}
      {step === 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <FormInput id="s-name" label="Full Name" value={form.name}
              onChange={set('name')} placeholder="e.g. John Doe" required />
            <FormInput id="s-usn" label="USN" value={form.usn}
              onChange={set('usn')} placeholder="e.g. 1VE22CS001" required />
          </div>
          <FormInput id="s-email" label="College Email" type="email" value={form.email}
            onChange={set('email')} placeholder="student@college.edu" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <SelectInput id="s-dept" label="Department" value={form.department}
              onChange={set('department')} options={DEPARTMENTS} required />
            <SelectInput id="s-sem" label="Semester" value={form.semester}
              onChange={set('semester')} options={SEMESTERS} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <FormInput id="s-pass" label="Password" type="password" value={form.password}
              onChange={set('password')} placeholder="Min 8 chars" required />
            <FormInput id="s-cpass" label="Confirm Password" type="password" value={form.confirmPassword}
              onChange={set('confirmPassword')} placeholder="Repeat password" required />
          </div>
        </div>
      )}

      {/* ── Step 1: Face Photo ── */}
      {step === 1 && (
        <div style={{ textAlign: 'center' }}>
          <InfoBox>
            Look directly at the camera in a well-lit area. This photo will be used for continuous identity verification during exams.
          </InfoBox>

          <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
            {!cameraActive && !facePreview && (
              <div 
                style={{ width: '100%', height: 240, border: '2px dashed var(--outline-variant)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', cursor: 'pointer', background: 'var(--surface-container-lowest)' }}
                onClick={startCamera}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-fixed)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="photo_camera" size={24} />
                </div>
                <span style={{ fontWeight: 500, color: 'var(--primary)' }}>Enable Camera</span>
              </div>
            )}

            {cameraActive && (
              <div style={{ width: '100%' }}>
                <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--primary)', marginBottom: '1rem', background: '#000' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
                  {/* Face guide overlay */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '180px', height: '240px', border: '2px dashed rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={capturePhoto} className="btn-primary" style={{ flex: 1 }}>
                    <Icon name="camera" /> Capture Photo
                  </button>
                  <button onClick={stopCamera} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {facePreview && !cameraActive && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={facePreview} alt="Face Preview" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: '50%', border: '4px solid var(--success)', marginBottom: '1rem' }} />
                <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Icon name="check_circle" size={18} /> Verified
                </div>
                <button onClick={retakePhoto} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>
                  <Icon name="refresh" /> Retake Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: ID Card ── */}
      {step === 2 && (
        <div style={{ textAlign: 'center' }}>
          <InfoBox>
            Upload a clear photo of your college ID card. Your USN must be readable for automated OCR verification.
          </InfoBox>

          <input type="file" ref={idFileRef} accept="image/*" onChange={handleIdCardFile} style={{ display: 'none' }} />

          <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
            {!idCardPreview ? (
              <div 
                onClick={() => idFileRef.current.click()}
                style={{ width: '100%', height: 200, border: '2px dashed var(--outline-variant)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', cursor: 'pointer', background: 'var(--surface-container-lowest)', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-container)', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="badge" size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>Upload ID Card</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--outline)' }}>PNG, JPG up to 10MB</div>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ padding: '1rem', border: '1px solid var(--outline-variant)', borderRadius: '12px', background: 'var(--surface-container-lowest)', marginBottom: '1rem' }}>
                  <img src={idCardPreview} alt="ID Card" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: '8px' }} />
                </div>
                <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Icon name="check_circle" size={18} /> Uploaded Successfully
                </div>
                <button onClick={() => idFileRef.current.click()} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>
                  <Icon name="upload" /> Choose Different Image
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            {facePreview && (
              <img src={facePreview} alt="Face" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--primary)' }} />
            )}
            {idCardPreview && (
              <img src={idCardPreview} alt="ID" style={{ height: 80, maxWidth: 140, objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--outline-variant)' }} />
            )}
          </div>

          <div style={{ background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            {[
              ['Full Name', form.name],
              ['USN', form.usn],
              ['Email', form.email],
              ['Department', form.department],
              ['Semester', `${form.semester}th`],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-container)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{value}</span>
              </div>
            ))}
          </div>

          <Alert type="info" message="By submitting, you confirm that the face photo and ID card are genuine and belong to you." />
          
          <SubmitButton loading={loading} onClick={handleSubmit} style={{ marginTop: '0' }}>
            {loading ? 'Verifying Identity…' : 'Submit Registration'}
          </SubmitButton>
        </div>
      )}

      {/* Navigation Buttons */}
      {step < 3 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', borderTop: '1px solid var(--outline-variant)', paddingTop: '1.5rem' }}>
          {step > 0 ? (
            <button type="button" onClick={() => { setStep(s => s - 1); setError('') }} className="btn-secondary">
              Back
            </button>
          ) : (
            <Link to="/student/login" style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
              Already have an account?
            </Link>
          )}

          <button type="button" onClick={nextStep} className="btn-primary" style={{ marginLeft: 'auto' }}>
            Continue <Icon name="arrow_forward" size={16} style={{ marginLeft: '0.25rem' }} />
          </button>
        </div>
      )}
      
      {step === 3 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}>
            Go back to edit details
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
