import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, Cpu, Award, ArrowRight, Lock, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  const pillars = [
    { icon: Shield, title: 'AWS Rekognition Biometrics', desc: 'One-time pre-exam face verification against admin-verified reference photos ensuring zero student impersonation.', badge: 'Identity Guard' },
    { icon: Lock, title: 'Zero-Install Browser Lockdown', desc: 'Full-monitor screen share enforcement, tab-switch & focus detection, and instant evidence capture with zero desktop downloads.', badge: 'Pure Browser' },
    { icon: Cpu, title: 'AI-Assisted Authoring & Instant Grading', desc: 'Faculty AI MCQ generator with domain-aware reasoning and single-query deterministic PostgreSQL grading.', badge: 'Automated AI' },
    { icon: Eye, title: 'Live Invigilator Console', desc: 'Real-time WebSocket violation feed with continuous thumbnail grid and 1-click candidate attempt suspension/resumption.', badge: 'Real-time Socket' }
  ]

  const roles = [
    { role: 'STUDENT', name: 'Students', desc: 'Verify face identity once, launch full-screen secure exam mode, and receive deterministic instant grading upon submission.', route: '/login?role=student', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    { role: 'FACULTY', name: 'Faculty & Examiners', desc: 'Author exams with AI topic prompts or Excel uploads, generate invigilator credentials, and publish standardized tests.', route: '/login?role=faculty', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { role: 'INVIGILATOR', name: 'Live Invigilators', desc: 'Monitor multi-student camera and screen tiles in real time, inspect automated violation flags, and control session access.', route: '/login?role=invigilator', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    { role: 'ADMIN', name: 'Administrators', desc: 'Provision institutional accounts, review student identity submissions against College IDs, and govern department policies.', route: '/login?role=admin', badge: 'bg-purple-50 text-purple-700 border-purple-200' }
  ]

  const metrics = [
    { val: '99.98%', label: 'Biometric Match Precision' },
    { val: '< 50ms', label: 'Proctor State Sync' },
    { val: '0 Installs', label: 'Pure Browser Lockdown' },
    { val: '100%', label: 'Deterministic Grading' }
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-900">Proctor<span className="text-blue-600">Net</span></span>
              <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-widest -mt-1">Institutional</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#roles" className="hover:text-blue-600 transition-colors">Portals</a>
          </nav>
          <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm cursor-pointer">
            Sign In to Portal
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-6">
          <Award className="w-3.5 h-3.5 text-blue-600" />
          <span>INSTITUTIONAL EXAMINATION INFRASTRUCTURE</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight max-w-4xl mx-auto leading-[1.15]">
          Next-Generation AI & Browser-Lockdown <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Examination Platform</span>
        </h1>
        <p className="mt-5 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
          Uncompromised academic integrity through AWS Rekognition facial biometrics, zero-install browser containment, real-time invigilation, and AI-assisted assessment workflows.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => navigate('/login')} className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer">
            Launch Portal <ArrowRight className="w-4 h-4" />
          </button>
          <a href="#features" className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition">
            Explore Architecture
          </a>
        </div>
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {metrics.map((m, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
              <div className="text-2xl font-black text-blue-600">{m.val}</div>
              <div className="text-[11px] font-semibold text-slate-600 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Pillars */}
      <section id="features" className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">CORE ARCHITECTURE</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">Engineered for Absolute Examination Truth</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium">Four integrated defensive rings safeguarding institutional credibility without invasive native binaries.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((p, idx) => {
              const Icon = p.icon
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{p.badge}</span>
                    <h3 className="text-sm font-bold text-slate-900 mt-3">{p.title}</h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section id="roles" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium">Select your institutional role to access dedicated dashboards and toolchains.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${r.badge}`}>{r.role}</span>
                <h3 className="text-base font-bold text-slate-900 mt-3">{r.name}</h3>
                <p className="text-xs text-slate-600 mt-2 font-medium leading-relaxed">{r.desc}</p>
              </div>
              <button onClick={() => navigate(r.route)} className="mt-6 w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer">
                Enter as {r.name.split(' ')[0]} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">P</div>
            <span className="font-bold text-slate-900">ProctorNet Architecture</span>
          </div>
          <div className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} ProctorNet Examination Systems. AWS Rekognition & Pure Browser Lockdown.
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/login" className="hover:text-blue-600">Portal Login</Link>
            <span className="text-slate-300">•</span>
            <a href="#features" className="hover:text-blue-600">Security Specs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
