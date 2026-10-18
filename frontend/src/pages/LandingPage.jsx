import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, Cpu, Award, ArrowRight, Lock, ChevronRight, CheckCircle2, Sparkles, Terminal, Activity, FileCheck, Layers } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeBento, setActiveBento] = useState(0)

  const bentoFeatures = [
    {
      title: 'Biometric Face Match & ID Verification',
      category: 'Identity Assurance',
      desc: 'One-time onboarding face capture with AWS Rekognition comparing live webcam snapshots against verified institutional ID card records.',
      stat: '99.98% Accuracy',
      icon: Shield,
      accent: 'border-blue-500/30 bg-blue-500/5'
    },
    {
      title: 'Pure Browser Containment Engine',
      category: 'Client Security',
      desc: 'Zero-download security runtime enforcing full-screen lockdown, dual-monitor restrictions, blur detection, and automated tamper-proofing.',
      stat: '0 MB Installed',
      icon: Lock,
      accent: 'border-indigo-500/30 bg-indigo-500/5'
    },
    {
      title: 'Real-Time Invigilation & Socket Telemetry',
      category: 'Live Proctoring',
      desc: 'Sub-50ms WebSocket event pipeline with live candidate thumbnail carousel, multi-factor gaze analysis, and 1-click session controls.',
      stat: '< 50ms Telemetry',
      icon: Eye,
      accent: 'border-emerald-500/30 bg-emerald-500/5'
    },
    {
      title: 'Deterministic Grading & LLM Authoring',
      category: 'Evaluation Engine',
      desc: 'Single-query PostgreSQL ACID grading with zero answer leakage, paired with automated AI topic-based question generator.',
      stat: '100% Deterministic',
      icon: Cpu,
      accent: 'border-amber-500/30 bg-amber-500/5'
    }
  ]

  const roles = [
    { role: 'STUDENT', name: 'Student Portal', desc: 'Secure biometric identity onboarding, fullscreen examination environment & instant verifiable score reports.', route: '/login?role=student', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    { role: 'FACULTY', name: 'Faculty Console', desc: 'Design comprehensive assessments, generate AI questions, provision invigilators & review detailed telemetry.', route: '/login?role=faculty', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { role: 'INVIGILATOR', name: 'Invigilator Station', desc: 'Real-time multi-candidate video tile wall, live gaze & audio flag logs, and instant session interventions.', route: '/login?role=invigilator', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    { role: 'ADMIN', name: 'Administrative Suite', desc: 'Verify candidate identity photos, inspect College IDs, provision institutional departments & oversee system health.', route: '/login?role=admin', badge: 'bg-purple-50 text-purple-700 border-purple-200' }
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Radial Slate/Blue Mesh Backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-blue-600/20 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -left-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20">P</div>
            <div>
              <span className="text-base font-black tracking-tight text-white">Proctor<span className="text-blue-500">Net</span></span>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">Enterprise</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <a href="#features" className="hover:text-white transition">Features Bento</a>
            <a href="#roles" className="hover:text-white transition">Portals</a>
            <Link to="/forgot-password" className="hover:text-white transition">Reset Password</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-600/30 cursor-pointer">
              Sign In to Portal
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center z-10">
        {/* Live System Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs font-semibold mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-emerald-400">INSTITUTIONAL EXAMINATION INFRASTRUCTURE</span>
          <span className="text-slate-400">• All Systems Operational</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Next-Generation AI & Browser-Lockdown <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-400">Examination Platform</span>
        </h1>
        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
          Standardized high-stakes assessments with pure browser containment, real-time AI gaze analytics, reference photo matching, and deterministic instant grading.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => navigate('/login')} className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer">
            Sign In to Examination Portal <ArrowRight className="w-4 h-4" />
          </button>
          <a href="#features" className="px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition">
            Explore Architecture
          </a>
        </div>

        {/* Hero Metrics Bar */}
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { val: '99.98%', label: 'Biometric Match Precision' },
            { val: '< 50ms', label: 'Proctor State Sync' },
            { val: '0 Installs', label: 'Pure Browser Lockdown' },
            { val: '100%', label: 'Deterministic Grading' }
          ].map((m, idx) => (
            <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center backdrop-blur-md">
              <div className="text-2xl font-black text-blue-400">{m.val}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Feature Bento Grid */}
      <section id="features" className="py-20 bg-slate-950/60 border-y border-slate-800/80 z-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">SYSTEM CAPABILITIES</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">Engineered for Academic Integrity</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Four integrated protective tiers delivering zero-compromise institutional assurance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {bentoFeatures.map((b, idx) => {
              const Icon = b.icon
              const isSelected = activeBento === idx
              return (
                <div
                  key={idx}
                  onClick={() => setActiveBento(idx)}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer ${b.accent} ${
                    isSelected ? 'ring-2 ring-blue-500/50 shadow-xl' : 'hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {b.stat}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{b.category}</span>
                  <h3 className="text-base font-bold text-white mt-1">{b.title}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{b.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4 Role Workflow Cards */}
      <section id="roles" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Dedicated workflows built for administrators, faculty examiners, students and invigilators.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 hover:shadow-xl transition">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  {r.role}
                </span>
                <h3 className="text-base font-bold text-white mt-3">{r.name}</h3>
                <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => navigate(r.route)}
                className="mt-6 w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-800 hover:border-blue-600 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Enter Portal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-10 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">P</div>
            <span className="font-bold text-slate-300">ProctorNet Platform</span>
          </div>
          <div className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} ProctorNet Examination Systems. AWS Rekognition & Pure Browser Lockdown.
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/login" className="hover:text-blue-400 transition">Portal Login</Link>
            <span className="text-slate-700">•</span>
            <Link to="/forgot-password" className="hover:text-blue-400 transition">Password Reset</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
