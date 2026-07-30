import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password, 'admin')
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid admin credentials.')
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
            <CardTitle className="text-base font-bold text-white">Admin Portal Sign In</CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">Enter administrative credentials to access system control panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[#27272A] border border-[#3F3F46] text-xs font-mono text-white">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Admin Email</Label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@proctornet.com"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-slate-300">Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9 text-xs bg-[#09090B] border-[#27272A]"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-9 text-xs mt-2 font-semibold">
                {loading ? 'Signing In…' : 'Sign In to Admin Portal'} <ArrowRight size={14} className="ml-1.5" />
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
