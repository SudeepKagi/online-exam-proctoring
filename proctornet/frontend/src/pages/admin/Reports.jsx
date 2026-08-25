import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { BarChart2, TrendingUp, Users, BookOpen, Download, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

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
            { name: 'Proximity Alert', value: 12 },
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
          summary: { totalExams: 48, totalStudents: 312, avgScore: 67, violationsThisWeek: 119 },
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  const summary = data?.summary || {}

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Reports & Analytics</h1>
            <p className="text-xs text-slate-400 mt-0.5">Platform-wide exam participation, performance metrics, and security insights</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#141416] border border-[#27272A] rounded-full p-1">
              {['7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-full transition-colors ${
                    period === p ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
            <Button className="text-xs font-mono bg-[#141416] border border-[#27272A] hover:bg-[#18181B] text-slate-300">
              <Download size={13} className="mr-1.5" /> Export Report
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {loading
            ? [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#141416] border border-[#27272A] rounded-2xl animate-pulse" />)
            : [
                { label: 'Total Exams', value: summary.totalExams ?? '—', icon: BookOpen, color: 'text-indigo-400' },
                { label: 'Total Candidates', value: summary.totalStudents ?? '—', icon: Users, color: 'text-emerald-400' },
                { label: 'Avg Pass Score', value: summary.avgScore ? `${summary.avgScore}%` : '—', icon: TrendingUp, color: 'text-indigo-300' },
                { label: 'Violations Flagged', value: summary.violationsThisWeek ?? '—', icon: BarChart2, color: 'text-rose-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="bg-[#141416] border-[#27272A] p-4 flex items-center gap-3.5 shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono text-slate-400 uppercase">{label}</p>
                    <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">{value}</p>
                  </div>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Exam Activity Chart */}
          <Card className="xl:col-span-2 bg-[#141416] border-[#27272A] shadow-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold text-slate-100">Exam Activity & Candidate Volume</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-56 bg-[#09090B] border border-[#27272A] rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data?.examActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090B', borderColor: '#27272A', borderRadius: 8, color: '#F4F4F5' }} />
                    <Bar dataKey="students" name="Students" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exams" name="Exams" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Violation Types Pie */}
          <Card className="bg-[#141416] border-[#27272A] shadow-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold text-slate-100">Violation Types Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-56 bg-[#09090B] border border-[#27272A] rounded-xl animate-pulse" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data?.violationBreakdown || []} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        {(data?.violationBreakdown || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#09090B', borderColor: '#27272A', borderRadius: 8, color: '#F4F4F5' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {(data?.violationBreakdown || []).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-slate-400">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-200">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="xl:col-span-3 bg-[#141416] border-[#27272A] shadow-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold text-slate-100">Score Range Distribution (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-48 bg-[#09090B] border border-[#27272A] rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={data?.scoreDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090B', borderColor: '#27272A', borderRadius: 8, color: '#F4F4F5' }} />
                    <Bar dataKey="students" name="Students" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
