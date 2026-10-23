import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, RefreshCw, LogOut, CheckCircle2, Shield, AlertTriangle } from 'lucide-react'

export default function PendingApprovalPage() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')

  const handleCheckStatus = async () => {
    setChecking(true)
    setMessage('')
    try {
      const updated = await refreshUser()
      if (updated?.status === 'ACTIVE') {
        const role = updated.role
        if (role === 'FACULTY') navigate('/faculty/exams')
        else navigate('/student/dashboard')
        return
      }
      if (updated?.status === 'REJECTED') {
        navigate('/onboarding')
        return
      }
      setMessage('Your submission is still currently in the administrative verification queue.')
    } catch (_) {
      setMessage('Failed to refresh status. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  const meta = user?.profileMetadata || {}

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] flex flex-col justify-between font-sans">
      {/* Mercury Light Framing Nav Bar: 72px */}
      <header className="h-[72px] bg-white border-b border-[#e9eaf2] px-6 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-sm shadow-xs">P</div>
          <span className="font-[480] text-[#28253b] text-base tracking-wide">ProctorNet Verification</span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-[420] text-[#554e7b] hover:text-[#28253b] px-3.5 py-1.5 rounded-full bg-[#fbfbff] border border-[#e9eaf2] flex items-center gap-1.5 cursor-pointer transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </header>

      <div className="w-full max-w-lg mx-auto my-auto py-8 px-4">
        <Card className="border-[#e9eaf2] bg-white rounded-xl shadow-[0_1px_3px_rgba(40,37,59,0.04)] overflow-hidden text-center">
          <CardHeader className="pt-8 pb-4">
            <div className="w-16 h-16 rounded-full bg-[#5266eb]/10 border border-[#5266eb]/20 text-[#5266eb] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-[480] text-[#28253b]">
              Identity Profile Under Review
            </CardTitle>
            <CardDescription className="text-xs text-[#554e7b] max-w-sm mx-auto mt-1 leading-relaxed font-[360]">
              Your onboarding information and College ID documents have been submitted to institutional administration for verification.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-6 text-left">
            <div className="p-4 rounded-xl bg-[#fbfbff] border border-[#e9eaf2] text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-[#e9eaf2]">
                <span className="text-[#554e7b] font-[400]">Student Name</span>
                <span className="font-[480] text-[#28253b]">{user?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#e9eaf2]">
                <span className="text-[#554e7b] font-[400]">Institutional Email</span>
                <span className="font-mono text-[#28253b]">{user?.email || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#e9eaf2]">
                <span className="text-[#554e7b] font-[400]">Roll No / ID</span>
                <span className="font-mono font-[480] text-[#5266eb]">{user?.institutionId || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#554e7b] font-[400]">Department</span>
                <span className="font-[420] text-[#28253b]">{meta.department || 'General'}</span>
              </div>
            </div>

            <div className="p-3 bg-[#edecfb] rounded-xl text-xs text-[#554e7b] flex items-start gap-2.5 border-0">
              <Shield className="w-4 h-4 shrink-0 text-[#5266eb] mt-0.5" />
              <div className="leading-relaxed font-[360]">
                Once an administrator reviews your ID card photo and reference facial snapshot, your account status will transition to <strong className="text-[#5266eb] font-[500]">ACTIVE</strong> and grant full exam access.
              </div>
            </div>

            {message && (
              <div className="p-2.5 bg-[#5266eb]/10 border border-[#5266eb]/20 rounded-xl text-xs text-[#5266eb] text-center font-[420]">
                {message}
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-2">
            <Button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full h-10 bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking Status...' : 'Check Approval Status'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Mercury Light Footer */}
      <footer className="bg-white text-[#554e7b] border-t border-[#e9eaf2] px-6 sm:px-8 py-3.5 text-xs flex items-center justify-between font-[360]">
        <span className="text-[#28253b] font-[480]">ProctorNet Identity Assurance</span>
        <span className="text-[11px] text-[#554e7b]">Institutional Verification Queue</span>
      </footer>
    </div>
  )
}
