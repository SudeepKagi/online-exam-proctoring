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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg mx-auto pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-bold text-slate-900 text-sm">ProctorNet Verification</span>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      <div className="w-full max-w-lg mx-auto my-auto py-6">
        <Card className="border-slate-200 shadow-md bg-white rounded-2xl overflow-hidden text-center">
          <CardHeader className="pt-8 pb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-black text-slate-900">
              Identity Profile Under Review
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Your onboarding information and College ID documents have been submitted to institutional administration for verification.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-6 text-left">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Candidate Name</span>
                <span className="font-bold text-slate-900">{user?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Institutional Email</span>
                <span className="font-mono text-slate-700">{user?.email || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Roll No / ID</span>
                <span className="font-mono font-bold text-blue-600">{user?.institutionId || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Department</span>
                <span className="font-medium text-slate-800">{meta.department || 'General'}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                Once an administrator reviews your ID card photo and reference facial snapshot, your account status will transition to <strong className="text-emerald-700">ACTIVE</strong> and grant full exam access.
              </div>
            </div>

            {message && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 text-center font-medium">
                {message}
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-2">
            <Button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking Status...' : 'Check Approval Status'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="text-center text-[11px] text-slate-400 pb-2">
        Institutional Identity Verification Powered by AWS Rekognition
      </div>
    </div>
  )
}
