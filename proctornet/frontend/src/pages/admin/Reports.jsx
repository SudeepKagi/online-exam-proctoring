import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BarChart2, TrendingUp, Users, BookOpen, Download, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function AdminReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/admin/reports?period=${period}`)
        setData(res.data)
      } catch {
        // Fallback demo data for display
        setData({
          examActivity: [
            { day: 'Mon', exams: 2, students: 45 },
            { day: 'Tue', exams: 3, students: 78 },
            { day: 'Wed', exams: 1, students: 23 },
            { day: 'Thu', exams: 4, students: 112 },
            { day: 'Fri', exams: 5, students: 134 },
            { day: 'Sat', exams: 0, students: 0 },
            { day: 'Sun', exams: 0, students: 0 },
          ],
          violationBreakdown: [
            { name: 'Tab Switch', value: 45 },
            { name: 'Face Mismatch', value: 23 },
            { name: 'No Face', value: 31 },
            { name: 'VPN Drop', value: 12 },
            { name: 'Other', value: 8 },
          ],
          scoreDistribution: [
            { range: '0-40', students: 12 },
            { range: '41-50', students: 18 },
            { range: '51-60', students: 34 },
            { range: '61-70', students: 56 },
            { range: '71-80', students: 43 },
            { range: '81-90', students: 27 },
            { range: '91-100', students: 15 },
          ],
          summary: { totalExams: 48, totalStudents: 312, avgScore: 67, violationsThisWeek: 119 }
        })
      } finally { setLoading(false) }
    }
    load()
  }, [period])

  const summary = data?.summary || {}

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform-wide performance and security insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {['7d','30d','90d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />) : [
          { label: 'Total Exams', value: summary.totalExams ?? '—', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Students', value: summary.totalStudents ?? '—', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Avg Score', value: summary.avgScore ? `${summary.avgScore}%` : '—', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Violations', value: summary.violationsThisWeek ?? '—', icon: BarChart2, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}><Icon size={18} className={color} /></div>
            <div><p className="text-xs text-gray-400">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Exam Activity */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Exam Activity</h3>
          {loading ? <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.examActivity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="students" name="Students" fill="#4F46E5" radius={[4,4,0,0]} />
                <Bar dataKey="exams" name="Exams" fill="#10B981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Violation Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Violation Types</h3>
          {loading ? <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={data?.violationBreakdown || []} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                    {(data?.violationBreakdown || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {(data?.violationBreakdown || []).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Score Distribution */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Score Distribution</h3>
          {loading ? <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.scoreDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 12, fill: '#9ca3af' }} label={{ value: 'Score Range (%)', position: 'insideBottom', offset: -3, fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="students" name="Students" fill="#4F46E5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
