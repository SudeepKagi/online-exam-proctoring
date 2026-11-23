import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { ShieldCheck, AlertCircle, LogIn, ExternalLink, Activity } from 'lucide-react'

export default function SebHandoffPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')
  const launchParam = searchParams.get('launch') || searchParams.get('token')
  const hasExchangedRef = useRef(false)

  const [loading, setLoading] = useState(Boolean(launchParam))
  const [errorData, setErrorData] = useState(() => {
    if (errorParam === 'missing_token') {
      return {
        code: 'MISSING_TOKEN',
        message: 'No launch token was received from the browser link.',
        refId: 'N/A'
      }
    }
    if (errorParam === 'invalid_token') {
      return {
        code: 'INVALID_TOKEN',
        message: 'The launch token was invalid or malformed.',
        refId: 'N/A'
      }
    }
    if (errorParam === 'expired') {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Your launch link has expired (links are valid for 5 minutes).',
        refId: 'N/A'
      }
    }
    if (errorParam === 'already_used') {
      return {
        code: 'TOKEN_ALREADY_USED',
        message: 'This launch link was already redeemed.',
        refId: 'N/A'
      }
    }
    return null
  })

  // 1. If already authenticated inside SEB, proceed to dashboard or active exam
  useEffect(() => {
    if (user && !launchParam) {
      navigate('/student/dashboard', { replace: true })
    }
  }, [user, launchParam, navigate])

  // 2. Automated token exchange when ?launch=TOKEN is provided
  useEffect(() => {
    if (!launchParam || hasExchangedRef.current) return
    hasExchangedRef.current = true

    async function attemptExchange() {
      setLoading(true)
      try {
        const res = await api.get(`/seb/exchange?launch=${encodeURIComponent(launchParam)}`)
        if (res.data?.success && res.data?.redirectUrl) {
          if (res.data.user) {
            try {
              localStorage.setItem('proctornet_logged_in', 'true')
              localStorage.setItem('user', JSON.stringify({ ...res.data.user, token: res.data.token }))
              if (res.data.user.role) localStorage.setItem('proctornet_role', res.data.user.role)
              if (res.data.user.email) localStorage.setItem('proctornet_email', res.data.user.email)
            } catch (_) {}
          }
          window.location.replace(res.data.redirectUrl)
          return
        }
      } catch (err) {
        const data = err.response?.data || {}
        const code = data.code || err.code || 'EXCHANGE_ERROR'
        const refId = data.requestId || 'N/A'
        const alreadyLoggedIn = localStorage.getItem('proctornet_logged_in') === 'true'

        if (alreadyLoggedIn && (code === 'TOKEN_ALREADY_USED' || code === 'TOKEN_EXPIRED')) {
          navigate('/student/dashboard', { replace: true })
          return
        }

        let message = 'Could not establish secure session with this launch link.'
        if (code === 'TOKEN_EXPIRED') {
          message = 'Your launch link has expired. Launch tokens are valid for 5 minutes.'
        } else if (code === 'TOKEN_ALREADY_USED') {
          message = 'This launch link has already been used.'
        } else if (code === 'INVALID_TOKEN') {
          message = 'Invalid or unrecognized launch token.'
        } else if (code === 'SEB_HEADER_MISSING') {
          message = 'Access restricted to Safe Exam Browser. Security configuration headers were not detected.'
        } else if (code === 'SEB_HEADER_MISMATCH') {
          message = 'Safe Exam Browser configuration check failed. Institutional Configuration Key mismatch.'
        } else if (code === 'INSTITUTION_NOT_CONFIGURED') {
          message = 'The institutional examination profile is not yet configured.'
        } else if (data.message) {
          message = data.message
        }

        setErrorData({ code, message, refId })
      } finally {
        setLoading(false)
      }
    }

    attemptExchange()
  }, [launchParam, navigate])

  return (
    <div className="min-h-screen bg-[#fbfcfd] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Header Icon & Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb] mb-3 shadow-none">
            {errorData ? (
              <AlertCircle className="w-6 h-6 text-[#c04b4b]" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-xl font-[480] tracking-tight text-[#28253b]">
            {loading ? 'Connecting Secure Session…' : errorData ? 'Launch Handoff Incomplete' : 'Secure Browser Ready'}
          </h2>
          <p className="mt-1 text-xs text-[#554e7b] font-[360]">
            {loading
              ? 'Verifying cryptographic security configuration with the examination server.'
              : errorData
                ? 'Your session could not be automatically connected from this link.'
                : 'Safe Exam Browser is active and verified.'}
          </p>
        </div>

        {/* Card Surface */}
        <div className="mt-6 bg-[#ffffff] py-6 px-5 sm:px-8 rounded-[16px] border border-[#c3c3cc]/20 shadow-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#5266eb] border-t-transparent animate-spin" />
              <p className="text-xs text-[#554e7b] font-[420]">
                Authenticating launch credentials…
              </p>
            </div>
          ) : errorData ? (
            <div className="space-y-4">
              {/* Error Alert Box */}
              <div className="p-3.5 rounded-[12px] bg-[#fbfbff] border-l-2 border-[#c04b4b] space-y-1.5">
                <p className="text-xs font-[480] text-[#c04b4b]">
                  {errorData.message}
                </p>
                <div className="flex items-center justify-between text-[11px] text-[#554e7b] font-[360] pt-1">
                  <span>Code: <code className="text-[#28253b] font-mono">{errorData.code}</code></span>
                  <span>Ref: <code className="text-[#28253b] font-mono">#{errorData.refId}</code></span>
                </div>
              </div>

              {/* Instructions on how to resume */}
              <div className="p-3 rounded-[12px] bg-[#fbfcfd] text-xs text-[#554e7b] font-[360] space-y-2">
                <p className="font-[420] text-[#28253b]">How to proceed:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#554e7b]">
                  <li>
                    <strong>From your regular browser:</strong> Return to Chrome/Edge and click <em>Launch Exam</em> again to get a fresh link.
                  </li>
                  <li>
                    <strong>Directly in this window:</strong> Sign in with your standard student email and password below.
                  </li>
                </ul>
              </div>

              {/* Action Buttons: Never a dead end */}
              <div className="space-y-2 pt-2">
                <Button
                  variant="primary"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => navigate('/login?manual=1')}
                  data-testid="seb-signin-fallback-btn"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with password
                </Button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <Link
                    to="/seb/diagnostics"
                    className="inline-flex items-center gap-1 text-[#5266eb] hover:underline font-[420]"
                    data-testid="seb-diagnostics-link"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Diagnostics
                  </Link>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/student/dashboard')}
                    className="text-xs text-[#554e7b] hover:text-[#28253b] p-0 h-auto font-[420]"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-xs text-[#554e7b] font-[360]">
                Safe Exam Browser environment is active and connected.
              </p>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate('/student/dashboard')}
              >
                Continue to Dashboard
              </Button>
            </div>
          )}
        </div>

        {/* Footer Support Link */}
        <p className="mt-6 text-center text-[11px] text-[#70707d] font-[360]">
          Institutional Online Examination System • Safe Exam Browser Integration
        </p>
      </div>
    </div>
  )
}
