import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import {
  Calendar, Users, GraduationCap, BookOpen, ShieldAlert,
  ArrowRight, RefreshCw, UserCheck, Plus, CheckCircle2
} from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    faculty: { total: 0, pending: 0 },
    students: { total: 0, pending: 0 },
    exams: { total: 0, active: 0 },
    flags: { highSeverity: 0 }
  })
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.get('/admin/dashboard').catch(() => ({ data: null })),
        api.get('/admin/audit-logs?limit=6').catch(() => ({ data: { logs: [] } }))
      ])

      if (statsRes?.data) {
        setStats({
          faculty: statsRes.data.faculty || { total: 0, pending: 0 },
          students: statsRes.data.students || { total: 0, pending: 0 },
          exams: statsRes.data.exams || { total: 0, active: 0 },
          flags: statsRes.data.flags || { highSeverity: 0 }
        })
      }

      const logs = logsRes?.data?.logs || logsRes?.data || []
      setRecentLogs(Array.isArray(logs) ? logs.slice(0, 6) : [])
    } catch (err) {
      console.error('[AdminDashboard] Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <DashboardLayout title="Admin Console">
      <div className="space-y-8">
        {/* Top Header Row with Functional Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">System Overview</h1>
            <p className="text-xs text-[#64748b] mt-1 font-normal">
              Manage faculty accreditations, candidate enrollments, and examination integrity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/create-student')}
              className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold py-2.5 px-3 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <GraduationCap size={14} className="text-[#7c3aed]" />
              <span>+ Student</span>
            </button>
            <button
              onClick={() => navigate('/admin/create-faculty')}
              className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold py-2.5 px-3 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Users size={14} className="text-[#2563eb]" />
              <span>+ Faculty</span>
            </button>
            <button
              onClick={() => navigate('/admin/exams')}
              className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] text-white text-xs font-semibold py-2.5 px-3.5 rounded-xl shadow-[0_4px_12px_rgba(47,128,237,0.25)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>+ Schedule Exam</span>
            </button>
          </div>
        </div>

        {/* Section Header & Date Refresh Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a]">Institutional Metrics</h2>
            <div className="flex items-center gap-2 bg-white border border-[#e2e8f0] px-3.5 py-1.5 rounded-xl text-xs text-[#64748b] shadow-2xs font-medium">
              <Calendar size={13} className="text-[#94a3b8]" />
              <span>{currentDateFormatted}</span>
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="ml-1 text-[#94a3b8] hover:text-[#2f80ed] transition-colors p-0.5 cursor-pointer"
                title="Refresh Real-Time Data"
                aria-label="Refresh Data"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Clean Modern Metric Cards matching the UI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Faculty */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Total Faculty</span>
                <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2f80ed] flex items-center justify-center border border-[#dbeafe]">
                  <Users size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{stats.faculty.total}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1 font-normal">
                {stats.faculty.pending > 0 ? `${stats.faculty.pending} pending approval` : 'All verified & active'}
              </p>
            </div>

            {/* Card 2: Enrolled Students */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Enrolled Students</span>
                <div className="w-9 h-9 rounded-xl bg-[#faf5ff] text-[#7c3aed] flex items-center justify-center border border-[#ede9fe]">
                  <GraduationCap size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{stats.students.total}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1 font-normal">
                {stats.students.pending > 0 ? `${stats.students.pending} pending verification` : 'Enrolled candidates'}
              </p>
            </div>

            {/* Card 3: Scheduled Examinations */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Total Exams</span>
                <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] text-[#10b981] flex items-center justify-center border border-[#dcfce7]">
                  <BookOpen size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{stats.exams.total}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1 font-normal">
                {stats.exams.active > 0 ? `${stats.exams.active} currently live` : 'Scheduled assessments'}
              </p>
            </div>

            {/* Card 4: Security Alerts */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Security Alerts</span>
                <div className="w-9 h-9 rounded-xl bg-[#fffbeb] text-[#f59e0b] flex items-center justify-center border border-[#fef3c7]">
                  <ShieldAlert size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#0f172a] tracking-tight">{stats.flags.highSeverity}</span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1 font-normal">
                High-severity incident flags
              </p>
            </div>
          </div>
        </div>

        {/* Operational Modules Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center mb-3 border border-[#dbeafe]">
                <Users size={18} />
              </div>
              <h3 className="text-sm font-semibold text-[#0f172a]">Faculty Management</h3>
              <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                Review and approve professor registrations, assign departments, and manage permissions.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/faculty')}
              className="mt-5 w-full border border-[#2f80ed] text-[#2f80ed] hover:bg-[#eff6ff] text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Manage Faculty</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#faf5ff] text-[#7c3aed] flex items-center justify-center mb-3 border border-[#ede9fe]">
                <GraduationCap size={18} />
              </div>
              <h3 className="text-sm font-semibold text-[#0f172a]">Student Candidate Directory</h3>
              <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                Audit candidate enrollment, verify biometric facial baselines, and manage USN records.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/students')}
              className="mt-5 w-full border border-[#2f80ed] text-[#2f80ed] hover:bg-[#eff6ff] text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Manage Students</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] text-[#10b981] flex items-center justify-center mb-3 border border-[#dcfce7]">
                <BookOpen size={18} />
              </div>
              <h3 className="text-sm font-semibold text-[#0f172a]">Exam Session Oversight</h3>
              <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                Supervise scheduled assessments, monitor live invigilation grids, and pause or resume test sessions.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/exams')}
              className="mt-5 w-full border border-[#2f80ed] text-[#2f80ed] hover:bg-[#eff6ff] text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Manage Examinations</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Real System Audit Activity Table - Clean, No IP column */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">Recent Audit Events</h3>
              <p className="text-xs text-[#64748b] mt-0.5">Real-time immutable security logs recorded in the database.</p>
            </div>
            <button
              onClick={() => navigate('/admin/audit-logs')}
              className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] cursor-pointer"
            >
              View Full Audit Trail →
            </button>
          </div>

          {recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#f1f5f9]">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Actor / User</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Details / Target</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f8fafc]">
                  {recentLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-[#f8fafc]/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-[#64748b]">
                        {new Date(log.timestamp || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-[#0f172a]">
                        {log.userName || log.userRole || 'System'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#eff6ff] text-[#2563eb] font-semibold text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[#64748b] max-w-sm truncate">
                        {log.details || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#10b981]">
                          <CheckCircle2 size={10} />
                          Recorded
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 px-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center mx-auto mb-3 border border-[#dcfce7]">
                <CheckCircle2 size={20} />
              </div>
              <h4 className="text-sm font-semibold text-[#0f172a]">Clean System State</h4>
              <p className="text-xs text-[#64748b] mt-1 max-w-md mx-auto">
                No security alerts or violation logs recorded. All institutional proctoring pipelines are operational.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
