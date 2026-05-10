import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'
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
      subtitle="Access your proctoring dashboard and manage active exam sessions."
    >
      {/* Role toggle */}
      <div className="role-toggle">
        <button type="button" className="role-toggle-btn active">Faculty</button>
        <Link to="/student/login" className="role-toggle-btn" style={{ textAlign: 'center', display: 'block', textDecoration: 'none', color: 'var(--on-surface-variant)' }}>
          Student
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Alert type="danger" message={error} />

        <FormInput
          id="faculty-email"
          label="Institutional Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="faculty@university.edu"
          autoComplete="email"
          prefixIcon="mail"
          required
        />

        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
            <label htmlFor="faculty-password" className="form-label" style={{ margin: 0 }}>Password</label>
            <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 500 }}>Forgot password?</a>
          </div>
          <FormInput
            id="faculty-password"
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

        <InfoBox>
          Registration requires admin approval. If you do not have an account, please contact your department administrator.
        </InfoBox>

        <SubmitButton loading={loading}>
          {loading ? 'Signing in…' : (
            <>Login to Dashboard &nbsp;→</>
          )}
        </SubmitButton>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
          New faculty member?{' '}
          <Link to="/faculty/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Register here
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
