import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useState, useRef } from 'react'
import {
  Shield, ChevronRight, Lock, Eye, Users, Cpu, FileText, CheckCircle2,
  ArrowRight, Activity, Camera, AlertTriangle, Monitor, Sparkles, Terminal,
  UserCheck, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { ProctorNetLogo } from '@/components/ui/proctornet-logo'

const features = [
  {
    icon: Lock,
    title: 'Network-Level Security',
    desc: 'Secure VPN connection locks browsers to the exam environment and blocks unauthorized outside network access.',
  },
  {
    icon: UserCheck,
    title: 'Biometric Verification',
    desc: 'Verifies identity against registered photos with periodic continuous background checks.',
  },
  {
    icon: FileText,
    title: 'Invisible Watermarking',
    desc: 'Embeds student credentials into screen captures to prevent question leaks.',
  },
  {
    icon: Activity,
    title: 'Real-Time Monitoring',
    desc: 'Live proctoring feed delivers instant security alerts, camera feeds, and timeline tracking.',
  },
  {
    icon: Cpu,
    title: 'AI Similarity Scanning',
    desc: 'Automated cross-student similarity scanning detects copied responses across exams.',
  },
  {
    icon: Terminal,
    title: 'Activity Reports',
    desc: 'Comprehensive post-exam reports including verified identity photos, timeline timestamps, and score logs.',
  },
]

const roles = [
  {
    role: 'Admin',
    badge: 'System Control',
    icon: Shield,
    desc: 'Full platform administration, user management, activity logs, and system security parameters.',
    path: '/admin/login',
  },
  {
    role: 'Faculty',
    badge: 'Exam Creator',
    icon: FileText,
    desc: 'Create exams, manage question pools, view student results, and check similarity scores.',
    path: '/faculty/login',
  },
  {
    role: 'Student',
    badge: 'Candidate',
    icon: UserCheck,
    desc: 'Register face profile, complete security pre-checks, and take secure proctored exams.',
    path: '/student/login',
  },
  {
    role: 'Invigilator',
    badge: 'Proctor',
    icon: Eye,
    desc: 'Real-time lab monitoring console for remote exam supervision per session.',
    path: '/invigilator-login',
  },
]

const steps = [
  { n: '01', title: 'Face Registration', desc: 'Submit a photo to register your biometric baseline profile.' },
  { n: '02', title: 'System Pre-Check', desc: 'Automated 9-step environment check: camera, VPN, VM detection, and browser lock.' },
  { n: '03', title: 'Proctored Exam', desc: 'Real-time proctoring with randomized questions and continuous monitoring.' },
  { n: '04', title: 'Exam Evaluation', desc: 'Instant auto-grading, similarity scanning, and verified result reports.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, role } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 font-sans selection:bg-white selection:text-black">
      {/* ── Navigation Top Bar ── */}
      <nav className="border-b border-[#27272A] bg-[#09090B]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">
              <ProctorNetLogo className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold tracking-tight text-slate-100 text-sm">ProctorNet</span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[9px] font-mono">
              ONLINE PROCTORING
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {isAuthenticated ? (
              <Button size="sm" onClick={() => navigate(`/${role}/dashboard`)}>
                Go to Console <ChevronRight size={13} className="ml-1" />
              </Button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <Button size="sm" onClick={() => setDropdownOpen(!dropdownOpen)}>
                  Sign In <ChevronRight size={13} className="ml-1" />
                </Button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl py-1 z-50 animate-in fade-in-80">
                    {roles.map((r) => (
                      <Link
                        key={r.role}
                        to={r.path}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-[#27272A] hover:text-white transition-colors"
                      >
                        <r.icon size={14} className="text-slate-400" />
                        <span>{r.role} Login</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-16 pb-12 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141416] border border-[#27272A] text-slate-300 text-xs font-mono mb-6">
          <Badge variant="default" className="text-[9px]">v2.0 RELEASE</Badge>
          <span>Secure Online Examination Platform</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          AI-Powered Online Exam & Remote Proctoring
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Comprehensive exam security featuring AI face verification, encrypted network connections, anti-cheat detection, and instant evaluation.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate('/student/login')}>
            Student Login <ArrowRight size={15} className="ml-1.5" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/faculty/login')}>
            Faculty Portal
          </Button>
        </div>
      </section>

      {/* ── Role Selector Section ── */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto border-t border-[#27272A]">
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold text-white tracking-tight">Access Portals</h2>
          <p className="text-xs text-slate-400 mt-1">Select your account role to proceed to your dashboard.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r) => (
            <Card key={r.role} className="border-[#27272A] bg-[#141416] hover:border-[#3F3F46] transition-all flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#27272A] text-white flex items-center justify-center border border-[#3F3F46]">
                    <r.icon size={16} />
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-mono">{r.badge}</Badge>
                </div>
                <CardTitle className="text-sm font-bold text-white">{r.role} Portal</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">{r.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link to={r.path}>
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs font-mono">
                    Enter {r.role} Portal <ChevronRight size={12} className="ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Key Features Grid ── */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto border-t border-[#27272A]">
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold text-white tracking-tight">Exam Security Features</h2>
          <p className="text-xs text-slate-400 mt-1">Built for modern educational institutions and remote assessments.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="p-4 rounded-2xl bg-[#141416] border border-[#27272A] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#27272A] text-white flex items-center justify-center border border-[#3F3F46] mb-3">
                  <f.icon size={16} />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Simple 4-Step Process ── */}
      <section className="py-12 px-4 sm:px-6 max-w-5xl mx-auto border-t border-[#27272A]">
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold text-white tracking-tight">How ProctorNet Works</h2>
          <p className="text-xs text-slate-400 mt-1">Simple and secure end-to-end examination workflow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="p-4 rounded-2xl bg-[#141416] border border-[#27272A]">
              <span className="text-xs font-mono font-bold text-slate-400">{s.n}</span>
              <h3 className="text-xs font-bold text-white mt-1 mb-1">{s.title}</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#27272A] py-6 text-center text-xs font-mono text-slate-400">
        <p>© {new Date().getFullYear()} ProctorNet. Secure Examination Platform.</p>
      </footer>
    </div>
  )
}
