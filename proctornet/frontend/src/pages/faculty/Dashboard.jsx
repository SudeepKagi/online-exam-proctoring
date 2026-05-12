import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import { BookOpen, Plus, Clock, Users, BarChart2, ChevronRight, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

function ExamStatusBadge({ status }) {
  const map = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    ENDED: 'bg-gray-100 text-gray-500',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.DRAFT}`}>
      {status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  )
}

export default function FacultyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/faculty/exams')
        const examList = res.data.exams || res.data || []
        setExams(examList.slice(0, 5))
        setStats({
          total: examList.length,
          active: examList.filter(e => e.status === 'ACTIVE').length,
          scheduled: examList.filter(e => e.status === 'SCHEDULED').length,
          ended: examList.filter(e => e.status === 'ENDED').length,
        })
      } catch { console.error('Failed to load faculty data') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <DashboardLayout title="Faculty Dashboard">
      {/* Welcome */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's your exam overview for today</p>
        </div>
        <Link to="/faculty/exams/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors">
          <Plus size={16} /> Create Exam
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
        ) : [
          { label: 'Total Exams', value: stats?.total, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Now', value: stats?.active, icon: Play, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Scheduled', value: stats?.scheduled, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats?.ended, icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent exams */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Recent Exams</h3>
            <Link to="/faculty/exams" className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : exams.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No exams yet</p>
              <Link to="/faculty/exams/create" className="inline-flex items-center gap-1.5 mt-3 text-sm text-indigo-600 font-semibold hover:underline">
                <Plus size={14} /> Create your first exam
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {exams.map(exam => (
                <div key={exam.id} className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{exam.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{exam.subject} · {exam.duration} min · {exam.totalMarks} marks</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ExamStatusBadge status={exam.status} />
                    <button onClick={() => navigate(`/faculty/exams/${exam.id}`)}
                      className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors">
                      <ChevronRight size={15} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Create New Exam', to: '/faculty/exams/create', icon: Plus, color: 'text-indigo-600' },
                { label: 'View All Exams', to: '/faculty/exams', icon: BookOpen, color: 'text-blue-600' },
                { label: 'View Students', to: '/faculty/students', icon: Users, color: 'text-emerald-600' },
                { label: 'All Results', to: '/faculty/results', icon: BarChart2, color: 'text-purple-600' },
              ].map(({ label, to, icon: Icon, color }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                  <Icon size={15} className={color} />
                  <span className="text-sm text-gray-700 font-medium">{label}</span>
                  <ChevronRight size={13} className="ml-auto text-gray-400" />
                </Link>
              ))}
            </div>
          </div>

          {/* Department info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Your Profile</p>
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
            <p className="text-xs font-medium text-indigo-700 mt-2 bg-indigo-100 inline-block px-2 py-0.5 rounded-full">{user?.department} Department</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
