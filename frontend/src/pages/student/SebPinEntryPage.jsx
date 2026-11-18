import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function SebPinEntryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')
  const launchParam = searchParams.get('launch') || searchParams.get('token')
  const hasExchangedRef = useRef(false)

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoExchanging, setAutoExchanging] = useState(Boolean(launchParam))
  const [error, setError] = useState(() => {
    if (errorParam === 'missing_token') return 'Launch token was missing. Please enter your 6-digit launch code below.'
    if (errorParam === 'invalid_token') return 'Launch token was invalid. Please enter your 6-digit launch code below.'
    if (errorParam === 'expired') return 'Launch token expired. Please enter your 6-digit launch code below or generate a fresh link.'
    if (errorParam === 'already_used') return 'This launch link was already used. Please enter your 6-digit launch code below.'
    return ''
  })

  // 1. A signed-in user inside SEB goes straight to their exam or lobby
  useEffect(() => {
    if (user) {
      navigate('/student/dashboard', { replace: true })
    }
  }, [user, navigate])

  // 2. Auto-exchange when ?launch=TOKEN is forwarded by SEB 3.x
  useEffect(() => {
    if (!launchParam || user || hasExchangedRef.current) return
    hasExchangedRef.current = true
    let active = true

    async function attemptAutoExchange() {
      setAutoExchanging(true)
      try {
        const res = await api.get(`/seb/exchange?launch=${encodeURIComponent(launchParam)}`)
        if (active && res.data?.success && res.data?.redirectUrl) {
          if (res.data.user) {
            try {
              localStorage.setItem('proctornet_logged_in', 'true')
              localStorage.setItem('user', JSON.stringify(res.data.user))
              if (res.data.user.role) localStorage.setItem('proctornet_role', res.data.user.role)
              if (res.data.user.email) localStorage.setItem('proctornet_email', res.data.user.email)
            } catch (_) {}
          }
          window.location.href = res.data.redirectUrl
          return
        }
      } catch (err) {
        if (active) {
          const code = err.response?.data?.code || err.code
          const alreadyLoggedIn = localStorage.getItem('proctornet_logged_in') === 'true'
          if (alreadyLoggedIn && (code === 'TOKEN_ALREADY_USED' || code === 'TOKEN_EXPIRED')) {
            navigate('/student/dashboard', { replace: true })
            return
          }
          if (code === 'TOKEN_EXPIRED') {
            setError('Launch token has expired. Please enter the 6-digit code shown on your browser.')
          } else if (code === 'TOKEN_ALREADY_USED') {
            setError('Launch link was already used. Please enter the 6-digit code shown on your browser.')
          } else {
            setError('Could not connect with launch link. Please enter your 6-digit code below.')
          }
        }
      } finally {
        if (active) setAutoExchanging(false)
      }
    }

    attemptAutoExchange()
    return () => { active = false }
  }, [launchParam, user, navigate])

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
      const res = await api.post('/seb/exchange-pin', { pin: cleanPin })
      if (res.data?.success && res.data?.redirectUrl) {
        if (res.data.user) {
          try {
            localStorage.setItem('proctornet_logged_in', 'true')
            localStorage.setItem('user', JSON.stringify(res.data.user))
            if (res.data.user.role) localStorage.setItem('proctornet_role', res.data.user.role)
            if (res.data.user.email) localStorage.setItem('proctornet_email', res.data.user.email)
          } catch (_) {}
        }
        // Successful exchange: navigate to arena / lobby / check
        window.location.href = res.data.redirectUrl
      } else {
        setError('Exchange failed. Please check your code.')
      }
    } catch (err) {
      const data = err.response?.data || {}
      const code = data.code || data.error?.code || err.code
      const msg = data.message || data.error?.message || err.message
      const refId = data.requestId || 'N/A'

      if (code === 'TOO_MANY_ATTEMPTS' || code === 'RATE_LIMITED') {
        setError('Too many incorrect attempts. Please wait a minute before trying again.')
      } else if (code === 'PIN_EXPIRED' || code === 'CODE_EXPIRED') {
        setError('This launch code has expired (codes are valid for 5 minutes). Please return to your browser to generate a fresh code.')
      } else if (code === 'PIN_ALREADY_USED' || code === 'TOKEN_ALREADY_USED' || code === 'CODE_USED') {
        const alreadyLoggedIn = localStorage.getItem('proctornet_logged_in') === 'true'
        if (alreadyLoggedIn) {
          navigate('/student/dashboard', { replace: true })
          return
        }
        setError('This launch code has already been used. Please return to your browser to generate a fresh code.')
      } else if (code === 'INVALID_PIN' || code === 'INVALID_CODE') {
        setError('Wrong launch code. Please check the 6-digit code displayed on your primary browser.')
      } else if (
        code === 'INSTITUTION_NOT_CONFIGURED' ||
        code === 'STORAGE_UNAVAILABLE' ||
        code === 'SEB_HEADER_MISSING' ||
        code === 'SEB_HEADER_MISMATCH' ||
        code === 'SEB_ENFORCEMENT_FAILED'
      ) {
        setError(`The exam system isn't ready, tell your invigilator (Ref: #${refId})`)
      } else {
        setError(msg || `The exam system isn't ready, tell your invigilator (Ref: #${refId})`)
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

        {autoExchanging ? (
          <div className="py-8 text-center space-y-4" data-testid="seb-splash-connecting">
            <div className="w-10 h-10 border-2 border-[#5266eb] border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h2 className="text-base font-[480] tracking-tight text-[#28253b]">Connecting to your exam session...</h2>
              <p className="text-xs text-[#554e7b] font-[360] mt-1.5 leading-relaxed">
                Safe Exam Browser is authenticating with ProctorNet. You will be redirected momentarily.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-[480] tracking-tight text-[#28253b] mb-1">Enter Launch Code</h2>
              <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
                Enter the 6-digit code shown on your browser to connect this Safe Exam Browser session directly to your exam.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-[12px] bg-[#fbfbff] text-xs text-[#554e7b] font-[420] border-l-2 border-[#5266eb]">
                {typeof error === 'string' ? error : (error?.message || String(error))}
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

              <div className="flex flex-col gap-2 text-center pt-2">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => navigate('/login?manual=1')}
                  className="text-xs text-[#554e7b] hover:text-[#28253b]"
                >
                  Sign in with password instead
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => { window.location.href = '/student/dashboard' }}
                  className="text-xs text-[#554e7b] hover:text-[#28253b]"
                >
                  Return to Student Dashboard
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
