import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/common/AuthLayout'
import { FormInput, SubmitButton, Alert } from '@/components/common/FormComponents'
import { invigilatorLogin } from '@/services/auth.api'

export default function InvigilatorLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm]       = useState({ invId: '', invPassword: '', examId: '' })
  const [idCard, setIdCard]   = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleIdFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIdCard(file)
    setIdPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.invId || !form.invPassword || !form.examId) {
      setError('All fields are required.')
      return
    }

    const data = new FormData()
    data.append('invId',       form.invId.trim())
    data.append('invPassword', form.invPassword)
    data.append('examId',      form.examId.trim())
    if (idCard) data.append('idCard', idCard)

    setLoading(true)
    try {
      const res = await invigilatorLogin(data)
      login({ role: 'invigilator', ...res.data.session }, res.data.token)
      navigate('/invigilator/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials and exam ID.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Invigilator Login"
      subtitle="Physical invigilator exam session access"
      icon="👁️"
    >
      <Alert type="info" message="Your Invigilator ID and password are provided by the faculty who created the exam." />

      <form onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        <FormInput
          id="inv-id" label="Invigilator ID" value={form.invId}
          onChange={set('invId')} placeholder="e.g. INV-AB12CD" required
        />

        <FormInput
          id="inv-pass" label="Exam Password" type="password" value={form.invPassword}
          onChange={set('invPassword')} placeholder="8-character password" required
        />

        <FormInput
          id="inv-exam" label="Exam ID" value={form.examId}
          onChange={set('examId')} placeholder="Paste the exam UUID" required
          hint="Get this from the faculty or exam schedule"
        />

        {/* Optional ID card */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block', fontSize: '0.8125rem', fontWeight: 600,
            color: 'var(--color-text-secondary)', marginBottom: '0.375rem',
          }}>
            Your ID Card <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input type="file" ref={fileRef} accept="image/*" onChange={handleIdFile} style={{ display: 'none' }} />
          {idPreview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={idPreview} alt="ID" style={{ height: '48px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
              <button type="button" onClick={() => fileRef.current.click()} className="btn-secondary"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>
                Replace
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current.click()} className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', width: '100%' }}>
              📎 Upload ID Card
            </button>
          )}
        </div>

        <SubmitButton loading={loading}>
          {loading ? 'Verifying…' : '🔓 Enter Exam Session'}
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
