import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import {
  BookOpen, User, Mail, GraduationCap, Building, CheckCircle2,
  ShieldCheck, Clock
} from 'lucide-react'
import { SectionCards } from '@/components/section-cards'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'

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
          api.get('/student/exams').catch(() => ({ data: { exams: [] } })),
          api.get('/student/results').catch(() => ({ data: { results: [] } })),
        ])
        const allExams = examRes.data?.exams || examRes.data || []
        setExams(Array.isArray(allExams) ? allExams : [])
        const allResults = resultsRes.data?.results || resultsRes.data || []
        setResults(Array.isArray(allResults) ? allResults : [])
      } catch (err) {
        console.error('[StudentDashboard] Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
    : 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const isVerified = user?.profileStatus === 'VERIFIED' || user?.profileStatus === 'LOCKED'

  // Calculate exam stats for the metric cards
  const now = new Date()
  const activeCount = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    return now >= start && now <= end && !isSubmitted && e.status !== 'ENDED'
  }).length

  const scheduledCount = exams.filter(e => {
    const start = new Date(e.startTime)
    const isSubmitted = e.studentStatus === 'SUBMITTED' || e.isSubmitted
    return now < start && !isSubmitted && e.status !== 'ENDED'
  }).length

  const completedCount = exams.filter(e => {
    return e.studentStatus === 'SUBMITTED' || e.isSubmitted
  }).length

  return (
    <DashboardLayout title="Student Console">
      <div className="space-y-6 font-sans text-[#0f172a]">
        
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">
                {greeting()}, {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              {isVerified && (
                <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#10b981] text-[10px] font-extrabold border border-[#a7f3d0] flex items-center gap-1">
                  <CheckCircle2 size={11} /> VERIFIED
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-1 font-normal">
              USN: <span className="font-mono font-semibold text-[#0f172a]">{user?.usn || user?.rollNo || 'N/A'}</span> • {user?.department || 'Engineering'} • Semester {user?.semester || 1}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/student/device-check')}
              className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold py-2 px-3.5 rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck size={15} className="text-[#2563eb]" />
              <span>BYOD Diagnostic</span>
            </button>
            <button
              onClick={() => navigate('/student/exams')}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-3.5 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <BookOpen size={15} />
              <span>All Examinations</span>
            </button>
          </div>
        </div>

        {/* Candidate Personal & Academic Profile Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                <User className="w-4 h-4 text-[#2563eb]" />
                Personal & Academic Profile
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Verified candidate credentials and institutional enrollment details.
              </p>
            </div>
            {isVerified ? (
              <span className="px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#10b981] text-[10px] font-bold uppercase tracking-wider border border-[#dcfce7] flex items-center gap-1">
                <CheckCircle2 size={12} />
                Verified Candidate
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-[#fffbeb] text-[#b45309] text-[10px] font-bold uppercase tracking-wider border border-[#fef3c7] flex items-center gap-1">
                <Clock size={12} />
                Under Admin Review
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <User size={13} className="text-[#94a3b8]" /> Full Name
              </span>
              <p className="font-bold text-[#0f172a] mt-1 text-sm">{user?.name || 'Candidate'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <GraduationCap size={13} className="text-[#94a3b8]" /> Roll No / USN
              </span>
              <p className="font-bold text-[#0f172a] font-mono mt-1 text-sm">{user?.usn || user?.rollNo || 'N/A'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <Mail size={13} className="text-[#94a3b8]" /> Institutional Email
              </span>
              <p className="font-bold text-[#0f172a] truncate mt-1 text-sm">{user?.email || 'N/A'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
                <Building size={13} className="text-[#94a3b8]" /> Department & Phone
              </span>
              <p className="font-bold text-[#0f172a] truncate mt-1 text-sm">{user?.department || 'N/A'} • {user?.phone || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* 4 Stat Metric Cards */}
        <SectionCards
          avgScore={avgScore}
          activeCount={activeCount}
          scheduledCount={scheduledCount}
          completedCount={completedCount}
        />

        {/* Interactive Chart Block */}
        <ChartAreaInteractive results={results} />

        {/* Data Table Block */}
        <DataTable data={results} />
      </div>
    </DashboardLayout>
  )
}
