import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Hash, Lock, AlertCircle, Upload, Eye, EyeOff, Key } from 'lucide-react'
import api from '@/utils/api'

export default function InvigilatorLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ examId: '', invId: '', invPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [idCard, setIdCard] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const fileRef = useRef()

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIdCard(file)
    const reader = new FileReader()
    reader.onload = (ev) => setIdPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.examId || !form.invId || !form.invPassword) { setError('All fields are required.'); return }
    if (!idCard) { setError('Please upload your ID card photo.'); return }
    setLoading(true)
    try {
      const data = new FormData()
      data.append('examId', form.examId.trim())
      data.append('invId', form.invId.trim())
      data.append('invPassword', form.invPassword)
      data.append('idCard', idCard)
      const res = await api.post('/auth/invigilator/login', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      const { token, session } = res.data
      localStorage.setItem('inv_token', token)
      localStorage.setItem('inv_examId', session.examId)
      localStorage.setItem('inv_session', JSON.stringify(session))
      navigate(`/invigilator/exam/${session.examId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ProctorNet</h1>
          <p className="text-gray-400 text-sm mt-1">Invigilator Access Portal</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-1">Invigilator Login</h2>
          <p className="text-gray-400 text-sm mb-6">Temporary session — valid for exam duration only.</p>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-900/30 border border-red-700/50 text-red-400 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Exam ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Exam ID</label>
              <div className="relative">
                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.examId} onChange={set('examId')} placeholder="Enter exam ID" autoComplete="off"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
            </div>

            {/* Invigilator ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Invigilator ID</label>
              <div className="relative">
                <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={form.invId} onChange={set('invId')} placeholder="Enter invigilator ID" autoComplete="off"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPw ? 'text' : 'password'} value={form.invPassword} onChange={set('invPassword')} placeholder="••••••••" autoComplete="new-password"
                  className="w-full pl-9 pr-9 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* ID Card Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ID Card Photo *</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button type="button" onClick={() => fileRef.current.click()}
                className="w-full border-2 border-dashed border-gray-600 rounded-xl p-4 text-center transition hover:border-blue-500 hover:bg-gray-700/50">
                {idPreview ? (
                  <div className="space-y-2">
                    <img src={idPreview} alt="ID" className="w-full h-24 object-cover rounded-lg" />
                    <p className="text-xs text-gray-400">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload size={20} className="mx-auto text-gray-500" />
                    <p className="text-sm text-gray-400">Upload your ID card</p>
                  </div>
                )}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</>
              ) : 'Access Exam Dashboard →'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-500">This session expires when the exam ends. Contact faculty for access credentials.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
