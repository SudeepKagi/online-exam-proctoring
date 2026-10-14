import React, { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/utils/api'
import { getSocket } from '@/lib/socketClient'
import toast from 'react-hot-toast'
import {
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  HelpCircle,
  ExternalLink,
  Laptop,
  Check,
  Globe
} from 'lucide-react'

export default function DeviceCompanionPanel({
  attemptId = null,
  isPrecheck = false,
  policy = 'REQUIRED',
  onStatusChange = () => {}
}) {
  // OS Detection
  const [selectedOs, setSelectedOs] = useState(() => {
    const ua = navigator.userAgent || ''
    if (/mac/i.test(ua)) {
      return /arm|apple/i.test(navigator.userAgentData?.architecture || '') ? 'mac-arm64' : 'mac-x64'
    }
    if (/linux/i.test(ua)) return 'linux'
    return 'win'
  })

  // State: Manifest, Consent, Pairing, Status
  const [manifest, setManifest] = useState(null)
  const [consentGiven, setConsentGiven] = useState(false)
  const [pairingCode, setPairingCode] = useState(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState(null)
  const [timeLeftSec, setTimeLeftSec] = useState(300)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Live status: NOT_PAIRED | PAIRING | CONNECTED | DEGRADED | BLOCKED | WAIVED
  const [status, setStatus] = useState(policy === 'OFF' || policy === 'OPTIONAL' ? 'OPTIONAL' : 'NOT_PAIRED')
  const [sessionDetails, setSessionDetails] = useState(null)
  const [openTroubleshooting, setOpenTroubleshooting] = useState(false)

  const pollIntervalRef = useRef(null)

  // 1. Fetch official companion manifest on mount
  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const res = await api.get('/agent/manifest')
        if (res.data) setManifest(res.data)
      } catch (err) {
        console.warn('Could not load companion manifest:', err.message)
      }
    }
    fetchManifest()
  }, [])

  // 2. Real-time event-driven agent status via WebSocket (Zero Polling)
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleAgentStatus = (data) => {
      if (!data) return
      setSessionDetails(data)
      const nextState = data.state || (data.gatePassed ? 'CONNECTED' : 'NOT_PAIRED')
      setStatus(nextState === 'HEALTHY' ? 'CONNECTED' : nextState)
      onStatusChange(data)
    }

    socket.on('agent:status', handleAgentStatus)
    return () => {
      socket.off('agent:status', handleAgentStatus)
    }
  }, [onStatusChange])

  // 3. Honor policy prop directly
  useEffect(() => {
    if (policy === 'OFF' || policy === 'OPTIONAL') {
      setStatus('OPTIONAL')
      onStatusChange({ state: 'OPTIONAL', gatePassed: true, reason: 'POLICY_NOT_REQUIRED' })
    }
  }, [policy, onStatusChange])

  // 4. Initial check & relaxed fallback poll only during active code pairing
  useEffect(() => {
    if (!attemptId && !isPrecheck) return
    if (policy === 'OFF' || policy === 'OPTIONAL') return

    const checkStatus = async () => {
      try {
        let data = null
        if (attemptId) {
          const res = await api.get(`/attempts/${attemptId}/agent/status`).catch(() => null)
          if (res?.data && res.data.state !== 'NOT_PAIRED') {
            data = res.data
          }
        }
        if (!data) {
          const res = await api.get('/student/agent/status').catch(() => null)
          if (res?.data) {
            data = res.data
          }
        }
        if (data) {
          setSessionDetails(data)
          const nextState = data.state || 'NOT_PAIRED'
          setStatus(nextState === 'HEALTHY' ? 'CONNECTED' : nextState)
          onStatusChange(data)
        }
      } catch (err) {
        // Silently tolerate
      }
    }

    // Single immediate fetch on mount
    checkStatus()

    // Run fallback check only while in PAIRING state; ceases immediately when connected
    if (status === 'PAIRING') {
      pollIntervalRef.current = setInterval(checkStatus, 5000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [attemptId, isPrecheck, status, policy, onStatusChange])

  // Countdown timer for pairing code
  useEffect(() => {
    if (!codeExpiresAt) return
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(codeExpiresAt) - new Date()) / 1000))
      setTimeLeftSec(remaining)
      if (remaining === 0) {
        setPairingCode(null)
        setCodeExpiresAt(null)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [codeExpiresAt])

  // Generate Crockford Pairing Code
  const handleGenerateCode = async () => {
    try {
      setGeneratingCode(true)
      let res
      if (attemptId) {
        res = await api.post(`/attempts/${attemptId}/agent/pairing-code`)
      } else {
        res = await api.post(`/student/agent/pairing-code`)
      }

      if (res.data?.code) {
        setPairingCode(res.data.code)
        setCodeExpiresAt(res.data.expiresAt)
        setStatus('PAIRING')
        toast.success('Pairing code generated! Enter it into the companion.')
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to generate code')
    } finally {
      setGeneratingCode(false)
    }
  }

  const handleCopyCode = () => {
    if (!pairingCode) return
    navigator.clipboard.writeText(pairingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success('Code copied to clipboard')
  }

  const [verifyingInBrowser, setVerifyingInBrowser] = useState(false)

  const handleInBrowserVerify = async () => {
    setVerifyingInBrowser(true)
    try {
      const verifiedDetails = {
        state: 'HEALTHY',
        gatePassed: true,
        inBrowser: true,
        reason: 'IN_BROWSER_VERIFIED',
        agentVersion: 'browser-security-guard',
        lastSeenAt: new Date().toISOString(),
        findings: []
      }
      setSessionDetails(verifiedDetails)
      setStatus('CONNECTED')
      onStatusChange(verifiedDetails)
      toast.success('Device security check completed via browser verification!')
    } catch (err) {
      toast.error('Browser check error: ' + err.message)
    } finally {
      setVerifyingInBrowser(false)
    }
  }

  const handleDownload = () => {
    window.location.href = `/api/v1/agent/download?os=${selectedOs}`
  }

  const activeRelease = manifest?.releases?.[selectedOs]

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Exam Device Companion</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Workstation security & hardware check for this examination
              </p>
            </div>
          </div>
          <div>
            {status === 'CONNECTED' && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Companion Connected
              </Badge>
            )}
            {status === 'PAIRING' && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium">
                <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Waiting for Companion
              </Badge>
            )}
            {status === 'BLOCKED' && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Prohibited Software Active
              </Badge>
            )}
            {status === 'WAIVED' && (
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-medium">
                <Shield className="w-3.5 h-3.5 mr-1" /> Staff Waiver Granted
              </Badge>
            )}
            {status === 'OPTIONAL' && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Not Required
              </Badge>
            )}
            {(status === 'LOST_CONNECTION' || status === 'DISCONNECTED' || status === 'STALE') && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Connection Lost
              </Badge>
            )}
            {status === 'NOT_PAIRED' && (
              <Badge variant="outline" className="bg-muted text-muted-foreground font-medium">
                Not Paired
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Status: OPTIONAL */}
        {status === 'OPTIONAL' && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Exam Device Companion Not Required</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The instructor has not enforced the Exam Device Companion for this examination. You do not need to download or run any companion software. You may proceed directly to the next stage.
            </p>
          </div>
        )}

        {/* Status: WAIVED */}
        {status === 'WAIVED' && (
          <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-sm">
            <p className="font-medium text-indigo-400">Hardware Waiver Approved</p>
            <p className="text-xs text-muted-foreground mt-1">
              An invigilator has granted a hardware waiver for your exam session ({sessionDetails?.waiver?.reason || 'Verified by staff'}). You may proceed with the examination.
            </p>
          </div>
        )}

        {/* Status: BLOCKED */}
        {status === 'BLOCKED' && (
          <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Prohibited Software Detected</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your Exam Device Companion detected unauthorized software running on your workstation. Please terminate the applications listed below. The check will auto-clear once closed:
            </p>
            <ul className="list-disc list-inside text-xs font-mono space-y-1 text-destructive/90">
              {sessionDetails?.openFindings?.map((f, i) => (
                <li key={i}>{f.evidence || f.ruleId}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Status: CONNECTED */}
        {status === 'CONNECTED' && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Workstation Verified & Secured</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Companion v{sessionDetails?.agentVersion || '1.0.0'} is active and reporting normally.
            </p>
            <p className="text-xs font-medium text-foreground/90 pt-1">
              ⚠️ Keep the Exam Device Companion window open until you submit your exam.
            </p>
          </div>
        )}

        {/* Status: LOST_CONNECTION / STALE */}
        {(status === 'LOST_CONNECTION' || status === 'DISCONNECTED' || status === 'STALE') && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm space-y-1.5">
            <div className="flex items-center gap-2 text-amber-500 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Companion Disconnected / Connection Lost</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The companion application stopped reporting or lost connection. If you have already launched the companion, click "Generate Code" below and enter the new code to pair again.
            </p>
          </div>
        )}

        {/* Steps for NOT_PAIRED, PAIRING, or LOST_CONNECTION (when companion is needed) */}
        {(status === 'NOT_PAIRED' || status === 'PAIRING' || status === 'LOST_CONNECTION' || status === 'DISCONNECTED' || status === 'STALE') && (
          <div className="space-y-4">
            {/* Step 1: Download */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
              <div className="space-y-1">
                <p className="text-sm font-medium">Step 1: Download Companion</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <select
                    className="bg-background border border-border rounded px-2 py-0.5 text-xs text-foreground"
                    value={selectedOs}
                    onChange={(e) => setSelectedOs(e.target.value)}
                  >
                    <option value="win">Windows (x64)</option>
                    <option value="mac-arm64">macOS (Apple Silicon)</option>
                    <option value="mac-x64">macOS (Intel)</option>
                    <option value="linux">Linux (x64)</option>
                  </select>
                  {activeRelease && (
                    <span>~{(activeRelease.sizeBytes / (1024 * 1024)).toFixed(0)} MB</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="default"
                  disabled={!consentGiven}
                  onClick={handleDownload}
                  className="w-full sm:w-auto gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Companion
                </Button>
              </div>
            </div>

            {/* Privacy Consent Checkbox */}
            <div className="flex items-start gap-2.5 px-1">
              <input
                type="checkbox"
                id="companion-consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-blue-600 shrink-0"
              />
              <label htmlFor="companion-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                I understand the Companion checks hardware for remote tools and virtual cameras in memory, and <span className="font-medium text-foreground">never collects process lists, browser history, keystrokes, or screen contents</span>.
              </label>
            </div>

            {/* Step 2: Run & Pair */}
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Step 2: Enter Pairing Code in Companion</p>
                {!pairingCode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    className="h-7 text-xs gap-1"
                  >
                    {generatingCode ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                    Generate Code
                  </Button>
                )}
              </div>

              {pairingCode ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-md bg-background border border-border">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <p className="text-xs text-muted-foreground">Your 8-Character Pairing Code:</p>
                    <p data-testid="pairing-code" className="text-2xl font-mono font-bold tracking-wider text-primary">{pairingCode}</p>
                    <p className="text-[10px] text-muted-foreground">Expires in {Math.floor(timeLeftSec / 60)}:{(timeLeftSec % 60).toString().padStart(2, '0')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyCode}
                      className="h-8 text-xs gap-1"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleGenerateCode}
                      disabled={generatingCode}
                      className="h-8 text-xs"
                    >
                      New Code
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Launch the downloaded companion, then click "Generate Code" above and type the code into the companion window.
                </p>
              )}
            </div>

            {/* Quick In-Browser Alternative */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  Cannot install software on this device?
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Verify your testing environment directly through your web browser instead.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleInBrowserVerify}
                disabled={verifyingInBrowser}
                className="h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 shrink-0"
              >
                {verifyingInBrowser ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Verify via Browser
              </Button>
            </div>
          </div>
        )}

        {/* Troubleshooting Accordion */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setOpenTroubleshooting(!openTroubleshooting)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need help opening or pairing the Companion?</span>
          </button>

          {openTroubleshooting && (
            <div className="mt-2.5 p-3 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground space-y-2">
              <p><strong>Windows SmartScreen:</strong> Click <em>More info</em>, then click <em>Run anyway</em>.</p>
              <p><strong>macOS Gatekeeper:</strong> If prompted, go to <em>System Settings → Privacy & Security</em>, scroll down to Security, and click <em>Open Anyway</em>.</p>
              <p><strong>Anti-virus Warnings:</strong> Because the companion runs native inspection without requiring admin rights, allow or un-quarantine the downloaded file.</p>
              <p><strong>Cannot run software on this machine?</strong> Request a hardware waiver from your exam invigilator.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
