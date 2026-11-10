import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/apiClient'
import { ShieldAlert, Download, ExternalLink, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'

export default function SebRequiredPage() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [checking, setChecking] = useState(false)

  const downloadUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEB_DOWNLOAD_URL) || 'https://safeexambrowser.org/download_en.html'
  const configUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SEB_CONFIG_URL : null

  useEffect(() => {
    let active = true
    if (id) {
      apiClient.get(`/exams/${id}`)
        .then((res) => {
          if (!active) return
          setExam(res.data?.exam || res.data)
        })
        .catch(() => {})
    }
    return () => { active = false }
  }, [id])

  const handleRecheck = async () => {
    setChecking(true)
    try {
      const res = await apiClient.get(`/attempts/exams/${id}/seb-status`)
      if (res.data?.verified) {
        window.location.href = `/student/exams/${id}/pre-check`
        return
      }
    } catch (_) {}
    setChecking(false)
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] flex items-center justify-center p-4 font-sans text-[#28253b]">
      <Card className="w-full max-w-lg border-0 bg-white shadow-md rounded-[16px] overflow-hidden">
        <CardHeader className="text-center pb-4 pt-6 bg-[#fbfbff]">
          <div className="w-14 h-14 rounded-full bg-[#edecfb] text-[#5266eb] mx-auto flex items-center justify-center mb-3">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <Badge variant="outline" className="border-0 bg-[#edecfb] text-[#554e7b] text-xs font-[420] mx-auto mb-2">
            Kiosk Lockdown Required
          </Badge>
          <CardTitle className="text-xl font-[480] text-[#28253b]">
            Safe Exam Browser Required
          </CardTitle>
          <CardDescription className="text-xs font-[360] text-[#554e7b] max-w-sm mx-auto mt-1">
            {exam?.title
              ? `"${exam.title}" must be taken inside Safe Exam Browser.`
              : 'This assessment requires the official Safe Exam Browser environment.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="p-3.5 bg-[#edecfb] rounded-[12px] text-xs text-[#28253b] font-[420] space-y-1.5 border-0">
            <div className="flex items-center gap-1.5 font-[480] text-[#5266eb]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Assessment Security Notice</span>
            </div>
            <p className="font-[360] text-[#554e7b] leading-relaxed">
              Standard web browsers are restricted for this exam. Safe Exam Browser locks your computer into a secure kiosk mode, disabling unauthorized applications, secondary monitors, and shortcuts during the session.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            {configUrl && (
              <Button
                asChild
                className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] gap-2 shadow-xs cursor-pointer"
              >
                <a href={configUrl}>
                  <ExternalLink className="w-4 h-4" /> Open in SEB
                </a>
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              className={`w-full text-xs font-[420] h-10 rounded-[40px] gap-2 border-0 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] cursor-pointer ${
                !configUrl ? 'bg-[#5266eb] hover:bg-[#4353c7] text-white' : ''
              }`}
            >
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" /> Download Safe Exam Browser
              </a>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleRecheck}
              disabled={checking}
              className="w-full text-xs font-[420] h-9 rounded-[40px] gap-1.5 text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] cursor-pointer border-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking Connection...' : 'Re-check Browser Status'}
            </Button>
          </div>

          {/* Troubleshooting Section */}
          <div className="pt-3 border-t border-[#e9eaf2] space-y-2">
            <h4 className="text-xs font-[480] text-[#28253b]">Troubleshooting &amp; Setup Instructions:</h4>
            <ul className="text-[11px] font-[360] text-[#554e7b] space-y-1.5 pl-1 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb] mt-1 shrink-0" />
                <span><strong>Already running SEB?</strong> Ensure your configuration matches the exam key provided by your institution.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb] mt-1 shrink-0" />
                <span><strong>Close conflicting apps:</strong> Screen recording, meeting software (Zoom, Teams, Discord), and remote desktop clients must be fully terminated before launching SEB.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5266eb] mt-1 shrink-0" />
                <span><strong>Single display:</strong> Disconnect any external monitors or secondary screens.</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs font-[420] text-[#554e7b] hover:text-[#28253b] gap-1 rounded-[40px] cursor-pointer border-0"
            >
              <Link to="/student/dashboard">
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Student Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

