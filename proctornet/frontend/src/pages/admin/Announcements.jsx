import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Megaphone, Plus, Trash2, Eye, X, Users, GraduationCap, BookOpen } from 'lucide-react'

const AUDIENCE_LABELS = {
  ALL: { label: 'Everyone', icon: Users, color: 'bg-blue-100 text-blue-700' },
  FACULTY: { label: 'Faculty Only', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700' },
  STUDENT: { label: 'Students Only', icon: GraduationCap, color: 'bg-emerald-100 text-emerald-700' },
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', content: '', audience: 'ALL', priority: 'NORMAL' })
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setLoading(true)
    try {
      await api.post('/admin/announcements', form)
      toast.success('Announcement published')
      onCreated()
      onClose()
    } catch { toast.error('Failed to publish announcement') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">New Announcement</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="Announcement title"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
            <textarea value={form.content} onChange={set('content')} placeholder="Write your announcement…"
              rows={4} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Audience</label>
              <select value={form.audience} onChange={set('audience')}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">Everyone</option>
                <option value="FACULTY">Faculty Only</option>
                <option value="STUDENT">Students Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select value={form.priority} onChange={set('priority')}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Publishing…</> : 'Publish Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/announcements')
      setAnnouncements(res.data.announcements || res.data || [])
    } catch { console.error('Failed to load announcements') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return
    try {
      await api.delete(`/admin/announcements/${id}`)
      toast.success('Announcement deleted')
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  const PRIORITY_COLORS = {
    URGENT: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-amber-100 text-amber-700 border-amber-200',
    NORMAL: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  return (
    <DashboardLayout title="Announcements">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchAll} />}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${PRIORITY_COLORS[selected.priority] || PRIORITY_COLORS.NORMAL}`}>{selected.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AUDIENCE_LABELS[selected.audience]?.color || 'bg-gray-100 text-gray-600'}`}>{AUDIENCE_LABELS[selected.audience]?.label}</span>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">{selected.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{selected.content}</p>
            <p className="text-xs text-gray-400 mt-4">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Broadcast platform-wide messages to students and faculty</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors">
          <Plus size={15} /> New Announcement
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <Megaphone size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No announcements yet</p>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700">
            <Plus size={14} /> Create First Announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const aud = AUDIENCE_LABELS[a.audience] || AUDIENCE_LABELS.ALL
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Megaphone size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                      {a.priority !== 'NORMAL' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${aud.color}`}>{aud.label}</span>
                      <span className="text-xs text-gray-400">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setSelected(a)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Eye size={15} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
