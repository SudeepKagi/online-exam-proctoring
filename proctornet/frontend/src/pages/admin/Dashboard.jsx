import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import {
  BookOpen, Users, GraduationCap, AlertTriangle, Activity,
  Clock, CheckCircle, XCircle, ChevronRight, RefreshCw,
  Wifi, WifiOff, Server, Shield
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    HIGH: 'bg-red-100 text-red-700',
    CRITICAL: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[severity] || 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  )
}

function VPNStatusWidget() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await api.get('/vpn/server-status')
      setStatus(res.data)
    } catch {
      setStatus({ isRunning: false, connectedPeers: 0 })
    } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">VPN Server Status</h3>
        </div>
        <button onClick={fetch} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={13} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${status?.isRunning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${status?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {loading ? 'Checking…' : status?.isRunning ? 'Online' : 'Offline'}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400">Connected Students</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">{status?.connectedPeers ?? 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400">Server IP</p>
          <p className="text-xs font-mono text-gray-600 mt-0.5 truncate">{status?.serverIp || 'Not configured'}</p>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/dashboard')
        const d = res.data
        setStats(d)
        setViolations(d.recentViolations || [])
      } catch (err) {
        console.error(err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pendingCount = (stats?.faculty?.pending || 0) + (stats?.students?.pending || 0)

  return (
    <DashboardLayout title="Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform overview and real-time monitoring</p>
        </div>
        <button onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Pending approvals banner */}
      {pendingCount > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">{pendingCount} pending approval{pendingCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-amber-600">Faculty and student accounts awaiting review</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/faculty" className="text-xs font-semibold text-amber-700 hover:underline px-3 py-1.5 border border-amber-300 rounded-lg">
              View Faculty
            </Link>
            <Link to="/admin/students" className="text-xs font-semibold text-amber-700 hover:underline px-3 py-1.5 border border-amber-300 rounded-lg">
              View Students
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-12 w-12 bg-gray-200 rounded-2xl mb-3" />
              <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-12 bg-gray-200 rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon={BookOpen} label="Active Exams" value={stats?.exams?.active ?? 0}
              sub={`${stats?.exams?.total ?? 0} total`} color="text-blue-600" bg="bg-blue-50" />
            <StatCard icon={Users} label="Faculty" value={stats?.faculty?.total ?? 0}
              sub={`${stats?.faculty?.pending ?? 0} pending`} color="text-indigo-600" bg="bg-indigo-50" />
            <StatCard icon={GraduationCap} label="Students" value={stats?.students?.total ?? 0}
              sub={`${stats?.students?.pending ?? 0} pending`} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard icon={AlertTriangle} label="High Violations" value={stats?.flags?.highSeverity ?? 0}
              sub="HIGH or CRITICAL severity" color="text-red-600" bg="bg-red-50" />
          </>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent violations */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Recent Flagged Activity</h3>
            <Link to="/admin/violations" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : violations.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No recent violations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-semibold">Student</th>
                    <th className="px-5 py-3 text-left font-semibold">Exam</th>
                    <th className="px-5 py-3 text-left font-semibold">Violation</th>
                    <th className="px-5 py-3 text-left font-semibold">Severity</th>
                    <th className="px-5 py-3 text-left font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map(v => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{v.student}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{v.exam}</td>
                      <td className="px-5 py-3.5 text-gray-700">{v.type?.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3.5"><SeverityBadge severity={v.severity} /></td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{v.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* VPN Status */}
          <VPNStatusWidget />

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Review Pending Faculty', to: '/admin/faculty', color: 'text-indigo-600', Icon: Users },
                { label: 'Review Pending Students', to: '/admin/students', color: 'text-emerald-600', Icon: GraduationCap },
                { label: 'View Violations', to: '/admin/violations', color: 'text-red-600', Icon: AlertTriangle },
                { label: 'Platform Settings', to: '/admin/settings', color: 'text-gray-600', Icon: Shield },
              ].map(({ label, to, color, Icon }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                  <Icon size={15} className={color} />
                  <span className="text-sm text-gray-700 font-medium">{label}</span>
                  <ChevronRight size={13} className="ml-auto text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
