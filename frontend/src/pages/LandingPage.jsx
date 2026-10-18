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
    <div className="min-h-screen bg-[#171721] text-[#ededf3] font-sans antialiased selection:bg-[#5266eb] selection:text-white relative overflow-hidden">
      {/* Mercury Night Atmosphere Luminous Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-[#5266eb]/20 via-[#9cb4e8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -left-48 w-96 h-96 bg-[#5266eb]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Mercury Night Nav Bar: 72px, #171721 */}
      <header className="sticky top-0 z-50 bg-[#171721]/90 backdrop-blur-xl border-b border-[#28253b]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480] shadow-xs">P</div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#ededf3]">Proctor<span className="text-[#9cb4e8]">Net</span></span>
              <span className="block text-[10px] font-[500] text-[#c3c3cc] uppercase tracking-widest -mt-1">Institutional</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2 text-sm font-[420] text-[#ededf3]">
            <a href="#features" className="px-4 py-2 rounded-full hover:bg-white/10 text-[#ededf3] transition">Features</a>
            <a href="#roles" className="px-4 py-2 rounded-full hover:bg-white/10 text-[#ededf3] transition">Portals</a>
            <Link to="/forgot-password" className="px-4 py-2 rounded-full hover:bg-white/10 text-[#c3c3cc] hover:text-[#ededf3] transition">Reset Password</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 h-10 rounded-[32px] text-xs font-[420] text-white bg-[#5266eb] hover:bg-[#4354d0] transition shadow-xs cursor-pointer"
            >
              Sign In to Portal
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 sm:px-8 max-w-7xl mx-auto text-center z-10">
        {/* Live System Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1e1e2a] border border-[#28253b] text-[#ededf3] text-xs font-[420] mb-8 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-[500] text-emerald-300">INSTITUTIONAL EXAMINATION INFRASTRUCTURE</span>
          <span className="text-[#c3c3cc]">• Online</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-[480] text-[#ededf3] tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Next-Generation AI & Browser-Lockdown <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9cb4e8] via-[#edecfb] to-[#ffffff]">Examination Platform</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#c3c3cc] max-w-2xl mx-auto font-[360] leading-relaxed">
          Standardized high-stakes assessments with pure browser containment, real-time AI gaze analytics, reference photo matching, and deterministic instant grading.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-6 h-11 rounded-[32px] bg-[#5266eb] hover:bg-[#4354d0] text-white text-sm font-[420] transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            Open Examination Portal <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#features"
            className="px-6 h-11 rounded-full bg-[rgba(175,178,206,0.2)] hover:bg-[rgba(175,178,206,0.28)] border border-[rgba(175,178,206,0.36)] text-[#ededf3] text-sm font-[420] transition flex items-center"
          >
            Explore Architecture
          </a>
        </div>

        {/* Hero Metrics Bar: Mercury Stat Block */}
        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { val: '99.98%', label: 'Biometric Match Precision' },
            { val: '< 50ms', label: 'Proctor State Sync' },
            { val: '0 Installs', label: 'Pure Browser Lockdown' },
            { val: '100%', label: 'Deterministic Grading' }
          ].map((m, idx) => (
            <div key={idx} className="bg-[#1e1e2a] border border-[#28253b] rounded-xl p-5 text-center">
              <div className="text-3xl font-[480] text-[#ededf3]">{m.val}</div>
              <div className="text-xs font-[400] text-[#c3c3cc] mt-1.5">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Feature Bento Grid: Mercury feature-card-dark */}
      <section id="features" className="py-24 bg-[#171721] border-y border-[#28253b] z-10 relative">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-[500] uppercase tracking-wider text-[#9cb4e8]">SYSTEM CAPABILITIES</span>
            <h2 className="text-3xl font-[480] text-[#ededf3] mt-2">Engineered for Academic Integrity</h2>
            <p className="text-sm text-[#c3c3cc] mt-2 font-[360]">Four integrated protective tiers delivering zero-compromise institutional assurance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {bentoFeatures.map((b, idx) => {
              const Icon = b.icon
              const isSelected = activeBento === idx
              return (
                <div
                  key={idx}
                  onClick={() => setActiveBento(idx)}
                  className={`p-8 rounded-xl border transition-all cursor-pointer bg-[#1e1e2a] ${
                    isSelected ? 'border-[#5266eb] ring-1 ring-[#5266eb]' : 'border-[#28253b] hover:border-[#554e7b]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#5266eb]/15 border border-[#5266eb]/30 text-[#9cb4e8] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-[420] px-2.5 py-1 rounded-full bg-[#171721] text-[#ededf3] border border-[#28253b]">
                      {b.stat}
                    </span>
                  </div>
                  <span className="text-xs font-[500] uppercase tracking-wider text-[#9cb4e8]">{b.category}</span>
                  <h3 className="text-lg font-[480] text-[#ededf3] mt-1">{b.title}</h3>
                  <p className="text-sm text-[#c3c3cc] mt-2 leading-relaxed font-[360]">{b.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4 Role Workflow Cards: Mercury night-raised cards */}
      <section id="roles" className="py-24 max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#9cb4e8]">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-3xl font-[480] text-[#ededf3] mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-sm text-[#c3c3cc] mt-2 font-[360]">Dedicated workflows built for administrators, faculty examiners, students and invigilators.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-[#1e1e2a] border border-[#28253b] rounded-xl p-7 flex flex-col justify-between hover:border-[#554e7b] transition">
              <div>
                <span className="text-xs font-[500] px-2.5 py-1 rounded-full border border-[#9cb4e8]/25 bg-[#9cb4e8]/10 text-[#9cb4e8]">
                  {r.role}
                </span>
                <h3 className="text-base font-[480] text-[#ededf3] mt-3.5">{r.name}</h3>
                <p className="text-xs text-[#c3c3cc] mt-2 font-[360] leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => navigate(r.route)}
                className="mt-6 w-full h-10 rounded-full bg-[rgba(156,180,232,0.1)] hover:bg-[#5266eb] text-[#ededf3] hover:text-white border border-[rgba(156,180,232,0.2)] text-xs font-[420] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Enter Portal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Mercury Site Footer */}
      <footer className="bg-[#171721] border-t border-[#28253b] py-12 px-6 sm:px-8 text-xs text-[#c3c3cc] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-xs">P</div>
            <span className="font-[480] text-[#ededf3]">ProctorNet Platform</span>
          </div>
          <div className="text-[12px] text-[#c3c3cc]">
            © {new Date().getFullYear()} ProctorNet Examination Systems. AWS Rekognition & Pure Browser Lockdown.
          </div>
          <div className="flex items-center gap-4 text-xs font-[420]">
            <Link to="/login" className="text-[#ededf3] hover:text-[#9cb4e8] transition">Portal Login</Link>
            <span className="text-[#554e7b]">•</span>
            <Link to="/forgot-password" className="text-[#ededf3] hover:text-[#9cb4e8] transition">Password Reset</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
