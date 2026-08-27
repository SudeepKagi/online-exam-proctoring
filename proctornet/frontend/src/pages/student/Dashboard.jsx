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
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {greeting()}, {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              {isVerified && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> VERIFIED
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              USN: <span className="font-mono font-extrabold text-slate-900">{user?.usn || user?.rollNo || 'N/A'}</span> • {user?.department || 'Electronics & Communication'} • Semester {user?.semester || 6}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/device-check')}
              className="bg-blue-50 hover:bg-blue-100 text-[#2f80ed] text-xs font-extrabold py-2.5 px-4 rounded-xl border border-blue-200 transition-colors cursor-pointer flex items-center gap-2"
            >
              <ShieldCheck size={16} />
              <span>BYOD Diagnostic</span>
            </button>
            <button
              onClick={() => navigate('/student/exams')}
              className="bg-[#2f80ed] hover:bg-[#2563eb] text-white text-xs font-extrabold py-2.5 px-5 rounded-xl shadow-md shadow-blue-200 transition-all cursor-pointer flex items-center gap-2"
            >
              <BookOpen size={16} />
              <span>All Examinations</span>
            </button>
          </div>
        </div>

        {/* Candidate Personal & Academic Profile Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#2f80ed]" />
                Personal & Academic Profile
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Verified candidate credentials and institutional enrollment details.
              </p>
            </div>
            {isVerified ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold uppercase tracking-wider border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                VERIFIED CANDIDATE
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold uppercase tracking-wider border border-amber-200 flex items-center gap-1.5">
                <Clock size={13} />
                UNDER ADMIN REVIEW
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" /> Full Name
              </span>
              <p className="font-extrabold text-slate-900 mt-1 text-sm">{user?.name || 'Candidate'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-slate-400" /> Roll No / USN
              </span>
              <p className="font-extrabold text-slate-900 font-mono mt-1 text-sm">{user?.usn || user?.rollNo || 'N/A'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" /> Institutional Email
              </span>
              <p className="font-extrabold text-slate-900 truncate mt-1 text-sm">{user?.email || 'N/A'}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building size={14} className="text-slate-400" /> Department & Semester
              </span>
              <p className="font-extrabold text-slate-900 truncate mt-1 text-sm">{user?.department || 'Electronics & Communication'} • Sem {user?.semester || 6}</p>
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
