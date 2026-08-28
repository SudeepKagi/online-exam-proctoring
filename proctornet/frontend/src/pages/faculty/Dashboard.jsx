import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { Plus, BookOpen, Users, BarChart2, ChevronRight, User, Mail, Phone, Building, Briefcase, CheckCircle2, Award, Calendar } from 'lucide-react'

function getComputedStatus(exam) {
  if (!exam) return 'DRAFT'
  if (exam.status === 'DRAFT') return 'DRAFT'
  if (exam.status === 'CANCELLED') return 'CANCELLED'

  const now = new Date()
  const start = exam.startTime ? new Date(exam.startTime) : null
  const end = exam.endTime ? new Date(exam.endTime) : null

  if (start && now < start) return 'SCHEDULED'
  if (start && end && now >= start && now <= end) return 'ACTIVE'
  if (end && now > end) return 'ENDED'

  return exam.status === 'PUBLISHED' ? 'SCHEDULED' : (exam.status || 'SCHEDULED')
}

function ExamStatusBadge({ status }) {
  const map = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ENDED: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] || map.DRAFT}`}>
      {status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {status}
    </span>
  )
}

export default function FacultyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/faculty/exams')
      .then(r => setExams(r.data.exams || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const activeExamsCount = exams.filter(e => getComputedStatus(e) === 'ACTIVE').length
  const totalStudents = 120

  return (
    <DashboardLayout title="Faculty Workspace">
      <div className="flex flex-col gap-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty Workspace Overview</h1>
            <p className="text-sm text-slate-500 font-normal mt-0.5">
              Welcome back, <span className="font-semibold text-slate-800">{user?.name || 'Dr. Rajesh Kumar'}</span>. Manage course exams, live monitoring, and student performance.
            </p>
          </div>
          <button 
            onClick={() => navigate('/faculty/exams/create')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2f80ed] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-xl shadow-xs transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus size={18} /> Create New Exam
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-[#2f80ed]">
                <User size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">Personal & Professional Profile</h3>
                <p className="text-xs text-slate-500 font-normal">Institutional instructor credentials and department assignment</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#2f80ed] border border-blue-200 rounded-full text-[11px] font-semibold">
              <CheckCircle2 size={13} /> FACULTY INSTRUCTOR
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50/75 border border-slate-200">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={12} className="text-slate-400" /> Full Name
              </span>
              <p className="font-semibold text-slate-800 text-sm mt-1">{user?.name || 'Dr. Rajesh Kumar'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/75 border border-slate-200">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase size={12} className="text-slate-400" /> Employee ID
              </span>
              <p className="font-medium text-slate-700 text-sm mt-1">{user?.employeeId || 'FAC2024CSE01'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/75 border border-slate-200">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mail size={12} className="text-slate-400" /> Institutional Email
              </span>
              <p className="font-medium text-slate-700 text-sm truncate mt-1">{user?.email || 'rajesh.kumar@nmit.ac.in'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/75 border border-slate-200">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building size={12} className="text-slate-400" /> Department & Contact
              </span>
              <p className="font-medium text-slate-700 text-sm mt-1">{user?.department || 'Electronics & Communication'}</p>
            </div>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Exams</p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{exams.length}</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Created assessments</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Exams
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{activeExamsCount}</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Currently in progress</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-[#2f80ed]">Registered Students</p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{totalStudents}</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Assigned candidates</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Average Class Score</p>
            <p className="text-3xl font-bold text-[#2f80ed] mt-2 tracking-tight">78.5%</p>
            <p className="text-xs font-normal text-slate-500 mt-1">Evaluated overall score</p>
          </div>
        </div>

        {/* Exam Roster Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">My Exam Roster</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Recent examination sessions created for your courses</p>
            </div>
            <button 
              onClick={() => navigate('/faculty/exams')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f80ed] hover:underline cursor-pointer"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm font-normal text-slate-400">Loading exam roster…</div>
          ) : exams.length === 0 ? (
            <div className="p-10 text-center text-sm font-normal text-slate-400">No exams created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Exam Title</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Duration</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.slice(0, 5).map((exam) => {
                    const computedStatus = getComputedStatus(exam)
                    return (
                      <tr key={exam.id || exam._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-slate-900">
                          {exam.title}
                        </td>
                        <td className="px-6 py-4 text-xs font-normal text-slate-600">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md">
                            {exam.subject || 'CS301'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-normal text-slate-600">
                          {exam.duration || 60} min
                        </td>
                        <td className="px-6 py-4">
                          <ExamStatusBadge status={computedStatus} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => navigate(`/faculty/exams/${exam.id || exam._id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#2f80ed] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            View Details <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
