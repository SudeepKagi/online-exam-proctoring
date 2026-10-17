import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('STUDENT')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const credentials = {
      email: identifier,
      usn: identifier,
      password,
    }

    const res = await login(credentials, role)
    setLoading(false)

    if (res.success) {
      const targetRole = res.user?.role || role
      if (targetRole === 'ADMIN') navigate('/admin/dashboard')
      else if (targetRole === 'FACULTY') navigate('/faculty/exams')
      else if (targetRole === 'INVIGILATOR') navigate('/invigilator/console')
      else navigate('/student/dashboard')
    } else {
      setError(res.error || 'Authentication failed. Please verify credentials.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm bg-white">
        <CardHeader className="text-center pb-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl mx-auto flex items-center justify-center mb-3 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">ProctorNet</CardTitle>
          <CardDescription className="text-slate-500 text-sm">
            Autonomous Examination & Online Proctoring
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Login Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full border-slate-300">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="FACULTY">Faculty</SelectItem>
                  <SelectItem value="INVIGILATOR">Invigilator</SelectItem>
                  <SelectItem value="ADMIN">System Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                {role === 'STUDENT' ? 'Institutional Email or USN' : 'Email Address'}
              </Label>
              <Input
                type="text"
                required
                placeholder={role === 'STUDENT' ? 'e.g. 1RV21CS001 or student@univ.edu' : 'name@univ.edu'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <Input
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-300"
              />
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
              {loading ? 'Authenticating...' : 'Sign In to Console'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
