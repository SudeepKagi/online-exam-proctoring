import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { GraduationCap, Search } from 'lucide-react'

export default function FacultyStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/faculty/students?status=APPROVED')
      .then(r => setStudents(r.data.students || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.usn.toLowerCase().includes(search.toLowerCase()) ||
    (s.department || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout title="My Students">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Students</h1>
          <p className="text-sm text-gray-500">{students.length} enrolled students</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, USN, or dept…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><GraduationCap size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No students found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                {['Name','USN','Department','Semester','Email'].map(h => <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {s.facePhotoUrl ? <img src={s.facePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">{s.name[0]}</div>}
                        <span className="font-semibold text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{s.usn}</td>
                    <td className="px-5 py-3.5 text-gray-600">{s.department}</td>
                    <td className="px-5 py-3.5"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">Sem {s.semester}</span></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
