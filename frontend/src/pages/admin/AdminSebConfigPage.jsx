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
  ShieldAlert,
  Lock,
  Unlock,
  Upload,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Loader2,
  Copy,
  Check,
  Play,
  HelpCircle,
  Laptop
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
    missingDetails: null
  })
  const [loading, setLoading] = useState(true)
  const [storageHealth, setStorageHealth] = useState({ ok: true, status: 'OK' })
  const [checkingStorage, setCheckingStorage] = useState(false)
  const [publicOrigin, setPublicOrigin] = useState('')
  const [file, setFile] = useState(null)
  const [configKey, setConfigKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pollCountdown, setPollCountdown] = useState(0)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [storageRetryable, setStorageRetryable] = useState(false)
  const [warningMsg, setWarningMsg] = useState('')
  const [updatingMode, setUpdatingMode] = useState(false)
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

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/admin/seb/status')
      if (res?.data) {
        setStatus(res.data)
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
      const downState = { ok: false, status: 'Down', error: err.message }
      setStorageHealth(downState)
      return downState
    }
  }

  const fetchPublicConfig = async () => {
    try {
      const res = await apiClient.get('/config')
      if (res.data?.publicOrigin) {
        setPublicOrigin(res.data.publicOrigin)
      }
    } catch (_) {}
  }

  const refreshStorage = async () => {
    setCheckingStorage(true)
    try {
      const res = await fetchStorageHealth(true)
      if (res?.ok) {
        setMsg({ text: 'Object storage connectivity verified: OK', type: 'success' })
        setStorageRetryable(false)
      } else {
        setMsg({ text: 'Storage check failed: ' + (res?.error || 'Down'), type: 'error' })
      }
    } finally {
      setCheckingStorage(false)
    }
  }

  // Initial load and continuous 4s status auto-polling
  useEffect(() => {
    fetchStatus()
    fetchStorageHealth()
    fetchPublicConfig()

    const pollInterval = setInterval(() => {
      fetchStatus()
    }, 4000)

    return () => {
      clearInterval(pollInterval)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

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
    }
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
    setWarningMsg('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('configKey', cleanedKey)

      const res = await apiClient.post('/admin/seb/config', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.warning) {
        setWarningMsg(res.data.warning)
      }

      setStatus(res.data.status)
      setFile(null)
      setConfigKey('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setStorageRetryable(false)
      setMsg({ text: 'Safe Exam Browser configuration saved successfully.', type: 'success' })
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
      setWarningMsg('')
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to remove configuration'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestSetup = async () => {
    setTesting(true)
    setMsg({ text: '', type: '' })
    initialVerifiedAtRef.current = status.lastVerifiedAt

    try {
      const res = await apiClient.post('/seb/launch-link')
      const launchUrl = res.data?.url
      if (!launchUrl) {
        throw new Error('Launch URL was not returned by server.')
      }

      // Open in Safe Exam Browser via custom scheme protocol
      window.location.href = launchUrl

      // Countdown timer for 120s
      let secondsLeft = 120
      setPollCountdown(secondsLeft)

      if (pollTimerRef.current) clearInterval(pollTimerRef.current)

      pollTimerRef.current = setInterval(async () => {
        secondsLeft -= 3
        setPollCountdown(Math.max(0, secondsLeft))

        const latest = await fetchStatus()
        if (latest?.lastVerifiedAt && latest.lastVerifiedAt !== initialVerifiedAtRef.current) {
          clearInterval(pollTimerRef.current)
          setTesting(false)
          setPollCountdown(0)
          setMsg({ text: 'Verification confirmed! Safe Exam Browser communicated successfully.', type: 'success' })
        } else if (secondsLeft <= 0) {
          clearInterval(pollTimerRef.current)
          setTesting(false)
          setPollCountdown(0)
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

  const startUrl = `${publicOrigin || 'https://proctornet.duckdns.org'}/student/login`
  const reconfigUrl = `${publicOrigin || 'https://proctornet.duckdns.org'}/*`
  const cleanedKeyInput = configKey.trim().toLowerCase()
  const isKeyExactLength = cleanedKeyInput.length === 64
  const isKeyValidHex = /^[0-9a-f]{64}$/.test(cleanedKeyInput)

  return (
    <DashboardShell title="Secure browser setup">
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Header Intro Banner */}
        <div className="bg-white rounded-[16px] p-6 shadow-sm border border-[#edecfb]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#edecfb] flex items-center justify-center text-[#5266eb]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-[480] text-[#28253b]">Safe Exam Browser Configuration</h1>
              <p className="text-xs text-[#554e7b] font-[360] mt-0.5">
                Configure institution-wide Safe Exam Browser settings. Once verified, candidates can launch secure examinations in one click.
              </p>
            </div>
          </div>

          {/* Live Status Indicators Bar */}
          <div className="mt-5 pt-4 border-t border-[#edecfb] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Status */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Configuration Status</span>
              {status.configured ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#5266eb]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Not Configured
                </span>
              )}
            </div>

            {/* Verification */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Verification</span>
              {status.lastVerifiedAt ? (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#5266eb]" data-testid="seb-verified-pill">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-[480] text-[#8a6a26]" data-testid="seb-awaiting-pill">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8a6a26]" /> Awaiting verification
                </span>
              )}
            </div>

            {/* Effective Mode */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-1">
              <span className="text-[#554e7b] font-[420] text-[11px]">Enforcement Mode</span>
              <span className="font-[480] text-[#28253b] capitalize">
                {status.effectiveMode || 'audit'}
                {status.requestedMode !== status.effectiveMode && (
                  <span className="text-[10px] text-[#554e7b] font-[360] ml-1">
                    (Req: {status.requestedMode})
                  </span>
                )}
              </span>
            </div>

            {/* Storage Health */}
            <div className="bg-[#fbfbff] p-3 rounded-[12px] border border-[#edecfb]/60 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[#554e7b] font-[420] text-[11px]">Object Storage</span>
                {!storageHealth?.ok && (
                  <button
                    type="button"
                    onClick={refreshStorage}
                    disabled={checkingStorage}
                    className="text-[10px] text-[#5266eb] hover:underline"
                  >
                    {checkingStorage ? 'Checking...' : 'Retry'}
                  </button>
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 font-[480] ${storageHealth?.ok ? 'text-[#5266eb]' : 'text-[#c04b4b]'}`}>
                {storageHealth?.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {storageHealth?.ok ? 'Connected (S3)' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {msg.text && (
          <div
            className={`p-3.5 rounded-[12px] text-xs font-[420] flex items-center justify-between gap-3 ${
              msg.type === 'error'
                ? 'bg-[#edecfb] text-[#28253b]'
                : 'bg-[#edecfb] text-[#28253b]'
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
                size="sm"
                onClick={handleUpload}
                disabled={submitting}
                className="h-7 px-3 text-xs rounded-full bg-white text-[#5266eb] hover:bg-[#fbfbff] shrink-0"
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Retry
              </Button>
            )}
          </div>
        )}

        {warningMsg && (
          <div className="p-3.5 rounded-[12px] text-xs font-[360] bg-[#edecfb] text-[#28253b] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#554e7b] shrink-0 mt-0.5" />
            <div>
              <p className="font-[420]">Security Notice</p>
              <p className="mt-0.5">{warningMsg}</p>
            </div>
          </div>
        )}

        {/* Institution Enforcement Mode Control */}
        {status.configured && (
          <div className="bg-white rounded-[16px] p-5 shadow-sm border border-[#edecfb]/60 space-y-3" data-testid="seb-enforcement-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  status.effectiveMode === 'enforce' ? 'bg-[#edecfb] text-[#5266eb]' : 'bg-[#fbfbff] text-[#554e7b] border border-[#edecfb]'
                }`}>
                  {status.effectiveMode === 'enforce' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-[480] text-[#28253b]">Enforcement Mode</h3>
                    <Badge variant={status.effectiveMode === 'enforce' ? 'default' : 'secondary'} className="text-[10px] font-[480] rounded-full px-2 py-0.5">
                      {status.effectiveMode === 'enforce' ? 'Strict Enforcement Active' : 'Audit Mode (Standard Browsers Allowed)'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#554e7b] font-[360] mt-1 leading-relaxed max-w-xl">
                    {status.effectiveMode === 'enforce'
                      ? 'Safe Exam Browser is strictly enforced. Students attempting to start secure exams via Chrome, Edge, or Firefox will be blocked.'
                      : 'Students can take secure exams using regular browsers without being blocked. Enable strict enforcement once desktop verification is confirmed.'}
                  </p>
                </div>
              </div>

              <div className="sm:self-center shrink-0">
                {status.effectiveMode === 'enforce' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updatingMode}
                    onClick={() => handleUpdateMode('audit')}
                    className="h-8 px-3 text-xs rounded-full border border-[#edecfb] text-[#554e7b] hover:bg-[#fbfbff] font-[420]"
                  >
                    {updatingMode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Unlock className="w-3.5 h-3.5 mr-1.5 text-[#554e7b]" />}
                    Switch to Audit Mode
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={updatingMode || !status.lastVerifiedAt}
                    onClick={() => handleUpdateMode('enforce')}
                    className="h-8 px-4 text-xs rounded-full bg-[#5266eb] hover:bg-[#4355d6] text-white font-[420] shadow-sm disabled:opacity-50"
                  >
                    {updatingMode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Lock className="w-3.5 h-3.5 mr-1.5" />}
                    Enable Strict Enforcement
                  </Button>
                )}
              </div>
            </div>

            {status.effectiveMode !== 'enforce' && !status.lastVerifiedAt && (
              <div className="text-[11px] text-[#8a6a26] bg-[#fbfbff] p-2.5 rounded-[10px] border border-[#edecfb]/60 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>To enable strict enforcement, perform a verified test launch first using Step 3 below.</span>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Install Config Tool & Configuration Checklist */}
        <Card className="bg-white rounded-[16px] shadow-sm border border-[#edecfb]/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  1
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  SEB Configuration Tool settings guide
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
              Open the SEB Configuration Tool on your workstation. Verify each of the following required settings before saving your configuration:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* General Tab */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> General Tab
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Set <strong>Start URL</strong> to your candidate login page:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2 py-1 rounded-[6px] border border-[#edecfb] font-mono text-[#28253b] truncate flex-1">
                    {startUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(startUrl, 'startUrl')}
                    className="h-7 px-2.5 text-[11px] rounded-full border-[#5266eb]/30 text-[#5266eb] hover:bg-[#edecfb] cursor-pointer shrink-0"
                  >
                    {copiedField === 'startUrl' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'startUrl' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Exam Tab */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Config File Tab
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Check <strong>"Use Browser Exam Key and Configuration Key"</strong>. After saving your <code>.seb</code> file, copy the <strong>Configuration Key</strong>.
                </p>
                <div className="p-2 bg-[#edecfb]/60 rounded-[8px] text-[11px] text-[#28253b] font-[420]">
                  💡 Copy the <strong>Configuration Key</strong> (64 hex characters), NOT the Browser Exam Key!
                </div>
              </div>

              {/* Reconfiguring URL */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Session / Quitting
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Check <strong>"Ask user to confirm quitting"</strong> in the Exam tab so students can safely close SEB when finished.
                </p>
              </div>

              {/* Reconfiguring URL */}
              <div className="bg-[#fbfbff] p-3.5 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Reconfiguring URL
                </div>
                <p className="text-[11px] text-[#70707d]">
                  If using reconfiguring URL, set to allow the platform domain:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2 py-1 rounded-[6px] border border-[#edecfb] font-mono text-[#28253b] truncate flex-1">
                    {reconfigUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(reconfigUrl, 'reconfigUrl')}
                    className="h-7 px-2.5 text-[11px] rounded-full border-[#5266eb]/30 text-[#5266eb] hover:bg-[#edecfb] cursor-pointer shrink-0"
                  >
                    {copiedField === 'reconfigUrl' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'reconfigUrl' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Upload .seb and Paste Config Key */}
        <Card className="bg-white rounded-[16px] shadow-sm border border-[#edecfb]/60">
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

              {/* Config Key input with character count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-[420] text-[#28253b]">
                    Configuration Key (64-character hex)
                  </label>
                  <span className={`text-[11px] font-[480] ${isKeyValidHex ? 'text-[#5266eb]' : 'text-[#70707d]'}`}>
                    {isKeyValidHex ? (
                      <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#5266eb]" /> 64 / 64 characters (Valid)</span>
                    ) : (
                      `${cleanedKeyInput.length} / 64 characters`
                    )}
                  </span>
                </div>
                <Input
                  type="text"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  placeholder={status.keyLast4 ? `Currently: ••••••••${status.keyLast4} (Paste new key to replace)` : 'Paste 64-character hexadecimal key from SEB Config Tool'}
                  className="font-mono text-xs rounded-xl border-[#edecfb] bg-[#fbfbff] h-10"
                />
                <p className="text-[11px] text-[#554e7b] font-[420] mt-1">
                  Copy the <strong>CONFIG KEY</strong> from the Config File tab, not the Browser Exam Key. The key is never exposed to students or S3 metadata.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || !file || !isKeyValidHex}
                  className="rounded-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-9 px-5 border-0 cursor-pointer"
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
                    variant="outline"
                    onClick={handleRemove}
                    disabled={submitting}
                    className="rounded-full bg-[#edecfb] text-[#28253b] hover:bg-[#e0dff9] text-xs font-[420] h-9 px-4 border-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#554e7b] mr-1.5" /> Remove configuration
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Step 3: Test & Verify Setup */}
        <Card className="bg-white rounded-[16px] shadow-sm border border-[#edecfb]/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#edecfb] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  3
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  Test and verify setup
                </CardTitle>
              </div>
              {status.lastVerifiedAt && (
                <Badge className="bg-[#edecfb] text-[#5266eb] border-0 rounded-full px-3 py-0.5 font-[420]">
                  Verified ✓
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs text-[#554e7b] font-[360]">
            <p>
              Verify that Safe Exam Browser communicates with ProctorNet. You can test using either of two methods:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Method A: Direct Launch */}
              <div className="bg-[#fbfbff] p-4 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[480] text-[#28253b] flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-[#5266eb]" /> Method A: Open on Workstation
                </div>
                <p className="text-[11px] text-[#70707d] leading-relaxed">
                  Open your saved <code>.seb</code> configuration file on your computer. When Safe Exam Browser launches and displays the ProctorNet login page, this dashboard automatically receives the verification ping!
                </p>
              </div>

              {/* Method B: Protocol Launch */}
              <div className="bg-[#fbfbff] p-4 rounded-[12px] border border-[#edecfb]/60 space-y-2">
                <div className="font-[480] text-[#28253b] flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-[#5266eb]" /> Method B: Test My Setup Button
                </div>
                <p className="text-[11px] text-[#70707d] leading-relaxed">
                  Click the button below to generate a secure launch token and launch Safe Exam Browser via custom protocol URL.
                </p>
                <div className="pt-1">
                  <Button
                    type="button"
                    onClick={handleTestSetup}
                    disabled={testing || !status.configured}
                    className="rounded-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-8 px-4 border-0 cursor-pointer"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Listening for ping ({pollCountdown}s)...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Test my setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Diagnostic Details Card */}
            {status.configured && (
              <div className="mt-4 p-4 rounded-[12px] bg-[#fbfbff] border border-[#edecfb]/60 space-y-2 text-xs">
                <h4 className="font-[480] text-[#28253b] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#5266eb]" /> Diagnostic Status
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-[#70707d]">Last Verified Timestamp:</span>{' '}
                    <span className="font-[420] text-[#28253b]">
                      {status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : 'Awaiting first test ping'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#70707d]">Verification Protocol:</span>{' '}
                    <span className="font-[420] text-[#28253b]">
                      {status.lastVerifiedMethod === 'javascript_api'
                        ? 'JavaScript Security API'
                        : (status.lastVerifiedMethod === 'header_hash'
                          ? 'Cryptographic Header Hash'
                          : (status.lastVerifiedMethod || (status.lastVerifiedAt ? 'Active' : 'Pending')))}
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
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
