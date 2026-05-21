import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import {
  BookOpen, Clock, CheckCircle, BarChart2, Wifi, WifiOff,
  Camera, ChevronRight, Play, AlertCircle, Trophy, Target
} from 'lucide-react'

function VPNStatusCard() {
  const [vpn, setVpn] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/vpn/status').then(r => setVpn(r.data)).catch(() => setVpn({ connected: false })).finally(() => setLoading(false))
  }, [])

  return (
    <div className={`rounded-2xl p-4 border ${vpn?.connected ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${vpn?.connected ? 'bg-green-100' : 'bg-amber-100'}`}>
          {vpn?.connected ? <Wifi size={18} className="text-green-600" /> : <WifiOff size={18} className="text-amber-600" />}
        </div>
        <div>
          <p className={`text-sm font-semibold ${vpn?.connected ? 'text-green-800' : 'text-amber-800'}`}>
            {loading ? 'Checking VPN…' : vpn?.connected ? 'VPN Connected' : 'VPN Not Connected'}
          </p>
          <p className={`text-xs ${vpn?.connected ? 'text-green-600' : 'text-amber-600'}`}>
            {vpn?.connected ? `IP: ${vpn.assignedIp || 'Assigned'}` : 'Connect VPN before joining any exam'}
          </p>
        </div>
        {!vpn?.connected && !loading && (
          <a href="#vpn-setup" className="ml-auto text-xs text-amber-700 font-semibold underline">Setup →</a>
        )}
      </div>
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
        setResults((resultsRes.data.results || resultsRes.data || []).slice(0, 5))
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const now = new Date()
  const upcomingExams = exams.filter(e => {
    const isEnded = e.status === 'ENDED' || now > new Date(e.endTime)
    return !isEnded && (e.status === 'SCHEDULED' || e.status === 'PUBLISHED' || e.status === 'ACTIVE')
  }).slice(0, 4)

  const activeExams = exams.filter(e => {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const isEnded = e.status === 'ENDED' || now > end
    const isActive = e.status === 'ACTIVE' || (now >= start && now <= end && (e.status === 'PUBLISHED' || e.status === 'SCHEDULED' || e.status === 'ACTIVE'))
    return isActive && !isEnded
  })

  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
    : null

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <DashboardLayout title="Dashboard">
      {/* Welcome */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">USN: {user?.usn} · {user?.department} Dept</p>
        </div>
        <Link to="/student/exams"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors">
          <BookOpen size={15} /> View Exams
        </Link>
      </div>

      {/* Active exam alert */}
      {activeExams.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-green-800">Exam in progress: {activeExams[0].title}</p>
              <p className="text-xs text-green-600">Click to join immediately</p>
            </div>
          </div>
          <Link to={`/student/exam-lobby/${activeExams[0].id}`}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition-colors">
            <Play size={14} /> Join Now
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
        ) : [
          { label: 'Upcoming Exams', value: upcomingExams.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Exams Taken', value: results.length, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Average Score', value: avgScore !== null ? `${avgScore}%` : '—', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Best Score', value: results.length > 0 ? `${Math.max(...results.map(r => r.percentage || 0))}%` : '—', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Upcoming Exams */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Live & Upcoming Exams</h3>
              <Link to="/student/exams" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : upcomingExams.length === 0 ? (
              <div className="p-10 text-center">
                <BookOpen size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No upcoming exams scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingExams.map(exam => (
                  <div key={exam.id} className={`px-5 py-4 flex items-center gap-4 ${exam.status === 'ACTIVE' ? 'bg-green-50' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${exam.status === 'ACTIVE' ? 'bg-green-100' : 'bg-emerald-50'}`}>
                      {exam.status === 'ACTIVE'
                        ? <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        : <BookOpen size={18} className="text-emerald-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{exam.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exam.status === 'ACTIVE'
                          ? `Ends: ${new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : `Starts: ${new Date(exam.startTime).toLocaleString()}`
                        } · {exam.duration} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const start = new Date(exam.startTime)
                        const end = new Date(exam.endTime)
                        const now = new Date()
                        const isEnded = exam.status === 'ENDED' || now > end
                        const fifteenMinsBeforeStart = new Date(start.getTime() - 15 * 60 * 1000)
                        const canJoin = !isEnded && now >= fifteenMinsBeforeStart && now <= end
                        
                        if (canJoin) {
                          return (
                            <Link to={`/student/exam-lobby/${exam.id}`}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors">
                              <Play size={12} /> {exam.status === 'ACTIVE' || (now >= start && now <= end) ? 'Join' : 'Enter Lobby'}
                            </Link>
                          )
                        } else if (isEnded) {
                          return (
                            <span className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full font-semibold">Exam Over</span>
                          )
                        } else {
                          return (
                            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-full">Scheduled</span>
                          )
                        }
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Recent Results</h3>
              <Link to="/student/results" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center">
                <BarChart2 size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No exam results yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {results.map(r => (
                  <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{r.exam?.title || r.examTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.gradedAt ? new Date(r.gradedAt).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${(r.percentage || 0) >= 40 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.totalScore}/{r.exam?.totalMarks || r.totalMarks}
                      </p>
                      <p className="text-xs text-gray-400">{r.percentage || 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <VPNStatusCard />

          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">My Profile</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                {user?.facePhotoUrl && user.facePhotoUrl !== 'placeholder_face'
                  ? <img src={user.facePhotoUrl} alt="" className="w-full h-full object-cover" />
                  : user?.name?.slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              {[['USN', user?.usn], ['Department', user?.department], ['Semester', `Semester ${user?.semester}`]].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Help */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <p className="text-sm font-semibold text-emerald-800 mb-2">Before your exam</p>
            <ul className="space-y-1.5 text-xs text-emerald-700">
              <li className="flex items-center gap-2"><CheckCircle size={12} />Connect to ProctorNet VPN</li>
              <li className="flex items-center gap-2"><CheckCircle size={12} />Allow camera access in browser</li>
              <li className="flex items-center gap-2"><CheckCircle size={12} />Use full-screen mode during exam</li>
              <li className="flex items-center gap-2"><CheckCircle size={12} />Keep your college ID card ready</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
