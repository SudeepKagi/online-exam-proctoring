import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Megaphone, Plus, Trash2, Eye, X, Users, GraduationCap, BookOpen } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const AUDIENCE_LABELS = {
  ALL: { label: 'Everyone', icon: Users, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
  FACULTY: { label: 'Faculty Only', icon: BookOpen, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  STUDENT: { label: 'Students Only', icon: GraduationCap, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', content: '', audience: 'ALL', priority: 'NORMAL' })
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/announcements', form)
      toast.success('Announcement published')
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to publish announcement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 font-sans" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
          <h3 className="text-base font-bold text-slate-100">New Platform Announcement</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#27272A] rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="Announcement title"
              className="w-full px-3.5 py-2 border border-[#27272A] rounded-xl text-xs bg-[#09090B] text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Message *</label>
            <textarea
              value={form.content}
              onChange={set('content')}
              placeholder="Write your broadcast message..."
              rows={4}
              className="w-full px-3.5 py-2.5 border border-[#27272A] rounded-xl text-xs bg-[#09090B] text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Audience</label>
              <select
                value={form.audience}
                onChange={set('audience')}
                className="w-full px-3.5 py-2 border border-[#27272A] rounded-xl text-xs bg-[#09090B] text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Everyone</option>
                <option value="FACULTY">Faculty Only</option>
                <option value="STUDENT">Students Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={set('priority')}
                className="w-full px-3.5 py-2 border border-[#27272A] rounded-xl text-xs bg-[#09090B] text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-[#27272A]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-[#27272A] rounded-xl text-xs text-slate-300 bg-[#09090B] hover:bg-[#18181B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? 'Publishing...' : 'Publish Now'}
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
  const [announcementToDelete, setAnnouncementToDelete] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/announcements')
      setAnnouncements(res.data.announcements || res.data || [])
    } catch {
      console.error('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleDelete = (id) => {
    setAnnouncementToDelete(id)
  }

  const performDelete = async () => {
    if (!announcementToDelete) return
    try {
      await api.delete(`/admin/announcements/${announcementToDelete}`)
      toast.success('Announcement deleted')
      fetchAll()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setAnnouncementToDelete(null)
    }
  }

  const PRIORITY_BADGES = {
    URGENT: <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono text-[10px]">URGENT</Badge>,
    HIGH: <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">HIGH</Badge>,
    NORMAL: <Badge variant="outline" className="text-slate-400 border-[#27272A] bg-[#09090B] font-mono text-[10px]">NORMAL</Badge>,
  }

  return (
    <DashboardLayout title="Announcements">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchAll} />}
      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
              <div className="flex items-center gap-2">
                {PRIORITY_BADGES[selected.priority] || PRIORITY_BADGES.NORMAL}
                <Badge variant="outline" className={`font-mono text-[10px] ${AUDIENCE_LABELS[selected.audience]?.color}`}>
                  {AUDIENCE_LABELS[selected.audience]?.label}
                </Badge>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[#27272A] rounded-lg">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">{selected.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#09090B] p-4 rounded-xl border border-[#27272A]">{selected.content}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-4">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 py-2 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Announcements</h1>
            <p className="text-xs text-slate-400 mt-0.5">Broadcast platform-wide messages to students and faculty</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Plus size={14} className="mr-1.5" /> New Announcement
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#141416] border border-[#27272A] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card className="bg-[#141416] border-[#27272A] p-12 text-center shadow-xl">
            <Megaphone size={36} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold text-sm">No announcements yet</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus size={14} className="mr-1.5" /> Create First Announcement
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => {
              const aud = AUDIENCE_LABELS[a.audience] || AUDIENCE_LABELS.ALL
              return (
                <Card key={a.id} className="bg-[#141416] border-[#27272A] shadow-xl p-5 hover:border-[#3F3F46] transition">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                      <Megaphone size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm text-slate-100 truncate">{a.title}</h3>
                        {a.priority !== 'NORMAL' && PRIORITY_BADGES[a.priority]}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{a.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className={`font-mono text-[10px] ${aud.color}`}>{aud.label}</Badge>
                        <span className="text-[11px] font-mono text-slate-500">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setSelected(a)} className="p-1.5 hover:bg-[#27272A] text-slate-400 hover:text-white rounded-lg transition">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-rose-500/10 text-rose-400 rounded-lg transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!announcementToDelete}
        onOpenChange={(open) => { if (!open) setAnnouncementToDelete(null) }}
        title="Delete Announcement?"
        description="Are you sure you want to delete this announcement? It will be permanently removed from all dashboards."
        confirmText="Delete Announcement"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={performDelete}
      />
    </DashboardLayout>
  )
}
