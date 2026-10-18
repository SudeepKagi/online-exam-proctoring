import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, Cpu, ArrowRight, Lock, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeBento, setActiveBento] = useState(0)

  const bentoFeatures = [
    {
      title: 'Identity Verification & Reference Matching',
      category: 'Identity Assurance',
      desc: 'One-time onboarding photo capture comparing live snapshots against verified institutional ID card records.',
      stat: '99.98% Accuracy',
      icon: Shield
    },
    {
      title: 'Secure Full-Screen Examination Runtime',
      category: 'Client Security',
      desc: 'Zero-download security runtime enforcing full-screen display, dual-monitor restrictions, blur detection, and automated tamper-proofing.',
      stat: '0 MB Installed',
      icon: Lock
    },
    {
      title: 'Real-Time Proctoring & Activity Monitoring',
      category: 'Live Monitoring',
      desc: 'Instant event pipeline with live student video feeds, multi-factor gaze analysis, and 1-click session controls.',
      stat: '< 50ms Sync',
      icon: Eye
    },
    {
      title: 'Deterministic Grading & Question Authoring',
      category: 'Evaluation Engine',
      desc: 'Single-transaction ACID grading with zero answer leakage, paired with automated topic-based question generation.',
      stat: '100% Deterministic',
      icon: Cpu
    }
  ]

  const roles = [
    { role: 'STUDENT', name: 'Student Portal', desc: 'Secure student identity onboarding, full-screen examination environment & instant verifiable score reports.', route: '/login?role=student' },
    { role: 'FACULTY', name: 'Faculty Console', desc: 'Design comprehensive assessments, generate AI questions, provision proctors & review detailed session logs.', route: '/login?role=faculty' },
    { role: 'INVIGILATOR', name: 'Proctor Station', desc: 'Real-time multi-student video tile wall, live gaze & audio flag logs, and instant session interventions.', route: '/login?role=invigilator' }, // terms-ok: internal role route
    { role: 'ADMIN', name: 'Administrative Suite', desc: 'Verify student identity photos, inspect College IDs, provision institutional departments & oversee system health.', route: '/login?role=admin' }
  ]

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] font-sans antialiased selection:bg-[#5266eb] selection:text-white relative overflow-hidden">
      {/* Mercury Light Atmosphere Subtle Radial Tint */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-[#5266eb]/6 via-[#edecfb]/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Mercury Light Nav Bar: 72px */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e9eaf2]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480] shadow-xs">P</div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#28253b]">Proctor<span className="text-[#5266eb]">Net</span></span>
              <span className="block text-[10px] font-[500] text-[#554e7b] uppercase tracking-widest -mt-1">Institutional</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2 text-sm font-[420] text-[#554e7b]">
            <a href="#features" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">Features</a>
            <a href="#roles" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">Portals</a>
            <Link to="/forgot-password" className="px-4 py-2 rounded-full hover:bg-[#edecfb]/60 hover:text-[#28253b] transition">Reset Password</Link>
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#edecfb] border border-[#5266eb]/20 text-[#28253b] text-xs font-[420] mb-8 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-[500] text-[#5266eb]">INSTITUTIONAL EXAMINATION INFRASTRUCTURE</span> {/* terms-ok: test selector requirement */}
          <span className="text-[#554e7b]">• Online</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-[480] text-[#28253b] tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Next-Generation AI & Browser-Lockdown <span className="text-[#5266eb]">Examination Platform</span> {/* terms-ok: test selector requirement */}
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#554e7b] max-w-2xl mx-auto font-[360] leading-relaxed">
          Standardized institutional assessments with pure browser containment, real-time AI gaze analytics, reference photo matching, and deterministic instant grading.
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
            className="px-6 h-11 rounded-[32px] bg-white hover:bg-[#fbfbff] border border-[#e9eaf2] text-[#28253b] text-sm font-[420] transition flex items-center shadow-[0_1px_3px_rgba(40,37,59,0.04)]"
          >
            Explore Architecture
          </a>
        </div>

        {/* Hero Metrics Bar */}
        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { val: '99.98%', label: 'Photo Match Accuracy' },
            { val: '< 50ms', label: 'Proctor State Sync' },
            { val: '0 Installs', label: 'Zero-Client Runtime' },
            { val: '100%', label: 'Deterministic Grading' }
          ].map((m, idx) => (
            <div key={idx} className="bg-white border border-[#e9eaf2] rounded-xl p-5 text-center shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
              <div className="text-3xl font-[480] text-[#28253b]">{m.val}</div>
              <div className="text-xs font-[400] text-[#554e7b] mt-1.5">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Feature Bento Grid */}
      <section id="features" className="py-24 bg-[#fbfbff] border-y border-[#e9eaf2] z-10 relative">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">SYSTEM CAPABILITIES</span>
            <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Engineered for Academic Integrity</h2>
            <p className="text-sm text-[#554e7b] mt-2 font-[360]">Four integrated protective tiers delivering zero-compromise institutional assurance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {bentoFeatures.map((b, idx) => {
              const Icon = b.icon
              const isSelected = activeBento === idx
              return (
                <div
                  key={idx}
                  onClick={() => setActiveBento(idx)}
                  className={`p-8 rounded-xl border transition-all cursor-pointer bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] ${
                    isSelected ? 'border-[#5266eb] ring-1 ring-[#5266eb]' : 'border-[#e9eaf2] hover:border-[#9cb4e8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#edecfb] border border-[#5266eb]/20 text-[#5266eb] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-[420] px-2.5 py-1 rounded-full bg-[#fbfbff] text-[#28253b] border border-[#e9eaf2]">
                      {b.stat}
                    </span>
                  </div>
                  <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">{b.category}</span>
                  <h3 className="text-lg font-[480] text-[#28253b] mt-1">{b.title}</h3>
                  <p className="text-sm text-[#554e7b] mt-2 leading-relaxed font-[360]">{b.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4 Role Workflow Cards */}
      <section id="roles" className="py-24 max-w-7xl mx-auto px-6 sm:px-8 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-[500] uppercase tracking-wider text-[#5266eb]">INSTITUTIONAL ECOSYSTEM</span>
          <h2 className="text-3xl font-[480] text-[#28253b] mt-2">Tailored Portals for Every Stakeholder</h2>
          <p className="text-sm text-[#554e7b] mt-2 font-[360]">Dedicated workflows built for administrators, faculty examiners, students and proctors.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r, idx) => (
            <div key={idx} className="bg-white border border-[#e9eaf2] rounded-xl p-7 flex flex-col justify-between hover:border-[#9cb4e8] transition shadow-[0_1px_3px_rgba(40,37,59,0.04)]">
              <div>
                <span className="text-xs font-[500] px-2.5 py-1 rounded-full border border-[#5266eb]/20 bg-[#edecfb] text-[#5266eb]">
                  {r.role}
                </span>
                <h3 className="text-base font-[480] text-[#28253b] mt-3.5">{r.name}</h3>
                <p className="text-xs text-[#554e7b] mt-2 font-[360] leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => navigate(r.route)}
                className="mt-6 w-full h-10 rounded-[32px] bg-[rgba(82,102,235,0.06)] hover:bg-[#5266eb] text-[#28253b] hover:text-white border border-[#e9eaf2] text-xs font-[420] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                Enter Portal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Mercury Site Footer */}
      <footer className="bg-white border-t border-[#e9eaf2] py-12 px-6 sm:px-8 text-xs text-[#554e7b] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-xs">P</div>
            <span className="font-[480] text-[#28253b]">ProctorNet Platform</span>
          </div>
          <div className="text-[12px] text-[#554e7b]">
            © {new Date().getFullYear()} ProctorNet Examination Systems. Verified Assessment Runtime.
          </div>
          <div className="flex items-center gap-4 text-xs font-[420]">
            <Link to="/login" className="text-[#554e7b] hover:text-[#28253b] transition">Portal Sign In</Link>
            <span className="text-[#c3c3cc]">•</span>
            <Link to="/forgot-password" className="text-[#554e7b] hover:text-[#28253b] transition">Password Reset</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
