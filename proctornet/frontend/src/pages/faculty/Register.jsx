import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SelectInput, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'
import { facultyRegister } from '@/services/auth.api'

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
  { value: 'Computer Science & Engineering', label: 'Computer Science & Engineering' },
  { value: 'Information Science & Engineering', label: 'Information Science & Engineering' },
  { value: 'Electronics & Communication', label: 'Electronics & Communication' },
  { value: 'Electrical & Electronics', label: 'Electrical & Electronics' },
  { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
  { value: 'Civil Engineering', label: 'Civil Engineering' },
  { value: 'Artificial Intelligence & ML', label: 'Artificial Intelligence & ML' },
  { value: 'Data Science', label: 'Data Science' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Physics', label: 'Physics' },
]

export default function FacultyRegister() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    department: '', employeeId: '',
  })
  const [errors, setErrors]   = useState({})
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
    setError('')
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())       e.name       = 'Full name is required.'
    if (!form.email.trim())      e.email      = 'Email is required.'
    if (!form.department)        e.department  = 'Department is required.'
    if (!form.employeeId.trim()) e.employeeId  = 'Employee ID is required.'
    if (form.password.length < 8) e.password  = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      await facultyRegister({
        name:       form.name.trim(),
        email:      form.email.trim().toLowerCase(),
        password:   form.password,
        department: form.department,
        employeeId: form.employeeId.trim().toUpperCase(),
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout title="Registration Submitted" maxWidth="480px">
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--primary-fixed)',
              color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="schedule" size={32} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.75rem' }}>
            Waiting for Admin Approval
          </h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Your faculty account registration has been submitted successfully.
            The admin will review your details and you will receive an email notification once approved.
          </p>
          
          <div style={{
            background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)',
            borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem',
            fontSize: '0.875rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center'
          }}>
            <Icon name="verified" size={18} style={{ color: 'var(--primary)' }} />
            <span>Registered as: <strong>{form.name}</strong> ({form.employeeId})</span>
          </div>

          <Link to="/faculty/login" className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            Return to Login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Faculty Registration"
      subtitle="Create your ProctorNet faculty account to monitor exams and manage students."
      maxWidth="520px"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert type="danger" message={error} />

        {/* Two-column name + employee ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <FormInput
            id="f-name" label="Full Name" value={form.name}
            onChange={set('name')} placeholder="e.g. Dr. John Doe" required
          />
          <FormInput
            id="f-empid" label="Employee ID" value={form.employeeId}
            onChange={set('employeeId')} placeholder="e.g. EMP001" required
          />
        </div>

        <FormInput
          id="f-email" label="Institutional Email" type="email" value={form.email}
          onChange={set('email')} placeholder="faculty@university.edu" required autoComplete="email"
          prefixIcon="mail"
        />

        <SelectInput
          id="f-dept" label="Department" value={form.department}
          onChange={set('department')} options={DEPARTMENTS} required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <FormInput
            id="f-pass" label="Password" type="password" value={form.password}
            onChange={set('password')} placeholder="Min. 8 chars" required autoComplete="new-password"
            prefixIcon="lock"
          />
          <FormInput
            id="f-cpass" label="Confirm Password" type="password" value={form.confirmPassword}
            onChange={set('confirmPassword')} placeholder="Repeat password" required autoComplete="new-password"
            prefixIcon="lock"
          />
        </div>

        <InfoBox>
          After registration, an admin will review and approve your account before you can log in.
        </InfoBox>

        <SubmitButton loading={loading}>
          {loading ? 'Submitting Registration…' : 'Submit Registration'}
        </SubmitButton>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
        Already registered?{' '}
        <Link to="/faculty/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
          Login here
        </Link>
      </p>
    </AuthLayout>
  )
}
