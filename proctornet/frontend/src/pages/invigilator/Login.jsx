import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Hash, Lock, AlertCircle, Eye, EyeOff, Key, ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function InvigilatorLogin() {
  const navigate = useNavigate()
  const { loginInvigilator } = useAuth()
  const [form, setForm] = useState({ examId: '', invId: '', invPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const set = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.examId || !form.invId || !form.invPassword) { setError('All fields are required.'); return }
    setLoading(true)
    try {
      const result = await loginInvigilator(form.examId.trim(), form.invId.trim(), form.invPassword)
      if (result.success) {
        navigate(`/invigilator/live-grid/${result.session.examId}`)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-white selection:text-black">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm">
            <ProctorNetLogo className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">ProctorNet</span>
        </div>

        <Card className="border-[#27272A] bg-[#141416]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-base font-bold text-white">Invigilator Session Access</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">Enter your exam ID and invigilator credentials to start proctoring.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="p-3 rounded-xl bg-[#27272A] border border-[#3F3F46] text-xs font-mono text-white flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Exam ID</Label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.examId}
                    onChange={set('examId')}
                    placeholder="e.g. EXAM-104"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Invigilator ID</Label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.invId}
                    onChange={set('invId')}
                    placeholder="INV-8821"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Session Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.invPassword}
                    onChange={set('invPassword')}
                    placeholder="••••••••"
                    required
                    className="pl-9 pr-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-9 text-xs mt-2 font-semibold">
                {loading ? 'Verifying Session…' : 'Access Live Proctoring Grid'} <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-[#27272A] pt-4 text-xs font-mono text-slate-400">
            <Link to="/" className="hover:text-white transition-colors">← Back to Home</Link>
            <Link to="/student/login" className="hover:text-white transition-colors">Student Login →</Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
