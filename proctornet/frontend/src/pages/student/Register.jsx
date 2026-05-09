import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SelectInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { studentRegister } from '@/services/auth.api'

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

// Step labels for the multi-step wizard
const STEPS = ['Personal Info', 'Face Photo', 'ID Card', 'Review & Submit']

export default function StudentRegister() {
  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({
    name: '', usn: '', email: '', password: '', confirmPassword: '',
    department: '', semester: '',
  })
  const [errors, setErrors]     = useState({})
  const [facePhoto, setFacePhoto]   = useState(null)  // base64
  const [facePreview, setFacePreview] = useState(null)
  const [idCardPhoto, setIdCardPhoto] = useState(null) // base64
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
      videoRef.current.srcObject = stream
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
      <AuthLayout title="Registration Submitted!" icon="🎉">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>
            {isPendingFaculty ? '⏳' : '🔍'}
          </div>
          <h3 style={{ fontWeight: 700, color: isPendingFaculty ? '#34d399' : '#fbbf24', marginBottom: '0.75rem' }}>
            {isPendingFaculty ? 'Awaiting Faculty Approval' : 'Under Admin Review'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {isPendingFaculty
              ? 'Your registration is complete! Your faculty will approve your account before exams.'
              : 'Your identity match score was below threshold. Admin will manually verify your registration.'}
          </p>
          {success.matchScore && (
            <div style={{
              background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)',
              padding: '0.75rem', marginBottom: '1rem',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem',
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Face match score</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>
                {(success.matchScore * 100).toFixed(1)}%
              </span>
            </div>
          )}
          <Link to="/student/login" className="btn-primary" style={{
            display: 'inline-block', padding: '0.625rem 1.5rem',
            textDecoration: 'none', borderRadius: 'var(--radius-md)',
          }}>
            Go to Login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh', padding: '2rem 1rem' }}>
      {/* Progress header */}
      <div style={{ maxWidth: '560px', margin: '0 auto 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: i < step ? '#34d399' : i === step ? '#60a5fa' : 'var(--color-bg-card)',
                border: `2px solid ${i < step ? '#34d399' : i === step ? '#60a5fa' : 'var(--color-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
                color: i <= step ? '#fff' : 'var(--color-text-muted)',
                transition: 'all 0.3s',
                marginBottom: '0.25rem',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '0.7rem', color: i === step ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: i === step ? 600 : 400, textAlign: 'center',
              }}>{s}</span>
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ height: '3px', background: 'var(--color-border)', borderRadius: '9999px', marginTop: '0.5rem' }}>
          <div style={{
            height: '100%', borderRadius: '9999px',
            background: 'linear-gradient(90deg, #34d399, #60a5fa)',
            width: `${(step / (STEPS.length - 1)) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Card */}
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
            }}>📝</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>Student Registration</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </div>
            </div>
          </div>

          <Alert type="error" message={error} />

          {/* ── Step 0: Personal Info ── */}
          {step === 0 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
                <FormInput id="s-name" label="Full Name" value={form.name}
                  onChange={set('name')} placeholder="Sudeep Kagi" error={errors.name} required />
                <FormInput id="s-usn" label="USN" value={form.usn}
                  onChange={set('usn')} placeholder="1VE22CS001" error={errors.usn} required />
              </div>
              <FormInput id="s-email" label="College Email" type="email" value={form.email}
                onChange={set('email')} placeholder="usn@college.edu" error={errors.email} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
                <SelectInput id="s-dept" label="Department" value={form.department}
                  onChange={set('department')} options={DEPARTMENTS} error={errors.department} required />
                <SelectInput id="s-sem" label="Semester" value={form.semester}
                  onChange={set('semester')} options={SEMESTERS} error={errors.semester} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
                <FormInput id="s-pass" label="Password" type="password" value={form.password}
                  onChange={set('password')} placeholder="Min 8 chars" error={errors.password} required />
                <FormInput id="s-cpass" label="Confirm Password" type="password" value={form.confirmPassword}
                  onChange={set('confirmPassword')} placeholder="Repeat" error={errors.confirmPassword} required />
              </div>
            </div>
          )}

          {/* ── Step 1: Face Photo ── */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                📸 Look directly at the camera in a well-lit area. This photo will be used for identity verification during exams.
              </p>

              {!cameraActive && !facePreview && (
                <button onClick={startCamera} className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
                  📷 Open Camera
                </button>
              )}

              {cameraActive && (
                <div>
                  <video ref={videoRef} autoPlay playsInline muted style={{
                    width: '100%', maxWidth: '360px', borderRadius: 'var(--radius-lg)',
                    border: '2px solid #60a5fa', marginBottom: '1rem',
                  }} />
                  <br />
                  <button onClick={capturePhoto} className="btn-primary" style={{ padding: '0.625rem 2rem', marginRight: '0.75rem' }}>
                    📸 Capture
                  </button>
                  <button onClick={stopCamera} className="btn-secondary" style={{ padding: '0.625rem 1rem' }}>
                    Cancel
                  </button>
                </div>
              )}

              {facePreview && !cameraActive && (
                <div>
                  <img src={facePreview} alt="Face" style={{
                    width: '200px', height: '200px', objectFit: 'cover',
                    borderRadius: '50%', border: '3px solid #34d399', marginBottom: '1rem',
                  }} />
                  <br />
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>✅ Photo captured</span>
                  </div>
                  <button onClick={retakePhoto} className="btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
                    🔄 Retake
                  </button>
                </div>
              )}

              <div style={{
                marginTop: '1.25rem', background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)',
                padding: '0.625rem', fontSize: '0.8rem', color: '#fde68a', textAlign: 'left',
              }}>
                ⚠️ Ensure your face is clearly visible, no sunglasses, good lighting, and face the camera directly.
              </div>
            </div>
          )}

          {/* ── Step 2: ID Card ── */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                🪪 Upload a clear photo of your college ID card. Your USN must be readable for OCR verification.
              </p>

              <input
                type="file" ref={idFileRef} accept="image/*"
                onChange={handleIdCardFile} style={{ display: 'none' }}
              />

              {!idCardPreview ? (
                <div
                  onClick={() => idFileRef.current.click()}
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '3rem 2rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '1rem',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🪪</div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click to upload ID card</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>JPG, PNG or WEBP • max 10MB</div>
                </div>
              ) : (
                <div>
                  <img src={idCardPreview} alt="ID Card" style={{
                    maxWidth: '100%', maxHeight: '200px', objectFit: 'contain',
                    borderRadius: 'var(--radius-md)', border: '2px solid #34d399',
                    marginBottom: '1rem',
                  }} />
                  <br />
                  <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '0.75rem' }}>✅ ID card uploaded</div>
                  <button onClick={() => idFileRef.current.click()} className="btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
                    🔄 Replace
                  </button>
                </div>
              )}

              <div style={{
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: 'var(--radius-md)', padding: '0.625rem', fontSize: '0.8rem',
                color: '#93c5fd', textAlign: 'left',
              }}>
                ℹ️ Make sure the ID card is flat, well-lit, and your USN is clearly visible.
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Submit ── */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {facePreview && (
                  <img src={facePreview} alt="Face" style={{
                    width: '80px', height: '80px', objectFit: 'cover',
                    borderRadius: '50%', border: '2px solid #34d399',
                  }} />
                )}
                {idCardPreview && (
                  <img src={idCardPreview} alt="ID" style={{
                    height: '80px', maxWidth: '140px', objectFit: 'contain',
                    borderRadius: 'var(--radius-md)', border: '2px solid #60a5fa',
                  }} />
                )}
              </div>

              <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                {[
                  ['Name',       form.name],
                  ['USN',        form.usn],
                  ['Email',      form.email],
                  ['Department', form.department],
                  ['Semester',   `${form.semester}th`],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '0.375rem 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                  }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>

              <Alert type="info" message="By submitting, you confirm that the face photo and ID card are genuine and belong to you." />

              <SubmitButton loading={loading} onClick={handleSubmit} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Submitting & Verifying…' : '🚀 Submit Registration'}
              </SubmitButton>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '0.75rem' }}>
            {step > 0 ? (
              <button onClick={() => { setStep(s => s - 1); setError('') }} className="btn-secondary"
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>
                ← Back
              </button>
            ) : (
              <Link to="/student/login" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Already registered? Login
              </Link>
            )}

            {step < 3 && (
              <button onClick={nextStep} className="btn-primary"
                style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem', marginLeft: 'auto' }}>
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
