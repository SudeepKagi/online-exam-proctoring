import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import EmptyState from '@/components/common/EmptyState'
import { getErrorMessage } from '@/utils/errorUtils'
import { BarChart2, TrendingUp, Users, BookOpen, Download, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function AdminReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('7d')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/admin/reports?period=${period}`)
      setData(res.data)
    } catch (err) {
      console.error('[AdminReports] Fetch error:', err)
      setError(getErrorMessage(err, 'Failed to compile platform reports.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [period])

  const handleExportReport = () => {
    if (!data) {
      toast.error('No analytics data available to export.')
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ProctorNet_Analytics_${period}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Analytics report exported successfully!')
  }

  const summary = data?.summary || {}

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
            <p className="text-sm text-slate-500 font-normal mt-0.5">Platform-wide exam participation, performance metrics, and security insights</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1">
              {['7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    period === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
            <button 
              onClick={handleExportReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Download size={13} /> Export Report
            </button>
          </div>
        </div>

        {error ? (
          <Card className="p-8 bg-white border-slate-200 shadow-xs">
            <ErrorState
              title="Unable to Compile Platform Analytics"
              message={error}
              onRetry={load}
            />
          </Card>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {loading
            ? [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />)
            : [
                { label: 'Total Exams', value: summary.totalExams ?? '—', icon: BookOpen, color: 'text-primary' },
                { label: 'Total Candidates', value: summary.totalStudents ?? '—', icon: Users, color: 'text-emerald-500' },
                { label: 'Avg Pass Score', value: summary.avgScore ? `${summary.avgScore}%` : '—', icon: TrendingUp, color: 'text-blue-500' },
                { label: 'Violations Flagged', value: summary.violationsThisWeek ?? '—', icon: BarChart2, color: 'text-rose-500' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="bg-white border-slate-200 p-4 flex items-center gap-3.5 shadow-xs rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
                  </div>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Exam Activity Chart */}
          <Card className="xl:col-span-2 bg-white border-slate-200 shadow-xs p-5 rounded-2xl">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Exam Activity & Candidate Volume</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-56 bg-background border border-border rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data?.examActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: 12, color: '#18181b', boxShadow: '0 4px 8px -2px rgba(16,24,40,0.08)' }} />
                    <Bar dataKey="students" name="Students" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exams" name="Exams" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Violation Types Pie */}
          <Card className="bg-card border-border shadow-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold text-foreground">Violation Types Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-56 bg-background border border-border rounded-xl animate-pulse" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data?.violationBreakdown || []} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        {(data?.violationBreakdown || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: 12, color: '#18181b', boxShadow: '0 4px 8px -2px rgba(16,24,40,0.08)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {(data?.violationBreakdown || []).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="xl:col-span-3 bg-card border-border shadow-xl p-5">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold text-foreground">Score Range Distribution (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="h-48 bg-background border border-border rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={data?.scoreDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#A1A1AA' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: 12, color: '#18181b', boxShadow: '0 4px 8px -2px rgba(16,24,40,0.08)' }} />
                    <Bar dataKey="students" name="Students" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </DashboardLayout>
  )
}
