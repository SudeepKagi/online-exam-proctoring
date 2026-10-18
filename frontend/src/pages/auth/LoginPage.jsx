import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, AlertCircle, ArrowLeft, KeyRound, UserCheck, GraduationCap, Building2 } from 'lucide-react'

const ROLE_CONFIG = {
  STUDENT: {
    title: 'Student Portal',
    desc: 'Access your proctored examinations and results',
    idLabel: 'Roll Number (USN) or College Email',
    idPlaceholder: 'e.g. 1RV21CS001 or student@univ.edu',
    passLabel: 'Password',
    icon: GraduationCap
  },
  FACULTY: {
    title: 'Faculty Workspace',
    desc: 'Author exams, generate invigilators and manage grades',
    idLabel: 'Faculty Email or Employee ID',
    idPlaceholder: 'e.g. FAC-102 or prof.sharma@univ.edu',
    passLabel: 'Account Password',
    icon: Building2
  },
  INVIGILATOR: {
    title: 'Invigilator Access',
    desc: 'Live examination monitoring & candidate control',
    idLabel: 'Invigilator ID / Access Email',
    idPlaceholder: 'e.g. INV-A1B2 or invig.hall1@proctornet.local',
    passLabel: 'Exam Access Pin / Password',
    icon: UserCheck
  },
  ADMIN: {
    title: 'System Administrator',
    desc: 'Institutional identity verification & infrastructure governance',
    idLabel: 'Administrator Email',
    idPlaceholder: 'admin@proctornet.local',
    passLabel: 'Master Administrative Password',
    icon: Shield
  }
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const roleFromPath = (() => {
    const p = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase()
    if (p.includes('/admin')) return 'ADMIN'
    if (p.includes('/faculty')) return 'FACULTY'
    if (p.includes('/invigilator')) return 'INVIGILATOR'
    if (p.includes('/student')) return 'STUDENT'
    return null
  })()
  const initialRole = (searchParams.get('role') || roleFromPath || 'STUDENT').toUpperCase()
  const [activeRole, setActiveRole] = useState(ROLE_CONFIG[initialRole] ? initialRole : 'STUDENT')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const roleParam = searchParams.get('role')?.toUpperCase()
    if (roleParam && ROLE_CONFIG[roleParam] && roleParam !== activeRole) {
      setActiveRole(roleParam)
    }
  }, [searchParams])

  const handleRoleChange = (newRole) => {
    setActiveRole(newRole)
    setSearchParams({ role: newRole.toLowerCase() })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const credentials = {
      email: identifier.trim(),
      usn: identifier.trim(),
      institutionId: identifier.trim(),
      password
    }

    let res = await login(credentials, activeRole)
    if (!res.success && res.error && res.error.includes('Access denied for role')) {
      const fallbackRes = await login(credentials)
      if (fallbackRes.success) res = fallbackRes
    }
    setLoading(false)

    if (res.success) {
      const user = res.user
      const status = user?.status

      if (status === 'PENDING_SETUP' || status === 'REJECTED') {
        navigate('/onboarding')
        return
      }
      if (status === 'PENDING_APPROVAL') {
        navigate('/pending-approval')
        return
      }

      const role = user?.role || activeRole
      if (role === 'ADMIN') navigate('/admin/dashboard')
      else if (role === 'FACULTY') navigate('/faculty/exams')
      else if (role === 'INVIGILATOR') navigate('/invigilator/console')
      else navigate('/student/dashboard')
    } else {
      setError(res.error || 'Authentication failed. Please verify credentials.')
    }
  }

  const config = ROLE_CONFIG[activeRole] || ROLE_CONFIG.STUDENT
  const RoleIcon = config.icon

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg mx-auto pt-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full">
          Institutional Gateway
        </span>
      </div>

      <div className="w-full max-w-lg mx-auto my-auto py-6">
        <Card className="border-slate-200 shadow-md bg-white rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-3 pt-6 bg-slate-50/50 border-b border-slate-100">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl mx-auto flex items-center justify-center mb-2 shadow-sm shadow-blue-500/20">
              <RoleIcon className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-black tracking-tight text-slate-950">
              {config.title}
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              {config.desc}
            </CardDescription>

            <div className="pt-4">
              <Tabs value={activeRole} onValueChange={handleRoleChange} className="w-full">
                <TabsList className="grid grid-cols-4 bg-slate-200/70 p-1 rounded-xl">
                  <TabsTrigger value="STUDENT" className="text-[11px] font-bold rounded-lg py-1.5">Student</TabsTrigger>
                  <TabsTrigger value="FACULTY" className="text-[11px] font-bold rounded-lg py-1.5">Faculty</TabsTrigger>
                  <TabsTrigger value="INVIGILATOR" className="text-[11px] font-bold rounded-lg py-1.5">Invigilator</TabsTrigger>
                  <TabsTrigger value="ADMIN" className="text-[11px] font-bold rounded-lg py-1.5">Admin</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{config.idLabel}</Label>
                <Input
                  type="text"
                  required
                  placeholder={config.idPlaceholder}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-10 text-xs border-slate-300 focus-visible:ring-blue-600 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">{config.passLabel}</Label>
                  {activeRole === 'INVIGILATOR' && (
                    <span className="text-[10px] text-slate-400 font-medium">Provided by exam faculty</span>
                  )}
                </div>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 text-xs border-slate-300 focus-visible:ring-blue-600 rounded-xl"
                />
              </div>

              {activeRole === 'STUDENT' && (
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-700 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <span>First-time student? Sign in with your temporary password issued by administration to complete your biometric onboarding.</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2 pb-6 px-6">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                {loading ? 'Authenticating...' : `Sign In as ${activeRole.charAt(0) + activeRole.slice(1).toLowerCase()}`}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="text-center text-[11px] text-slate-400 pb-2">
        ProctorNet Institutional Examination Platform • Pure Browser Lockdown & Biometrics
      </div>
    </div>
  )
}
