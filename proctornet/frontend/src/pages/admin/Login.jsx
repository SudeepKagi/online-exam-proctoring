import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { adminLogin } from '@/services/auth.api'

export default function AdminLogin() {
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
      const res = await adminLogin(form.email.trim(), form.password)
      login(res.data.user, res.data.token)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Admin Login"
      subtitle="ProctorNet platform administration"
      icon="⚙️"
    >
      {/* Quick-fill hint */}
      <div style={{
        background: 'rgba(167,139,250,0.08)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '0.625rem 0.875rem',
        marginBottom: '1.25rem',
        fontSize: '0.8rem',
        color: '#c4b5fd',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span>🔑</span>
        <span>
          Default: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>admin@proctornet.com</code>
          {' / '}
          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>Admin@123</code>
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        <FormInput
          id="admin-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="admin@proctornet.com"
          autoComplete="email"
          required
        />

        <FormInput
          id="admin-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={set('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <SubmitButton loading={loading}>
          {loading ? 'Signing in…' : 'Sign In as Admin'}
        </SubmitButton>
      </form>

      <p style={{
        textAlign: 'center', marginTop: '1.25rem',
        fontSize: '0.8125rem', color: 'var(--color-text-muted)',
      }}>
        Not an admin?{' '}
        <Link to="/" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
          Back to Home
        </Link>
      </p>
    </AuthLayout>
  )
}
