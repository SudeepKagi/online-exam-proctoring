import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  Download,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Laptop,
  KeyRound,
  RefreshCw,
  HelpCircle,
  ArrowLeft
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

export default function StudentSebCheckPage() {
  const [searchParams] = useSearchParams()
  const isDirectVerified = searchParams.get('verified') === '1'

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({
    checked: false,
    lastCheckedAt: null,
    sebVersion: null,
    institutionSeb: {
      configured: false,
      effectiveMode: 'off',
      requestedMode: 'off',
      lastVerifiedAt: null
    }
  })

  // Accordion state
  const [openFaq, setOpenFaq] = useState(null)

  // Launch & Polling State
  const [launching, setLaunching] = useState(false)
  const [launchData, setLaunchData] = useState(null)
  const [pollCountdown, setPollCountdown] = useState(0)
  const [pollError, setPollError] = useState(null)
  const pollTimerRef = useRef(null)

  // Fetch initial student check status
  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/seb/student-check-status')
      if (res.data) {
        setStatus(res.data)
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [])

  // Start test launch
  const handleStartTest = async () => {
    setLaunching(true)
    setPollError(null)
    try {
      const res = await apiClient.post('/seb/launch-link', { purpose: 'check' })
      const data = res.data
      setLaunchData(data)
      setPollCountdown(120)

      // Automatically trigger protocol handler after a brief buffer so the student can read the 6-digit PIN
      const targetUrl = data.url || data.launchUrl
      if (targetUrl) {
        setTimeout(() => {
          window.location.href = targetUrl
        }, 3500)
      }

      // Begin polling token status
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      const token = data.exchangeToken || data.launchToken || data.token
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await apiClient.get(`/seb/token-status/${token}`)
          if (pollRes.data?.consumed) {
            clearInterval(pollTimerRef.current)
            setLaunchData(null)
            setPollCountdown(0)
            await fetchStatus()
          }
        } catch {
          // Continue polling until countdown expires
        }
      }, 2000)
    } catch (err) {
      setPollError(err?.response?.data?.message || 'Unable to generate test launch link. Please try again.')
    } finally {
      setLaunching(false)
    }
  }

  // Poll countdown decrement
  useEffect(() => {
    if (pollCountdown <= 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    const timer = setTimeout(() => {
      setPollCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [pollCountdown])

  const toggleFaq = (key) => {
    setOpenFaq((prev) => (prev === key ? null : key))
  }

  const isVerified = status.checked || isDirectVerified

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] pb-24 font-sans selection:bg-[#5266eb]/10">
      {/* Top Header */}
      <header className="border-b border-[#c3c3cc]/30 bg-[#ffffff]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/student/dashboard"
              className="flex items-center gap-1.5 text-sm text-[#554e7b] hover:text-[#28253b] font-normal transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-[#c3c3cc]">/</span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#5266eb]" />
              <h1 className="text-sm font-medium tracking-tight text-[#28253b]">
                Safe Exam Browser Setup
              </h1>
            </div>
          </div>
          <Link
            to="/student/dashboard"
            className="text-xs font-normal text-[#5266eb] hover:underline"
          >
            My Exams
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-8">
        {/* Status Hero Card */}
        <section className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-[#c3c3cc]/20 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium tracking-wider uppercase text-[#554e7b]">
                  Readiness Status
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-normal bg-[#5266eb]/10 text-[#5266eb]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified & Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-normal bg-[#edecfb] text-[#554e7b]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Setup Required
                  </span>
                )}
              </div>
              <h2 className="text-xl font-normal text-[#28253b] tracking-tight">
                {isVerified
                  ? 'Safe Exam Browser is verified on this device'
                  : 'Prepare your computer for proctored exams'}
              </h2>
              <p className="text-xs text-[#554e7b] max-w-xl font-normal leading-relaxed">
                {isVerified
                  ? `Your device was successfully verified on ${status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleDateString() : 'recent check'}${status.sebVersion ? ` (${status.sebVersion})` : ''}. You are ready to launch proctored exams.`
                  : 'Follow the 3 quick steps below to install and test Safe Exam Browser before your scheduled exams.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartTest}
                disabled={launching}
                className="gap-2"
              >
                {launching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Laptop className="w-3.5 h-3.5" />
                )}
                <span>{isVerified ? 'Retest Setup' : 'Test My Setup'}</span>
              </Button>
            </div>
          </div>

          {/* Institutional Mode Notice */}
          <div className="mt-5 pt-4 border-t border-[#c3c3cc]/20 flex items-center justify-between text-xs text-[#554e7b] font-normal">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5266eb]" />
              <span>
                Institution policy:{' '}
                {status.institutionSeb.effectiveMode === 'enforce' ? (
                  <strong className="text-[#28253b] font-medium">Strictly Enforced</strong>
                ) : status.institutionSeb.effectiveMode === 'audit' ? (
                  <strong className="text-[#28253b] font-medium">Audit Mode</strong>
                ) : (
                  <strong className="text-[#28253b] font-medium">Optional</strong>
                )}
              </span>
            </div>
            <span>Windows 10 / 11 Supported</span>
          </div>
        </section>

        {/* Active Test Polling Modal / Banner */}
        {launchData && pollCountdown > 0 && (
          <section className="bg-[#edecfb] rounded-2xl p-6 space-y-4 border border-[#5266eb]/20 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-medium tracking-wider uppercase text-[#5266eb]">
                  Testing Connection ({pollCountdown}s)
                </span>
                <h3 className="text-base font-normal text-[#28253b]">
                  Safe Exam Browser is opening...
                </h3>
                <p className="text-xs text-[#554e7b] font-normal leading-relaxed">
                  When prompted by your browser, click <strong className="font-medium text-[#28253b]">Open Safe Exam Browser</strong>.
                  This page will automatically update once the secure handshake completes.
                </p>
              </div>
              <RefreshCw className="w-4 h-4 text-[#5266eb] animate-spin shrink-0 mt-1" />
            </div>

            {/* Direct Link + PIN Fallback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#ffffff] rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-normal text-[#554e7b] block">Option A: Direct Protocol</span>
                <a
                  href={launchData.url || launchData.launchUrl}
                  className="inline-flex items-center gap-1.5 text-xs text-[#5266eb] hover:underline font-normal"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Click here to launch SEB directly</span>
                </a>
              </div>

              <div className="bg-[#ffffff] rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-normal text-[#554e7b] block">Option B: 6-Digit Launch PIN</span>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#5266eb]" />
                  <span className="font-mono text-base font-medium tracking-wider text-[#28253b]">
                    {launchData.pin || '------'}
                  </span>
                </div>
                <span className="text-[10px] text-[#554e7b] block font-normal">
                  If SEB asks for a launch code, enter these 6 digits.
                </span>
              </div>
            </div>
          </section>
        )}

        {pollError && (
          <div className="bg-[#ffffff] border border-[#c3c3cc]/40 rounded-xl p-4 text-xs text-[#554e7b] font-normal flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#5266eb]" />
            <span>{pollError}</span>
          </div>
        )}

        {/* Step 1: Download */}
        <section className="bg-[#ffffff] rounded-2xl p-6 border border-[#c3c3cc]/20 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center text-xs font-normal">
                1
              </span>
              <div>
                <h3 className="text-base font-normal text-[#28253b]">
                  Download & Install Safe Exam Browser
                </h3>
                <p className="text-xs text-[#554e7b] font-normal">
                  Official release for Windows 10 and 11 (64-bit)
                </p>
              </div>
            </div>
            <a
              href="https://safeexambrowser.org/download_en.html"
              target="_blank"
              rel="noreferrer"
              className="h-9 px-4 rounded-full bg-[#5266eb]/10 hover:bg-[#5266eb]/20 text-[#5266eb] text-xs font-normal flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SEB 3.8.0</span>
            </a>
          </div>

          <div className="bg-[#fbfbff] rounded-xl p-4 border border-[#c3c3cc]/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[#28253b] font-medium block">Fullscreen Lockdown</span>
              <p className="text-[#554e7b] font-normal leading-relaxed">
                Prevents switching apps, screen sharing, and notifications during exams.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[#28253b] font-medium block">Seamless Handoff</span>
              <p className="text-[#554e7b] font-normal leading-relaxed">
                You will not need to retype your login password inside Safe Exam Browser.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[#28253b] font-medium block">Clean Exit</span>
              <p className="text-[#554e7b] font-normal leading-relaxed">
                Once submitted or test complete, SEB closes cleanly back to your regular desktop.
              </p>
            </div>
          </div>
        </section>

        {/* Step 2: Troubleshooting Guide Accordion */}
        <section className="bg-[#ffffff] rounded-2xl p-6 border border-[#c3c3cc]/20 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center text-xs font-normal">
              2
            </span>
            <div>
              <h3 className="text-base font-normal text-[#28253b]">
                Installation & Common Questions
              </h3>
              <p className="text-xs text-[#554e7b] font-normal">
                Quick fixes for common Windows prompts
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {/* Item 1 */}
            <div className="border-b border-[#c3c3cc]/20 pb-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleFaq('smartscreen')}
                className="w-full flex items-center justify-between text-left py-1 text-xs text-[#28253b] font-normal hover:text-[#5266eb] h-auto rounded-lg"
              >
                <span>What if Windows Defender SmartScreen shows &quot;Windows protected your PC&quot;?</span>
                {openFaq === 'smartscreen' ? (
                  <ChevronUp className="w-4 h-4 text-[#554e7b]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#554e7b]" />
                )}
              </Button>
              {openFaq === 'smartscreen' && (
                <p className="text-xs text-[#554e7b] font-normal mt-2 leading-relaxed pl-2 border-l border-[#5266eb]/30">
                  Click <strong className="font-medium text-[#28253b]">More info</strong> and then click <strong className="font-medium text-[#28253b]">Run anyway</strong>. Safe Exam Browser is official open-source software built by ETH Zurich and used by universities globally.
                </p>
              )}
            </div>

            {/* Item 2 */}
            <div className="border-b border-[#c3c3cc]/20 pb-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleFaq('runtime')}
                className="w-full flex items-center justify-between text-left py-1 text-xs text-[#28253b] font-normal hover:text-[#5266eb] h-auto rounded-lg"
              >
                <span>Do I need .NET Desktop Runtime or Microsoft Edge WebView2?</span>
                {openFaq === 'runtime' ? (
                  <ChevronUp className="w-4 h-4 text-[#554e7b]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#554e7b]" />
                )}
              </Button>
              {openFaq === 'runtime' && (
                <p className="text-xs text-[#554e7b] font-normal mt-2 leading-relaxed pl-2 border-l border-[#5266eb]/30">
                  The standard SEB installer automatically installs any missing dependencies. Most modern Windows 10 and 11 systems already have WebView2 preinstalled.
                </p>
              )}
            </div>

            {/* Item 3 */}
            <div className="pb-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleFaq('running')}
                className="w-full flex items-center justify-between text-left py-1 text-xs text-[#28253b] font-normal hover:text-[#5266eb] h-auto rounded-lg"
              >
                <span>SEB shows &quot;Another instance of Safe Exam Browser is already running&quot;</span>
                {openFaq === 'running' ? (
                  <ChevronUp className="w-4 h-4 text-[#554e7b]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#554e7b]" />
                )}
              </Button>
              {openFaq === 'running' && (
                <p className="text-xs text-[#554e7b] font-normal mt-2 leading-relaxed pl-2 border-l border-[#5266eb]/30">
                  Open Task Manager (Ctrl + Shift + Esc), find <strong className="font-medium text-[#28253b]">SafeExamBrowser</strong> under Background processes, click <strong className="font-medium text-[#28253b]">End task</strong>, and retry your test.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Step 3: Test My Setup */}
        <section className="bg-[#ffffff] rounded-2xl p-6 border border-[#c3c3cc]/20 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center text-xs font-normal">
              3
            </span>
            <div>
              <h3 className="text-base font-normal text-[#28253b]">
                Verify Your Device
              </h3>
              <p className="text-xs text-[#554e7b] font-normal">
                Runs a quick, non-graded diagnostic check inside Safe Exam Browser
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#fbfbff] rounded-xl p-4 border border-[#c3c3cc]/10">
            <div className="text-xs text-[#554e7b] font-normal space-y-0.5">
              <span className="text-[#28253b] font-medium block">Verification Guarantee</span>
              <p>Testing your setup takes less than 60 seconds and ensures exam-day smoothness.</p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="default"
              onClick={handleStartTest}
              disabled={launching}
              className="gap-2 shrink-0"
            >
              {launching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>{isVerified ? 'Retest Setup' : 'Launch Diagnostic Check'}</span>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
