import React, { useState, useEffect } from 'react'
import { api } from '@/lib/apiClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCw,
  Loader2,
  Copy,
  Check,
  Globe,
  ExternalLink
} from 'lucide-react'

export default function SebDiagnosticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const fetchDiagnostics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/seb/diagnostics')
      setData(res.data)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch diagnostic state')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  const copyRef = async (ref) => {
    if (!ref) return
    try {
      await navigator.clipboard.writeText(ref)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] flex flex-col items-center justify-center p-6 text-[#28253b] font-sans">
      <div className="w-full max-w-xl space-y-4">
        <Card className="bg-[#ffffff] rounded-[24px] border-0 shadow-[0_4px_20px_rgba(40,37,59,0.04)]">
          <CardHeader className="pb-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-[480] text-[#28253b]">
              Safe Exam Browser Diagnostics
            </CardTitle>
            <p className="text-xs text-[#554e7b] font-[360] mt-1">
              Live client handshake and security configuration inspection
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-[360]">
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-[#554e7b]">
                <Loader2 className="w-5 h-5 animate-spin text-[#5266eb]" />
                <span className="text-xs">Inspecting browser headers and configuration...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-[16px] bg-[#fbfbff] text-[#c04b4b] text-xs text-center space-y-2">
                <p>{error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={fetchDiagnostics}
                  className="rounded-[40px]"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Reference ID Banner */}
                <div className="p-3.5 rounded-[16px] bg-[#edecfb]/50 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#554e7b] font-[500]">Diagnostic Reference</span>
                    <p className="font-mono text-xs text-[#28253b] font-[480]">#{data?.diagnosticRef || 'N/A'}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => copyRef(data?.diagnosticRef)}
                    className="rounded-[40px] px-3 text-[11px] h-7 bg-white/80 hover:bg-white"
                  >
                    {copied ? <Check className="w-3 h-3 mr-1 text-[#5266eb]" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                {/* Diagnostics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-[14px] bg-[#fbfbff] space-y-1">
                    <span className="text-[11px] text-[#554e7b] font-[420]">Browser Runtime</span>
                    <div className="flex items-center gap-1.5">
                      {data?.isSebAgent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#70707d]" />
                      )}
                      <span className="font-[480] text-[#28253b]">
                        {data?.isSebAgent ? 'Safe Exam Browser' : 'Standard Browser'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-[14px] bg-[#fbfbff] space-y-1">
                    <span className="text-[11px] text-[#554e7b] font-[420]">Configuration Header</span>
                    <div className="flex items-center gap-1.5">
                      {data?.sebHeaderPresent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />
                      )}
                      <span className="font-[480] text-[#28253b]">
                        {data?.sebHeaderPresent ? 'Header Present' : 'Header Missing'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-[14px] bg-[#fbfbff] space-y-1">
                    <span className="text-[11px] text-[#554e7b] font-[420]">Cryptographic Key Match</span>
                    <div className="flex items-center gap-1.5">
                      {data?.sebHeaderMatch ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#c04b4b]" />
                      )}
                      <span className="font-[480] text-[#28253b]">
                        {data?.sebHeaderMatch ? 'Confirmed Match ✓' : 'Mismatch / Not Verified'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-[14px] bg-[#fbfbff] space-y-1">
                    <span className="text-[11px] text-[#554e7b] font-[420]">Enforcement Mode</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-[480] text-[#28253b] capitalize">
                        {data?.effectiveMode || 'off'}
                      </span>
                      <Badge className="bg-[#edecfb] text-[#5266eb] border-0 text-[10px] rounded-full px-2 py-0">
                        {data?.effectiveMode === 'enforce' ? 'Strict' : 'Audit'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Origin & Version */}
                <div className="p-3 rounded-[14px] bg-[#fbfbff] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#554e7b] flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" /> Canonical Public Origin
                    </span>
                    <code className="text-[#28253b] font-mono">{data?.publicOrigin || 'N/A'}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#554e7b]">Config Version Hash</span>
                    <code className="text-[#28253b] font-mono">{data?.configVersion || 'None'}</code>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={fetchDiagnostics}
                    className="rounded-[40px] text-xs"
                  >
                    <RotateCw className="w-3.5 h-3.5 mr-1.5 text-[#554e7b]" /> Re-check
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => { window.location.href = '/seb/enter' }}
                    className="rounded-[32px] text-xs"
                  >
                    Enter Exam Launch PIN
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
