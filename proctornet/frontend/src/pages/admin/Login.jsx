import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'
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
      subtitle="ProctorNet platform administration portal."
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert type="danger" message={error} />

        <InfoBox>
          Default credentials: <strong>admin@proctornet.com</strong> / <strong>Admin@2026</strong>
        </InfoBox>

        <FormInput
          id="admin-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="admin@proctornet.com"
          autoComplete="email"
          prefixIcon="mail"
          required
        />

        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
            <label htmlFor="admin-password" className="form-label" style={{ margin: 0 }}>Password</label>
            <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 500 }}>Forgot password?</a>
          </div>
          <FormInput
            id="admin-password"
            label=""
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            autoComplete="current-password"
            prefixIcon="lock"
            required
          />
        </div>

        <SubmitButton loading={loading}>
          {loading ? 'Signing in…' : 'Login to Dashboard →'}
        </SubmitButton>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
        Not an admin?{' '}
        <Link to="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Back to Home
        </Link>
      </p>
    </AuthLayout>
  )
}
