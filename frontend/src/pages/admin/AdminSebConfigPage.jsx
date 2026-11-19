import React, { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  ShieldCheck,
  Lock,
  Unlock,
  Upload,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Loader2,
  Copy,
  Check,
  Play,
  Laptop,
  Clock,
  XCircle,
  Info,
  HelpCircle,
  Activity,
  RotateCw
} from 'lucide-react'

export default function AdminSebConfigPage() {
  usePageTitle('Secure Browser — System Administration')

  const [status, setStatus] = useState({
    configured: false,
    uploadedAt: null,
    keyLast4: null,
    lastVerifiedAt: null,
    lastVerifiedMethod: null,
    lastVerifiedUserAgent: null,
    requestedMode: 'audit',
    effectiveMode: 'audit',
    enforcementReason: null,
    publicOrigin: ''
  })
  const [loading, setLoading] = useState(true)
  const [storageHealth, setStorageHealth] = useState({ ok: true, status: 'OK' })
  const [checkingStorage, setCheckingStorage] = useState(false)
  const [publicOrigin, setPublicOrigin] = useState('')

  // Form states
  const [file, setFile] = useState(null)
  const [configKey, setConfigKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const [inspectionResult, setInspectionResult] = useState(null)

  // Testing states
  const [testing, setTesting] = useState(false)
  const [testPin, setTestPin] = useState(null)
  const [pollCountdown, setPollCountdown] = useState(0)
  const [testDiagnostics, setTestDiagnostics] = useState(null)
  const [recentAttempts, setRecentAttempts] = useState([])
  const [justVerified, setJustVerified] = useState(false)
  const [entryDiagnostics, setEntryDiagnostics] = useState(null)
  const [loadingEntryDiagnostics, setLoadingEntryDiagnostics] = useState(false)

  // Ref Lookup states
  const [refSearchId, setRefSearchId] = useState('')
  const [refSearchResult, setRefSearchResult] = useState(null)
  const [refSearchLoading, setRefSearchLoading] = useState(false)
  const [refSearchError, setRefSearchError] = useState('')

  // Modal & Messages
  const [confirmEnforceOpen, setConfirmEnforceOpen] = useState(false)
  const [updatingMode, setUpdatingMode] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [storageRetryable, setStorageRetryable] = useState(false)
  const [copiedField, setCopiedField] = useState(null)

  const fileInputRef = useRef(null)
  const pollTimerRef = useRef(null)
  const initialVerifiedAtRef = useRef(null)

  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (_) {}
  }

  const handleLookupRef = async (refIdToLookup) => {
    const id = (refIdToLookup || refSearchId).replace(/^#/, '').trim()
    if (!id) return
    if (refIdToLookup) setRefSearchId(refIdToLookup)
    setRefSearchLoading(true)
    setRefSearchError('')
    setRefSearchResult(null)
    try {
      const res = await apiClient.get(`/admin/seb/diagnostics/lookup/${encodeURIComponent(id)}`)
      if (res?.data?.record) {
        setRefSearchResult(res.data.record)
      } else {
        setRefSearchError('No failure record found for this reference ID.')
      }
    } catch (err) {
      setRefSearchError(err?.response?.data?.message || 'Reference ID not found in recent records.')
    } finally {
      setRefSearchLoading(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/admin/seb/status')
      if (res?.data) {
        setStatus(res.data)
        if (res.data.publicOrigin) {
          setPublicOrigin(res.data.publicOrigin)
        }
      }
      return res.data
    } catch (err) {
      return null
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageHealth = async (refresh = false) => {
    try {
      const res = await apiClient.get(`/admin/health/storage${refresh ? '?refresh=true' : ''}`)
      setStorageHealth(res.data)
      return res.data
    } catch (err) {
      const downState = { ok: false, status: 'Down', error: err?.response?.data?.message || err.message }
      setStorageHealth(downState)
      return downState
    }
  }

  const fetchRecentAttempts = async () => {
    try {
      const res = await apiClient.get('/admin/seb/attempts')
      if (res?.data?.attempts) {
        setRecentAttempts(res.data.attempts)
      }
    } catch (_) {}
  }

  const fetchEntryDiagnostics = async () => {
    setLoadingEntryDiagnostics(true)
    try {
      const res = await apiClient.get('/admin/seb/entry-diagnostics')
      if (res?.data) {
        setEntryDiagnostics(res.data)
      }
    } catch (_) {} finally {
      setLoadingEntryDiagnostics(false)
    }
  }

  const refreshStorage = async () => {
    setCheckingStorage(true)
    try {
      const res = await fetchStorageHealth(true)
      if (res?.ok) {
        setMsg({ text: 'Object storage connectivity verified: OK', type: 'success' })
        setStorageRetryable(false)
      } else {
        setMsg({ text: 'Storage check failed: ' + (res?.error || 'Unavailable'), type: 'error' })
      }
    } finally {
      setCheckingStorage(false)
    }
  }

  // Initial load and periodic refresh
  useEffect(() => {
    fetchStatus()
    fetchStorageHealth()
    fetchRecentAttempts()
    fetchEntryDiagnostics()

    const pollInterval = setInterval(() => {
      fetchStatus()
      fetchRecentAttempts()
    }, 5000)

    return () => {
      clearInterval(pollInterval)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Handle file inspection
  const inspectSelectedFile = async (selectedFile, keyToInspect) => {
    if (!selectedFile) return
    setInspecting(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (keyToInspect) {
        formData.append('configKey', keyToInspect)
      }
      const res = await apiClient.post('/admin/seb/inspect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res?.data?.inspection) {
        setInspectionResult(res.data.inspection)
      }
    } catch (err) {
      setInspectionResult(null)
    } finally {
      setInspecting(false)
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.seb')) {
        setMsg({ text: 'Selected file must have a .seb extension', type: 'error' })
        return
      }
      if (selected.size > 500 * 1024) {
        setMsg({ text: 'Selected file exceeds the 500 KB limit', type: 'error' })
        return
      }
      setFile(selected)
      setMsg({ text: '', type: '' })
      inspectSelectedFile(selected, configKey.trim().toLowerCase())
    }
  }

  const handleKeyChange = (e) => {
    const val = e.target.value
    setConfigKey(val)
    if (file && val.trim().length === 64) {
      inspectSelectedFile(file, val.trim().toLowerCase())
    }
  }

  const handleDownloadStarter = () => {
    window.location.href = '/api/v1/admin/seb/starter-config'
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setMsg({ text: 'Please select a .seb configuration file', type: 'error' })
      return
    }
    const cleanedKey = configKey.trim().toLowerCase()
    if (!cleanedKey || !/^[0-9a-f]{64}$/.test(cleanedKey)) {
      setMsg({ text: 'Config Key must be a valid 64-character hexadecimal string', type: 'error' })
      return
    }

    setSubmitting(true)
    setMsg({ text: '', type: '' })

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('configKey', cleanedKey)

      const res = await apiClient.post('/admin/seb/config', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setStatus(res.data.status)
      setFile(null)
      setConfigKey('')
      setInspectionResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setStorageRetryable(false)
      setMsg({ text: 'Safe Exam Browser configuration saved successfully.', type: 'success' })
      fetchStatus()
      fetchRecentAttempts()
    } catch (err) {
      const code = err?.response?.data?.code
      if (code === 'STORAGE_UNAVAILABLE' || err?.response?.status === 503) {
        setStorageRetryable(true)
        setMsg({
          text: 'Object storage is temporarily unavailable. Please verify cloud storage credentials and retry.',
          type: 'error'
        })
      } else {
        setStorageRetryable(false)
        setMsg({ text: errorMessage(err, 'Failed to upload configuration'), type: 'error' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove the institution Safe Exam Browser configuration?')) {
      return
    }
    setSubmitting(true)
    try {
      await apiClient.delete('/admin/seb/config')
      await fetchStatus()
      setMsg({ text: 'Institution configuration removed successfully.', type: 'success' })
      setInspectionResult(null)
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to remove configuration'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestSetup = async () => {
    setTesting(true)
    setMsg({ text: '', type: '' })
    setTestDiagnostics(null)
    initialVerifiedAtRef.current = status.lastVerifiedAt

    try {
      const res = await apiClient.post('/seb/launch-link', { purpose: 'check' })
      const launchUrl = res.data?.url
      const pin = res.data?.pin
      if (pin) setTestPin(pin)

      // Allow 4-second buffer for the administrator to read the PIN before triggering protocol handler
      if (launchUrl) {
        setTimeout(() => {
          window.location.href = launchUrl
        }, 3500)
      }

      let secondsLeft = 120
      setPollCountdown(secondsLeft)

      if (pollTimerRef.current) clearInterval(pollTimerRef.current)

      pollTimerRef.current = setInterval(async () => {
        secondsLeft -= 3
        setPollCountdown(Math.max(0, secondsLeft))

        const latest = await fetchStatus()
        await fetchRecentAttempts()

        if (latest?.lastVerifiedAt && latest.lastVerifiedAt !== initialVerifiedAtRef.current) {
          clearInterval(pollTimerRef.current)
          setTesting(false)
          setJustVerified(true)
          setPollCountdown(0)
          setTestPin(null)
          setMsg({ text: 'Verification confirmed! Safe Exam Browser communicated successfully.', type: 'success' })
        } else if (secondsLeft <= 0) {
          clearInterval(pollTimerRef.current)
          setTesting(false)
          setPollCountdown(0)
          setTestDiagnostics({
            title: 'No verification ping received within 2 minutes',
            details: 'Safe Exam Browser did not complete the startup handshake. Check that Safe Exam Browser opened successfully on this computer and that your network allows outgoing HTTPS requests to the server.'
          })
        }
      }, 3000)
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to generate test launch link'), type: 'error' })
      setTesting(false)
      setPollCountdown(0)
    }
  }

  const handleUpdateMode = async (targetMode) => {
    setUpdatingMode(true)
    setMsg({ text: '', type: '' })
    try {
      const res = await apiClient.patch('/admin/seb/mode', { mode: targetMode })
      if (res?.data) {
        setStatus(prev => ({
          ...prev,
          requestedMode: res.data.requestedMode,
          effectiveMode: res.data.effectiveMode,
          enforcementReason: res.data.enforcementReason
        }))
        setConfirmEnforceOpen(false)
        const isNowEnforce = res.data.effectiveMode === 'enforce'
        setMsg({
          text: isNowEnforce
            ? 'Strict enforcement enabled! Candidates must use Safe Exam Browser for secure exams.'
            : 'Switched to Audit mode. Students may use regular browsers while configuration is being tested.',
          type: 'success'
        })
      }
    } catch (err) {
      setMsg({
        text: errorMessage(err, 'Failed to update enforcement mode'),
        type: 'error'
      })
    } finally {
      setUpdatingMode(false)
    }
  }

  const originUrl = publicOrigin || 'https://proctornet.duckdns.org'
  const startUrl = `${originUrl}/seb/enter`
  const quitUrl = `${originUrl}/seb/done`
  const cleanedKeyInput = configKey.trim().toLowerCase()
  const isKeyValidHex = /^[0-9a-f]{64}$/.test(cleanedKeyInput)

  const isConfigVersionValid = status.isConfigVersionMatched !== false

  const isVerifiedRecent = Boolean(
    status.lastVerifiedAt &&
    new Date(status.lastVerifiedAt).getTime() >= (Date.now() - 7 * 24 * 60 * 60 * 1000) &&
    isConfigVersionValid
  )

  return (
    <DashboardShell title="Secure browser setup">
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Status Header Banner */}
        <div className="bg-white rounded-[16px] p-6 shadow-sm border-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-[480] text-[#28253b]">Safe Exam Browser Configuration</h1>
              <p className="text-xs text-[#554e7b] font-[360] mt-0.5">
                Central institution-wide security setup for Safe Exam Browser. Configured once, verified cryptographically, and inherited by all secure exams.
              </p>
            </div>
          </div>

          {/* 4 Status KPI Indicators */}
          <div className="mt-5 pt-4 border-t border-[#edecfb] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Configuration Status */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Configuration</span>
              {status.configured ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#5266eb]" data-testid="seb-status-configured">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]" data-testid="seb-status-not-configured">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#8a6a26]" /> Not Configured
                </span>
              )}
            </div>

            {/* 2. Verification Status */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Verification</span>
              {isVerifiedRecent ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#5266eb]" data-testid="seb-verified-pill">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Verified ✓
                </span>
              ) : status.lastVerifiedAt && !isConfigVersionValid ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#8a6a26]" /> Needs re-test
                </span>
              ) : status.lastVerifiedAt ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]">
                  <Clock className="w-3.5 h-3.5 text-[#8a6a26]" /> Expired (&gt;7 days)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]" data-testid="seb-awaiting-pill">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#8a6a26]" /> Awaiting verification
                </span>
              )}
            </div>

            {/* 3. Enforcement Mode */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Enforcement Mode</span>
              <span className="font-[480] text-[#28253b] capitalize">
                {status.effectiveMode === 'enforce' ? 'Enforced' : 'Audit Mode'}
                {status.requestedMode !== status.effectiveMode && (
                  <span className="text-[10px] text-[#554e7b] font-[360] ml-1">
                    (Req: {status.requestedMode})
                  </span>
                )}
              </span>
            </div>

            {/* 4. Object Storage */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[#554e7b] font-[420] text-[11px]">Object Storage</span>
                {!storageHealth?.ok && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={refreshStorage}
                    disabled={checkingStorage}
                    className="text-[10px] p-0 h-auto"
                  >
                    {checkingStorage ? 'Checking...' : 'Retry'}
                  </Button>
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 font-[480] ${storageHealth?.ok ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                {storageHealth?.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> : <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />}
                {storageHealth?.ok ? 'Connected (S3)' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Suggestion-Only Circuit Breaker Banner */}
        {entryDiagnostics?.setupFailures10m?.thresholdExceeded && (
          <div className="p-4 rounded-[16px] bg-[#fbfbff] text-[#28253b] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#c04b4b] mt-0.5" />
              <div>
                <p className="font-[480] text-[#c04b4b]">High Entry Failure Rate Detected ({entryDiagnostics.setupFailures10m.count} setup failures in last 10 minutes)</p>
                <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">
                  Candidates are encountering repeated configuration mismatches or missing headers. Recommendation: Return to Audit mode until configuration is re-tested.
                </p>
              </div>
            </div>
            {status.effectiveMode === 'enforce' && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => handleUpdateMode('audit')}
                disabled={updatingMode}
                className="rounded-[40px] px-3.5 text-[11px] shrink-0"
              >
                {updatingMode ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                Return to Audit Mode
              </Button>
            )}
          </div>
        )}

        {/* Non-blocking Start URL Recommendation Notice */}
        {status.configured && status.startUrl && !status.startUrl.includes('/seb/enter') && (
          <div className="p-3.5 rounded-[12px] bg-[#fbfbff] border-l-2 border-[#5266eb] text-xs font-[420] text-[#28253b] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#5266eb] shrink-0 mt-0.5" />
            <div>
              <p className="font-[480]">Configuration Notice</p>
              <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5 leading-relaxed">
                Your stored configuration has Start URL set to <code>{status.startUrl}</code>. It works, but update your configuration to the recommended Start URL (<code>{startUrl}</code>) for faster zero-click handoff.
              </p>
            </div>
          </div>
        )}

        {/* Global Notifications */}
        {msg.text && (
          <div
            className={`p-3.5 rounded-[12px] text-xs font-[420] flex items-center justify-between gap-3 ${
              msg.type === 'error' ? 'bg-[#edecfb] text-[#28253b]' : 'bg-[#edecfb] text-[#28253b]'
            }`}
          >
            <div className="flex items-center gap-2">
              {msg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-[#c04b4b] shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#5266eb] shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
            {storageRetryable && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleUpload}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Retry
              </Button>
            )}
          </div>
        )}

        {/* STEP 1: Configuration Settings Guide & Starter Config */}
        <Card className="bg-white rounded-[16px] shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  1
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  Configuration settings guide & starter config
                </CardTitle>
              </div>
              <a
                href="https://safeexambrowser.org/download_en.html"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#5266eb] font-[420] inline-flex items-center gap-1 hover:underline"
              >
                Download SEB <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs text-[#554e7b] font-[360]">
            <p>
              Open the SEB Configuration Tool on your administrator workstation. Verify each of the following required settings before saving your configuration:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* General Tab */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> General Tab
                </div>
                <p className="text-[11px] text-[#554e7b]">
                  Set <strong>Start URL</strong> to your candidate entry route:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2 py-1 rounded-[6px] font-mono text-[#28253b] truncate flex-1">
                    {startUrl}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => copyToClipboard(startUrl, 'startUrl')}
                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"
                  >
                    {copiedField === 'startUrl' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'startUrl' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Exam Tab - Query String */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Exam Tab — Query Parameter
                </div>
                <p className="text-[11px] text-[#554e7b]">
                  Under <em>Query String Parameter</em>, check <strong>"Allow Query Parameter"</strong> (<code>startURLAppendQueryParameter: true</code>).
                </p>
                <p className="text-[11px] text-[#70707d]">
                  Enables seamless one-click launch handoff without asking students to re-login inside SEB.
                </p>
              </div>

              {/* Exam Tab - Headers & Key */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Exam Tab — Security Headers
                </div>
                <p className="text-[11px] text-[#554e7b]">
                  Check <strong>"Use Browser Exam Key and Configuration Key"</strong> (<code>sendBrowserExamKey: true</code>).
                </p>
                <div className="p-2 bg-[#edecfb]/60 rounded-[8px] text-[11px] text-[#28253b] font-[420]">
                  💡 The starter file is a template only. The server never trusts a default key. In the SEB Configuration Tool, go to the <strong>Exam</strong> tab after saving and copy the 64-character <strong>Configuration Key</strong> (NOT the Browser Exam Key)!
                </div>
              </div>

              {/* Session / Quitting */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Session / Quitting
                </div>
                <p className="text-[11px] text-[#554e7b]">
                  Set <strong>Quit URL</strong> to:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2 py-1 rounded-[6px] font-mono text-[#28253b] truncate flex-1">
                    {quitUrl}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => copyToClipboard(quitUrl, 'quitUrl')}
                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"
                  >
                    {copiedField === 'quitUrl' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'quitUrl' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Starter Download Box */}
            <div className="p-4 rounded-[12px] bg-[#fbfbff] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[#5266eb]" /> Pre-configured Starter File
                </div>
                <p className="text-[11px] text-[#554e7b]">
                  Download a starter <code>.seb</code> template pre-configured with your institution&apos;s Start URL, query forwarding, and quit URLs.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDownloadStarter}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download starter configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* STEP 2: Upload Configuration File & Paste Config Key */}
        <Card className="bg-white rounded-[16px] shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                2
              </span>
              <CardTitle className="text-sm font-[480] text-[#28253b]">
                Upload configuration file & paste Config Key
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File upload input */}
              <div>
                <label className="block text-xs font-[420] text-[#28253b] mb-1.5">
                  SEB Configuration File (.seb)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".seb"
                    onChange={handleFileChange}
                    className="hidden"
                    id="seb-file-upload"
                  />
                  <label
                    htmlFor="seb-file-upload"
                    className="cursor-pointer inline-flex items-center gap-2 text-xs font-[420] px-4 py-2 rounded-full bg-[#edecfb] text-[#28253b] hover:bg-[#e0dff9] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#5266eb]" />
                    {file ? file.name : (status.filePresent ? 'Replace current .seb file' : 'Choose .seb file')}
                  </label>
                  {file ? (
                    <span className="text-xs text-[#70707d] font-[360]">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : status.filePresent ? (
                    <span className="text-xs text-[#5266eb] font-[420] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Current .seb file active in storage
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[#70707d] font-[360] mt-1">
                  Private upload stored securely in institution object storage. Maximum 500 KB.
                </p>
              </div>

              {/* Automated Inspection Results Panel */}
              {inspecting && (
                <div className="p-3 bg-[#fbfbff] rounded-[12px] flex items-center gap-2 text-xs text-[#554e7b]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#5266eb]" /> Inspecting configuration file structure...
                </div>
              )}

              {inspectionResult && (
                <div className="p-3.5 bg-[#fbfbff] rounded-[12px] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-[480] text-[#28253b] flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-[#5266eb]" /> File Inspection Results
                    </span>
                    <Badge variant="secondary" className="text-[10px] rounded-full">
                      {inspectionResult.isEncrypted ? 'Password-Protected Container' : 'Plain XML Plist'}
                    </Badge>
                  </div>

                  {inspectionResult.isEncrypted ? (
                    <div className="text-[11px] text-[#554e7b] leading-relaxed">
                      <p>{inspectionResult.notice}</p>
                      <p className="mt-1 font-[420] text-[#5266eb]">{inspectionResult.recommendation}</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {inspectionResult.checks?.map((chk) => (
                        <div key={chk.key} className="flex items-start gap-2 text-[11px]">
                          {chk.status === 'ok' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb] shrink-0 mt-0.5" />
                          ) : chk.status === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#8a6a26] shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#c04b4b] shrink-0 mt-0.5" />
                          )}
                          <span>
                            <strong className="text-[#28253b]">{chk.label}:</strong> {chk.message}
                          </span>
                        </div>
                      ))}

                      {inspectionResult.keyMatch && (
                        <div className="mt-2 text-[11px] font-[480] text-[#5266eb] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid Configuration Key confirmed ✓ (Matches computed file hash)
                        </div>
                      )}

                      {inspectionResult.keyWarning && (
                        <div className="mt-2 text-[11px] font-[420] text-[#8a6a26] flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{inspectionResult.keyWarning}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Config Key input with live length counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-[420] text-[#28253b]">
                    Configuration Key (64-character hex)
                  </label>
                  <span className={`text-[11px] font-[480] ${isKeyValidHex ? 'text-[#5266eb]' : 'text-[#70707d]'}`}>
                    {isKeyValidHex ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#5266eb]" /> 64 / 64 characters (Valid)
                      </span>
                    ) : (
                      `${cleanedKeyInput.length} / 64 characters`
                    )}
                  </span>
                </div>
                <Input
                  type="text"
                  value={configKey}
                  onChange={handleKeyChange}
                  placeholder={status.keyLast4 ? `Currently: ••••••••${status.keyLast4} (Paste new key to replace)` : 'Paste 64-character hexadecimal key from SEB Config Tool'}
                  className="font-mono text-xs rounded-xl bg-[#fbfbff] h-10 border-0"
                />
                <p className="text-[11px] text-[#554e7b] font-[420] mt-1">
                  Copy the <strong>Configuration Key</strong> from the <strong>Exam</strong> tab in the SEB Configuration Tool after saving (not the Browser Exam Key). The server never trusts a default key and validates candidate sessions against this key.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !file || !isKeyValidHex}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                    </>
                  ) : (
                    'Save institution configuration'
                  )}
                </Button>

                {status.configured && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemove}
                    disabled={submitting}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove configuration
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* STEP 3: Test My Setup & Verification Audit */}
        <Card className="bg-white rounded-[16px] shadow-sm border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  3
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  Test my setup & verification audit
                </CardTitle>
              </div>
              {isVerifiedRecent && (
                <Badge className="bg-[#edecfb] text-[#5266eb] border-0 rounded-full px-3 py-0.5 font-[420]">
                  Verified ✓
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs text-[#554e7b] font-[360]">
            <p>
              Verify that Safe Exam Browser communicates with ProctorNet using the uploaded configuration and active Configuration Key:
            </p>

            <div className="p-4 rounded-[12px] bg-[#fbfbff] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-[480] text-[#28253b] flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-[#5266eb]" /> One-Click Protocol Handshake
                  </div>
                  <p className="text-[11px] text-[#70707d] leading-relaxed">
                    Clicking the button launches Safe Exam Browser with a secure diagnostic token and validates the header handshake automatically.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isVerifiedRecent || justVerified ? "primary" : "secondary"}
                  onClick={handleTestSetup}
                  disabled={testing || !status.configured}
                  className={(isVerifiedRecent || justVerified) && !testing ? "bg-[#2e7d32] hover:bg-[#256629] text-white border-0" : ""}
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Listening for ping ({pollCountdown}s)...
                    </>
                  ) : (isVerifiedRecent || justVerified) ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-white" /> Verified ✓
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Test my setup
                    </>
                  )}
                </Button>
              </div>

              {testPin && (
                <div className="p-3 bg-white rounded-[10px] flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[#554e7b] font-[420]">Manual 6-Digit PIN: </span>
                    <strong className="font-mono text-sm tracking-wider text-[#28253b]">{testPin}</strong>
                    <span className="text-[11px] text-[#70707d] ml-2">(If SEB did not open automatically, type this PIN into SEB)</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => copyToClipboard(testPin, 'testPin')}
                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"
                  >
                    {copiedField === 'testPin' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'testPin' ? 'Copied' : 'Copy PIN'}
                  </Button>
                </div>
              )}

              {testDiagnostics && (
                <div className="p-3 bg-[#edecfb] rounded-[10px] text-xs text-[#28253b] space-y-1">
                  <div className="font-[480] flex items-center gap-1.5 text-[#c04b4b]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{testDiagnostics.title}</span>
                  </div>
                  <p className="text-[11px] text-[#554e7b] leading-relaxed pl-5.5">
                    {testDiagnostics.details}
                  </p>
                </div>
              )}
            </div>

            {/* Diagnostic Details Banner */}
            {status.configured && (
              <div className="p-4 rounded-[12px] bg-[#fbfbff] space-y-2 text-xs">
                <h4 className="font-[480] text-[#28253b] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#5266eb]" /> Verification Record
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-[#70707d]">Last Verified:</span>{' '}
                    <span className="font-[420] text-[#28253b]">
                      {status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : 'Awaiting first test ping'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#70707d]">Verified Client / Version:</span>{' '}
                    <span className="font-[420] text-[#28253b]">
                      {status.lastVerifiedUserAgent ? status.lastVerifiedUserAgent.slice(0, 45) : (status.lastVerifiedAt ? 'Safe Exam Browser' : 'Pending')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#70707d]">Public Origin:</span>{' '}
                    <span className="font-mono text-[#28253b]">{status.publicOrigin || publicOrigin}</span>
                  </div>
                  <div>
                    <span className="text-[#70707d]">Active Key:</span>{' '}
                    <span className="font-mono text-[#28253b]">••••••••{status.keyLast4 || 'configured'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Last 5 Attempts Audit Table */}
            {recentAttempts.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-[480] text-[#28253b] text-xs">Recent Verification Attempts</h4>
                  <span className="text-[11px] text-[#70707d]">Last {recentAttempts.length} attempts</span>
                </div>
                <div className="bg-[#fbfbff] rounded-[12px] overflow-hidden text-[11px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#edecfb] text-[#554e7b] font-[420]">
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Purpose</th>
                        <th className="py-2.5 px-3">Outcome</th>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3">Client IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edecfb]/60 text-[#28253b]">
                      {recentAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-white/60">
                          <td className="py-2 px-3 text-[#554e7b] whitespace-nowrap">
                            {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 capitalize font-[420]">{att.purpose}</td>
                          <td className="py-2 px-3">
                            {att.outcome === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 text-[#5266eb] font-[480]">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </span>
                            ) : att.outcome === 'HEADER_MISMATCH' ? (
                              <span className="inline-flex items-center gap-1 text-[#c04b4b] font-[480]" title={att.diagnosticDetails}>
                                <XCircle className="w-3 h-3" /> Mismatch
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#8a6a26] font-[480]" title={att.diagnosticDetails}>
                                <AlertTriangle className="w-3 h-3" /> {att.outcome.toLowerCase()}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 truncate max-w-[150px] text-[#554e7b]">{att.sebVersion}</td>
                          <td className="py-2 px-3 font-mono text-[#554e7b]">{att.clientIp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Why students may fail to enter Diagnostic Card */}
        <Card className="bg-white rounded-[16px] shadow-sm border-0" data-testid="why-students-fail-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5" />
                </span>
                <div>
                  <CardTitle className="text-sm font-[480] text-[#28253b]">
                    Why students may fail to enter
                  </CardTitle>
                  <p className="text-[11px] text-[#554e7b] font-[360] mt-0.5">
                    Pre-entry infrastructure verification and 24-hour student exchange failure log
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={fetchEntryDiagnostics}
                disabled={loadingEntryDiagnostics}
                className="self-start sm:self-auto rounded-[40px] px-3 text-[11px]"
              >
                {loadingEntryDiagnostics ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <RotateCw className="w-3 h-3 mr-1.5 text-[#554e7b]" />
                )}
                Run Storage Probe & Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs text-[#554e7b] font-[360]">
            {/* Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Object Storage Config File */}
              <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
                <span className="text-[#554e7b] font-[420] text-[11px]">Config Object (HEAD)</span>
                <span className={`inline-flex items-center gap-1.5 font-[480] ${entryDiagnostics?.configObjectPresent ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                  {entryDiagnostics?.configObjectPresent ? <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> : <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />}
                  {entryDiagnostics?.configObjectPresent ? 'Present in S3' : 'Missing in S3'}
                </span>
              </div>

              {/* 2. Key Presence */}
              <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
                <span className="text-[#554e7b] font-[420] text-[11px]">Configuration Key</span>
                <span className={`inline-flex items-center gap-1.5 font-[480] ${entryDiagnostics?.keyPresent ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                  {entryDiagnostics?.keyPresent ? <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> : <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />}
                  {entryDiagnostics?.keyPresent ? 'Active in DB' : 'Not configured'}
                </span>
              </div>

              {/* 3. Effective Mode */}
              <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
                <span className="text-[#554e7b] font-[420] text-[11px]">Effective Mode</span>
                <span className="font-[480] text-[#28253b] capitalize">
                  {entryDiagnostics?.effectiveMode === 'enforce' ? 'Enforced' : (entryDiagnostics?.effectiveMode || status.effectiveMode) + ' Mode'}
                </span>
              </div>

              {/* 4. Storage Probe */}
              <div className="bg-[#fbfbff] p-3 rounded-[12px] flex flex-col gap-1">
                <span className="text-[#554e7b] font-[420] text-[11px]">Storage Probe (IAM)</span>
                <span className={`inline-flex items-center gap-1.5 font-[480] ${entryDiagnostics?.storageProbe?.passed ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                  {entryDiagnostics?.storageProbe?.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> : <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />}
                  {entryDiagnostics?.storageProbe?.passed ? 'Read/Write/Delete OK' : (entryDiagnostics?.storageProbe?.error ? 'Probe Denied' : 'Pending')}
                </span>
              </div>
            </div>

            {/* Exchange Failure Counts Table (24h) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="font-[480] text-[#28253b] text-xs">Student Entry Failure Modes (Last 24 Hours)</h4>
                <span className="text-[11px] text-[#70707d]">Aggregated by distinct error code</span>
              </div>
              <div className="bg-[#fbfbff] rounded-[12px] overflow-hidden text-[11px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#edecfb] text-[#554e7b] font-[420]">
                      <th className="py-2.5 px-3">Failure Mode / Error Code</th>
                      <th className="py-2.5 px-3">Root Cause & Guidance</th>
                      <th className="py-2.5 px-3 text-right">24h Count</th>
                      <th className="py-2.5 px-3 text-right">Last Request Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edecfb]/60 text-[#28253b]">
                    {[
                      { code: 'INVALID_CODE', label: 'Invalid / Unrecognized PIN', desc: 'Candidate entered an incorrect or misspelled 6-digit PIN' },
                      { code: 'CODE_EXPIRED', label: 'Expired Launch Code', desc: 'Candidate waited >5 minutes after generating PIN before launch' },
                      { code: 'CODE_USED', label: 'PIN Already Consumed', desc: 'Candidate attempted to reuse a PIN that was already redeemed' },
                      { code: 'RATE_LIMITED', label: 'Rate Limit Exceeded', desc: 'More than 5 invalid PIN attempts within 1 minute' },
                      { code: 'SEB_HEADER_MISSING', label: 'Missing ConfigKey Header', desc: 'Candidate opened exam in standard browser or SEB stripped headers' },
                      { code: 'SEB_HEADER_MISMATCH', label: 'Configuration Key Mismatch', desc: 'Client SEB is running a different .seb config file than the server DB' },
                      { code: 'INSTITUTION_NOT_CONFIGURED', label: 'Institution Not Configured', desc: 'No active SEB config file or 64-hex key stored on server' },
                      { code: 'STORAGE_UNAVAILABLE', label: 'Object Storage Down', desc: 'S3 bucket connection or IAM permissions failure' }
                    ].map((row) => {
                      const count = entryDiagnostics?.failureCounts24h?.[row.code] || 0
                      const lastId = entryDiagnostics?.lastRequestIdByCode?.[row.code] || '—'
                      return (
                        <tr key={row.code} className="hover:bg-white/60">
                          <td className="py-2.5 px-3 font-mono font-[480] text-[#28253b]">
                            {row.code}
                            <span className="block font-sans text-[10px] text-[#554e7b] font-[360]">{row.label}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#554e7b]">{row.desc}</td>
                          <td className="py-2.5 px-3 text-right font-[480]">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${count > 0 ? 'bg-[#edecfb] text-[#5266eb]' : 'text-[#70707d]'}`}>
                              {count}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#554e7b]">
                            {lastId !== '—' ? `#${lastId}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Most Likely Cause & Troubleshooting Guidance */}
            <div className="p-3.5 bg-[#fbfbff] rounded-[12px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-[480] text-[#28253b] text-xs">
                <Info className="w-3.5 h-3.5 text-[#5266eb]" /> Most Likely Cause of Recent Failures
              </div>
              <p className="text-[11px] text-[#554e7b] leading-relaxed">
                {entryDiagnostics?.mostLikelyCause || 'No entry failures reported in the last 24 hours.'}
              </p>
              {entryDiagnostics?.recentRefs?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  <span className="text-[10px] text-[#70707d]">Recent Failure References:</span>
                  {entryDiagnostics.recentRefs.map(ref => (
                    <Button
                      key={ref.requestId}
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => handleLookupRef(ref.requestId)}
                      className="h-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
                    >
                      #{ref.requestId.slice(0, 8)} ({ref.code})
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Reference ID Diagnostics Lookup */}
            <div className="p-3.5 bg-[#fbfbff] rounded-[12px] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-[480] text-[#28253b] text-xs flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#5266eb]" /> Look up a student reference ID
                </div>
                <span className="text-[10px] text-[#70707d]">From candidate error screen (Ref: #...)</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Paste reference ID (e.g. 231b5db7-580f-4839-9cd8-1c0f6d26bac5)"
                  value={refSearchId}
                  onChange={(e) => setRefSearchId(e.target.value)}
                  className="font-mono text-xs rounded-xl bg-white h-9 border-0 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => handleLookupRef()}
                  disabled={refSearchLoading || !refSearchId.trim()}
                  className="rounded-[40px] px-3.5 h-9 shrink-0"
                >
                  {refSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Look up
                </Button>
              </div>

              {refSearchError && (
                <p className="text-[11px] text-[#c04b4b] font-[420]">{refSearchError}</p>
              )}

              {refSearchResult && (
                <div className="p-3 bg-white rounded-[10px] text-[11px] space-y-1.5 border border-[#edecfb]/60">
                  <div className="flex items-center justify-between">
                    <span className="font-[480] text-[#28253b]">Reference #{refSearchResult.requestId}</span>
                    <Badge className="bg-[#edecfb] text-[#5266eb] border-0 text-[10px] rounded-full">
                      {refSearchResult.code}
                    </Badge>
                  </div>
                  <p className="text-[#554e7b]"><strong className="text-[#28253b]">Likely Cause:</strong> {refSearchResult.likelyCause || 'Unknown error'}</p>
                  {refSearchResult.matchedVariant && (
                    <p className="text-[#554e7b]"><strong className="text-[#28253b]">Diagnostic Variant:</strong> {refSearchResult.matchedVariant}</p>
                  )}
                  {refSearchResult.receivedHeaderPrefix8 && (
                    <p className="text-[#554e7b]"><strong className="text-[#28253b]">Received Hash Prefix:</strong> <code className="font-mono">{refSearchResult.receivedHeaderPrefix8}...</code></p>
                  )}
                  <p className="text-[10px] text-[#70707d]">{new Date(refSearchResult.timestamp).toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* STEP 4: Enforcement Mode Control */}
        <Card className="bg-white rounded-[16px] shadow-sm border-0" data-testid="seb-enforcement-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                4
              </span>
              <CardTitle className="text-sm font-[480] text-[#28253b]">
                Enforcement mode control
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs text-[#554e7b] font-[360]">
            <div className="p-4 rounded-[12px] bg-[#fbfbff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  status.effectiveMode === 'enforce' ? 'bg-[#edecfb] text-[#5266eb]' : 'bg-white text-[#554e7b]'
                }`}>
                  {status.effectiveMode === 'enforce' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-[480] text-[#28253b]">
                      {status.effectiveMode === 'enforce' ? 'Strict Enforcement Active' : 'Audit Mode (Standard Browsers Allowed)'}
                    </h3>
                  </div>
                  <p className="text-xs text-[#554e7b] font-[360] mt-1 leading-relaxed max-w-xl">
                    {status.effectiveMode === 'enforce'
                      ? 'Safe Exam Browser is strictly enforced. Students attempting to start secure exams via Chrome, Edge, Safari or Firefox will be blocked.'
                      : 'Students can take secure exams using regular browsers without being blocked. Enable strict enforcement once desktop verification is confirmed.'}
                  </p>
                  {status.enforcementReason && (
                    <p className="text-[11px] text-[#8a6a26] font-[420] mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{status.enforcementReason}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="sm:self-center shrink-0">
                {status.effectiveMode === 'enforce' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={updatingMode}
                    onClick={() => handleUpdateMode('audit')}
                  >
                    {updatingMode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Unlock className="w-3.5 h-3.5 mr-1.5 text-[#554e7b]" />}
                    Return to Audit Mode
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={updatingMode || !status.configured || !isVerifiedRecent || !isConfigVersionValid}
                    onClick={() => setConfirmEnforceOpen(true)}
                  >
                    {updatingMode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Lock className="w-3.5 h-3.5 mr-1.5" />}
                    Enable Strict Enforcement
                  </Button>
                )}
              </div>
            </div>

            {/* Invariant Guidance Notice */}
            {!isVerifiedRecent && status.configured && (
              <div className="text-[11px] text-[#8a6a26] bg-[#fbfbff] p-3 rounded-[10px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#8a6a26]" />
                <span>
                  {!isConfigVersionValid
                    ? 'Configuration mismatch: The configuration file or key was modified since the last verification test. Complete Step 3 ("Test my setup") to re-verify before enabling strict enforcement.'
                    : 'Safety invariant: Strict enforcement can only be enabled after a verified test ping within the last 7 days. Complete Step 3 above to verify your setup.'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal for Strict Enforcement */}
      {confirmEnforceOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-xl space-y-4 font-sans animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-[480] text-[#28253b]">Enable Strict Enforcement?</h3>
            </div>
            <p className="text-xs text-[#554e7b] leading-relaxed font-[360]">
              When strict enforcement is active, <strong>all candidates taking secure exams must use Safe Exam Browser</strong>. Anyone attempting to start the exam from a standard browser (Chrome, Edge, Firefox, or Safari) will be prevented from launching the exam.
            </p>
            <div className="p-3 bg-[#fbfbff] rounded-[10px] text-[11px] text-[#28253b]">
              ✓ Verified ping confirmed on {new Date(status.lastVerifiedAt).toLocaleDateString()}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmEnforceOpen(false)}
                disabled={updatingMode}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleUpdateMode('enforce')}
                disabled={updatingMode}
              >
                {updatingMode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Confirm Strict Enforcement
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
