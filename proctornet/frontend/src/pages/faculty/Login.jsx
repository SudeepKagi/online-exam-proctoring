import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { facultyLogin } from '@/services/auth.api'

export default function FacultyLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please enter both email and password.')
      return
    }
    setLoading(true)
    try {
      const res = await facultyLogin(form.email.trim(), form.password)
      login(res.data.user, res.data.token)
      navigate('/faculty/dashboard')
    } catch (err) {
      const status = err.response?.data?.status
      if (status === 'PENDING_APPROVAL') {
        setError('Your account is pending admin approval. You will be notified by email once approved.')
      } else if (status === 'SUSPENDED') {
        setError('Your account has been suspended. Please contact the admin.')
      } else {
        setError(err.response?.data?.error || 'Login failed. Check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Faculty Login"
      subtitle="Access your exam management portal"
      icon="🎓"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        <FormInput
          id="faculty-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="yourname@college.edu"
          autoComplete="email"
          required
        />

        <FormInput
          id="faculty-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={set('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <SubmitButton loading={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          New faculty member?{' '}
          <Link to="/faculty/register" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
            Register here
          </Link>
        </p>
        <Link to="/" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </AuthLayout>
  )
}
