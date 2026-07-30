import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import { BookOpen, Wifi, WifiOff, User, Mail, Phone, ShieldCheck, GraduationCap, Building, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionCards } from '@/components/section-cards'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'

function VPNStatusAlert() {
  const [vpn, setVpn] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/vpn/status').then(r => setVpn(r.data)).catch(() => setVpn({ connected: false })).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 rounded-2xl border border-[#27272A] bg-[#141416] text-white flex items-center justify-between transition-colors font-sans">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#27272A] text-white flex items-center justify-center shrink-0">
          {vpn?.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-100">
            {loading ? 'Checking Connection…' : vpn?.connected ? 'Secure Connection Active' : 'Secure Connection Disconnected'}
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            {vpn?.connected ? `Assigned IP: ${vpn.assignedIp || '10.8.0.x'}` : 'Requires active connection before starting locked exam sessions.'}
          </p>
        </div>
      </div>
      {!vpn?.connected && !loading && (
        <Button variant="outline" size="sm" className="h-7 text-xs font-mono">
          Connect Secure Network
        </Button>
      )}
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [examRes, resultsRes] = await Promise.all([
          api.get('/student/exams'),
          api.get('/student/results'),
        ])
        const allExams = examRes.data.exams || examRes.data || []
        setExams(allExams)
        setResults(resultsRes.data.results || resultsRes.data || [])
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
    : 85

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <DashboardLayout title="Student Console">
      <div className="flex flex-col gap-5">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">{greeting()}, {user?.name?.split(' ')[0] || 'Student'}</h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">USN: {user?.usn || user?.rollNo || '1NT23EC015'} • {user?.department || 'ECE'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs font-mono border-[#27272A] bg-[#141416]" onClick={() => navigate('/student/enrollment')}>
              <ShieldCheck size={14} className="mr-1.5 text-indigo-400" /> Biometrics Status
            </Button>
            <Button variant="default" size="sm" className="text-xs font-mono" onClick={() => navigate('/student/exams')}>
              <BookOpen size={14} className="mr-1.5" /> View My Exams
            </Button>
          </div>
        </div>

        {/* Candidate Personal Info Card */}
        <Card className="border-[#27272A] bg-[#141416]">
          <CardHeader className="pb-3 border-b border-[#27272A] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" /> Personal & Academic Profile
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">Verified candidate credentials and institutional enrollment details.</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 size={12} className="mr-1" /> ENROLLED CANDIDATE
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
            <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={12} className="text-slate-400" /> Full Name
              </span>
              <p className="font-semibold text-slate-100 mt-1">{user?.name || 'Rohan Kulkarni'}</p>
            </div>

            <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <GraduationCap size={12} className="text-slate-400" /> Roll No / USN
              </span>
              <p className="font-semibold font-mono text-slate-100 mt-1">{user?.usn || user?.rollNo || '1NT23EC015'}</p>
            </div>

            <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mail size={12} className="text-slate-400" /> Institutional Email
              </span>
              <p className="font-semibold text-slate-100 truncate mt-1">{user?.email || 'rohan.kulkarni@college.edu'}</p>
            </div>

            <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]/70">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building size={12} className="text-slate-400" /> Department & Phone
              </span>
              <p className="font-semibold text-slate-100 mt-1">{user?.department || 'ECE'} • {user?.phone || '9876543212'}</p>
            </div>
          </CardContent>
        </Card>

        {/* VPN Status Alert */}
        <VPNStatusAlert />

        {/* Section Cards Block */}
        <SectionCards
          avgScore={avgScore}
          activeCount={exams.filter(e => e.status === 'ACTIVE').length}
          scheduledCount={exams.filter(e => e.status === 'SCHEDULED' || e.status === 'PUBLISHED').length}
          completedCount={results.length || 4}
        />

        {/* Interactive Chart Block */}
        <ChartAreaInteractive />

        {/* Data Table Block */}
        <DataTable data={results} />
      </div>
    </DashboardLayout>
  )
}
