import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { studentLogin } from '@/services/auth.api'

const STATUS_MESSAGES = {
  PENDING_FACULTY: 'Your account is awaiting approval from your faculty. Please check back later.',
  PENDING_ADMIN:   'Your account is under admin review due to identity verification. Please wait.',
  REJECTED:        'Your registration was not approved. Contact the admin for more information.',
  SUSPENDED:       'Your account has been suspended. Please contact the admin.',
}

export default function StudentLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm]       = useState({ usn: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value.toUpperCase() }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.usn || !form.password) {
      setError('Please enter your USN and password.')
      return
    }
    setLoading(true)
    try {
      const res = await studentLogin(form.usn.trim(), form.password)
      login(res.data.user, res.data.token)
      navigate('/student/dashboard')
    } catch (err) {
      const status = err.response?.data?.status
      setError(STATUS_MESSAGES[status] || err.response?.data?.error || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Student Login"
      subtitle="Access your exam portal"
      icon="📝"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        <FormInput
          id="student-usn"
          label="USN (University Seat Number)"
          type="text"
          value={form.usn}
          onChange={set('usn')}
          placeholder="e.g. 1VE22CS001"
          autoComplete="username"
          required
          hint="Enter your USN in uppercase"
        />

        <FormInput
          id="student-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => { setForm(p => ({ ...p, password: e.target.value })); setError('') }}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <SubmitButton loading={loading}>
          {loading ? 'Signing in…' : 'Sign In to Exam Portal'}
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          New student?{' '}
          <Link to="/student/register" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>
            Register with face verification
          </Link>
        </p>
        <Link to="/" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </AuthLayout>
  )
}
