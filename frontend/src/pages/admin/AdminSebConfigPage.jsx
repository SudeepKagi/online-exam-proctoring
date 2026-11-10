import React, { useState, useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/common/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiClient, errorMessage } from '@/lib/apiClient'
import {
  ShieldCheck,
  Upload,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Loader2,
  FileText,
  Play
} from 'lucide-react'

export default function AdminSebConfigPage() {
  const [status, setStatus] = useState({
    configured: false,
    uploadedAt: null,
    keyLast4: null,
    lastVerifiedAt: null
  })
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [configKey, setConfigKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pollCountdown, setPollCountdown] = useState(0)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [warningMsg, setWarningMsg] = useState('')
  const [verifiedRecently, setVerifiedRecently] = useState(false)
  const fileInputRef = useRef(null)
  const pollTimerRef = useRef(null)
  const initialVerifiedAtRef = useRef(null)

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/admin/seb/status')
      setStatus(res.data)
      checkVerificationFreshness(res.data.lastVerifiedAt)
      return res.data
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to load SEB status'), type: 'error' })
      return null
    } finally {
      setLoading(false)
    }
  }

  const checkVerificationFreshness = (lastVerifiedAt) => {
    if (!lastVerifiedAt) {
      setVerifiedRecently(false)
      return false
    }
    const diffMs = Date.now() - new Date(lastVerifiedAt).getTime()
    // Verified within the last 2 minutes
    const isFresh = diffMs >= 0 && diffMs < 120000
    setVerifiedRecently(isFresh)
    return isFresh
  }

  useEffect(() => {
    fetchStatus()
    return () => {
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
      checkVerificationFreshness(res.data.status?.lastVerifiedAt)
      setFile(null)
      setConfigKey('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMsg({ text: 'Safe Exam Browser configuration saved successfully.', type: 'success' })
    } catch (err) {
      setMsg({ text: errorMessage(err, 'Failed to upload configuration'), type: 'error' })
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

      // Poll status every 3 seconds for up to 120 seconds (40 iterations)
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
          setVerifiedRecently(true)
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

  return (
    <DashboardShell title="Secure browser setup">
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Header Intro */}
        <div className="bg-[#fbfbff] rounded-[16px] p-6 shadow-[0_1px_3px_rgba(40,37,59,0.03)] border-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(82,102,235,0.10)] flex items-center justify-center text-[#5266eb]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-[480] text-[#28253b]">Secure browser setup</h1>
              <p className="text-xs text-[#554e7b] font-[360] mt-0.5">
                Configure institution-wide Safe Exam Browser settings once so candidates can launch verified exams in one click.
              </p>
            </div>
          </div>

          {/* Current Status Pill */}
          <div className="mt-4 pt-4 border-t border-[#e9eaf2] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#554e7b] font-[420]">Current Status:</span>
              {status.configured ? (
                <Badge className="bg-[rgba(82,102,235,0.10)] text-[#5266eb] border-0 rounded-full px-3 py-0.5 font-[420]">
                  Configured (Key: ••••••••{status.keyLast4 || 'env'})
                </Badge>
              ) : (
                <Badge className="bg-[#edecfb] text-[#554e7b] border-0 rounded-full px-3 py-0.5 font-[420]">
                  Not Configured
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#554e7b] font-[420]">Last Verified:</span>
              {verifiedRecently ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#28253b] font-[420] bg-[rgba(82,102,235,0.10)] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Verified ✓ just now
                </span>
              ) : status.lastVerifiedAt ? (
                <span className="text-[#70707d] font-[360]">
                  {new Date(status.lastVerifiedAt).toLocaleString()}
                </span>
              ) : (
                <span className="text-[#70707d] font-[360]">Never verified</span>
              )}
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {msg.text && (
          <div
            className={`p-3.5 rounded-[12px] text-xs font-[420] ${
              msg.type === 'error'
                ? 'bg-[#edecfb] text-[#28253b]'
                : 'bg-[rgba(82,102,235,0.08)] text-[#28253b]'
            }`}
          >
            {msg.text}
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

        {/* Step 1: Install Config Tool & Verify Checklist */}
        <Card className="bg-white rounded-[16px] shadow-[0_1px_3px_rgba(40,37,59,0.04)] border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[rgba(82,102,235,0.10)] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  1
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  Install Config Tool & settings checklist
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
          <CardContent className="space-y-3 pt-0 text-xs text-[#554e7b] font-[360]">
            <p>
              Open the SEB Configuration Tool on your workstation and verify each of the following required settings before saving your configuration:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-[#fbfbff] p-3 rounded-[12px] space-y-1">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Exam Tab
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Check <strong>"Use Browser Exam Key and Configuration Key"</strong> (send in HTTP header) so SEB transmits hash headers.
                </p>
              </div>

              <div className="bg-[#fbfbff] p-3 rounded-[12px] space-y-1">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> General Tab
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Set Reconfiguring URL to your application login URL (e.g. <code>http://localhost:5173/student/login</code>).
                </p>
              </div>

              <div className="bg-[#fbfbff] p-3 rounded-[12px] space-y-1">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Media / Camera
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Enable <strong>"Allow video capture"</strong> (webcam permission) so continuous facial verification is active.
                </p>
              </div>

              <div className="bg-[#fbfbff] p-3 rounded-[12px] space-y-1">
                <div className="font-[420] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> Session / Quitting
                </div>
                <p className="text-[11px] text-[#70707d]">
                  Set Quit URL to candidate result page and uncheck "Ask user to confirm quitting" for clean post-submission exit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Upload .seb and Paste Config Key */}
        <Card className="bg-white rounded-[16px] shadow-[0_1px_3px_rgba(40,37,59,0.04)] border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[rgba(82,102,235,0.10)] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
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
                    className="cursor-pointer inline-flex items-center gap-2 text-xs font-[420] px-4 py-2 rounded-full bg-[rgba(82,102,235,0.08)] text-[#28253b] hover:bg-[rgba(82,102,235,0.16)] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#5266eb]" />
                    {file ? file.name : 'Choose .seb file'}
                  </label>
                  {file && (
                    <span className="text-xs text-[#70707d] font-[360]">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#70707d] font-[360] mt-1">
                  Private upload stored securely in institution object storage. Maximum 500 KB.
                </p>
              </div>

              {/* Config Key input */}
              <div>
                <label className="block text-xs font-[420] text-[#28253b] mb-1.5">
                  Configuration Key (64-character hex)
                </label>
                <Input
                  type="text"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  placeholder="e.g. 43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c"
                  className="font-mono text-xs rounded-xl border-[#e9eaf2] bg-[#fbfbff]"
                />
                <p className="text-[11px] text-[#554e7b] font-[420] mt-1">
                  Copy the <strong>CONFIG KEY</strong>, not the Browser Exam Key. The key is never exposed to students or S3 metadata.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || !file || !configKey.trim()}
                  className="rounded-full bg-[#5266eb] text-white hover:bg-[#4354d0] text-xs font-[420] h-9 px-5 border-0"
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
                    className="rounded-full bg-[rgba(82,102,235,0.08)] text-[#28253b] hover:bg-[rgba(82,102,235,0.16)] text-xs font-[420] h-9 px-4 border-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#554e7b] mr-1.5" /> Remove configuration
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Step 3: Test My Setup */}
        <Card className="bg-white rounded-[16px] shadow-[0_1px_3px_rgba(40,37,59,0.04)] border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[rgba(82,102,235,0.10)] text-[#5266eb] text-xs font-[500] flex items-center justify-center">
                  3
                </span>
                <CardTitle className="text-sm font-[480] text-[#28253b]">
                  Test my setup
                </CardTitle>
              </div>
              {verifiedRecently && (
                <Badge className="bg-[rgba(82,102,235,0.10)] text-[#5266eb] border-0 rounded-full px-3 py-0.5 font-[420]">
                  Verified ✓ just now
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs text-[#554e7b] font-[360]">
            <p>
              Generate a secure launch token and launch Safe Exam Browser on this computer. When SEB requests the configuration and issues the startup ping, ProctorNet verifies the header hash in real-time.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={handleTestSetup}
                disabled={testing || !status.configured}
                className="rounded-full bg-[#5266eb] text-white hover:bg-[#4354d0] text-xs font-[420] h-9 px-5 border-0"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Listening for SEB ping ({pollCountdown}s)...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Test my setup
                  </>
                )}
              </Button>
            </div>

            {testing && (
              <div className="mt-3 p-3 rounded-[12px] bg-[#fbfbff] text-xs font-[360] text-[#554e7b] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#5266eb] shrink-0" />
                <span>
                  Safe Exam Browser launch triggered. Awaiting proof-of-use ping on <code>/api/v1/seb/ping</code>...
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

