import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SelectInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { facultyRegister } from '@/services/auth.api'

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
      <AuthLayout title="Registration Submitted" icon="📬">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
          <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#60a5fa' }}>
            Waiting for Admin Approval
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Your faculty account registration has been submitted successfully.
            The admin will review your details and you will receive an email notification once approved.
          </p>
          <div style={{
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1.5rem',
            fontSize: '0.875rem', color: '#6ee7b7',
          }}>
            ✅ Registered as: <strong>{form.name}</strong> ({form.employeeId})
          </div>
          <Link to="/faculty/login" className="btn-primary" style={{
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
    <AuthLayout
      title="Faculty Registration"
      subtitle="Create your ProctorNet faculty account"
      icon="🎓"
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        {/* Two-column name + employee ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
          <FormInput
            id="f-name" label="Full Name" value={form.name}
            onChange={set('name')} placeholder="Dr. John Doe"
            error={errors.name} required
          />
          <FormInput
            id="f-empid" label="Employee ID" value={form.employeeId}
            onChange={set('employeeId')} placeholder="EMP001"
            error={errors.employeeId} required
          />
        </div>

        <FormInput
          id="f-email" label="College Email" type="email" value={form.email}
          onChange={set('email')} placeholder="yourname@college.edu"
          error={errors.email} required autoComplete="email"
        />

        <SelectInput
          id="f-dept" label="Department" value={form.department}
          onChange={set('department')} options={DEPARTMENTS}
          error={errors.department} required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
          <FormInput
            id="f-pass" label="Password" type="password" value={form.password}
            onChange={set('password')} placeholder="Min. 8 characters"
            error={errors.password} required autoComplete="new-password"
          />
          <FormInput
            id="f-cpass" label="Confirm Password" type="password" value={form.confirmPassword}
            onChange={set('confirmPassword')} placeholder="Repeat password"
            error={errors.confirmPassword} required autoComplete="new-password"
          />
        </div>

        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem',
          marginBottom: '1rem', fontSize: '0.8rem', color: '#93c5fd',
        }}>
          ℹ️ After registration, an admin will review and approve your account before you can login.
        </div>

        <SubmitButton loading={loading}>
          {loading ? 'Submitting…' : 'Submit Registration'}
        </SubmitButton>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        Already registered?{' '}
        <Link to="/faculty/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
          Login here
        </Link>
      </p>
    </AuthLayout>
  )
}
