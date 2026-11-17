import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'

export default function SebPinEntryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    if (errorParam === 'missing_token') return 'Launch token was missing. Please enter your 6-digit launch code below.'
    if (errorParam === 'invalid_token') return 'Launch token was invalid. Please enter your 6-digit launch code below.'
    if (errorParam === 'expired') return 'Launch token expired. Please enter your 6-digit launch code below or generate a fresh link.'
    if (errorParam === 'already_used') return 'This launch link was already used. Please enter your 6-digit launch code below.'
    return ''
  })

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanPin = pin.trim()
    if (!/^\d{6}$/.test(cleanPin)) {
      setError('Please enter a valid 6-digit numeric launch code.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await api.post('/api/v1/seb/exchange-pin', { pin: cleanPin })
      if (res.data?.success && res.data?.redirectUrl) {
        // Successful exchange: navigate to arena / lobby / check
        window.location.href = res.data.redirectUrl
      } else {
        setError('Exchange failed. Please check your code.')
      }
    } catch (err) {
      const code = err.response?.data?.code
      const msg = err.response?.data?.message
      if (code === 'PIN_EXPIRED') {
        setError('This launch code has expired. Please return to your browser to generate a fresh one.')
      } else if (code === 'PIN_ALREADY_USED') {
        setError('This launch code has already been used. Please generate a new one.')
      } else if (code === 'INVALID_PIN') {
        setError('Invalid launch code. Please check the 6 digits displayed on your browser screen.')
      } else {
        setError(msg || 'Unable to verify launch code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] flex flex-col items-center justify-center p-6 text-[#28253b]">
      <div className="w-full max-w-md bg-[#ffffff] rounded-[24px] p-8 shadow-[0_4px_20px_rgba(40,37,59,0.04)]">
        {/* Brand / Shield Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-[480] tracking-tight text-[#28253b]">Safe Exam Browser</h1>
            <p className="text-xs text-[#554e7b] font-[420]">ProctorNet Secure Access</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-[480] tracking-tight text-[#28253b] mb-1">Enter Launch Code</h2>
          <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
            Enter the 6-digit code shown on your browser to connect this Safe Exam Browser session directly to your exam.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-[12px] bg-[#fbfbff] text-xs text-[#554e7b] font-[420] border-l-2 border-[#5266eb]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="seb-pin-input" className="block text-xs font-[500] uppercase tracking-wider text-[#554e7b] mb-2">
              6-Digit Code
            </label>
            <input
              id="seb-pin-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full h-12 text-center text-xl tracking-[0.3em] font-[480] bg-[#fbfbff] rounded-[16px] outline-none text-[#28253b] focus:ring-2 focus:ring-[#5266eb]/30 transition-all"
              autoFocus
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || pin.length !== 6}
            className="w-full"
          >
            {loading ? 'Verifying code...' : 'Continue to exam'}
          </Button>

          <div className="text-center pt-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-xs text-[#554e7b] hover:text-[#28253b]"
            >
              Sign in with institutional credentials instead
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
