import * as React from 'react'
import { Shield, Check, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Badge } from '@/components/ui/badge'

const FEATURES = [
  {
    title: 'AI-Powered Verification',
    desc: 'Continuous identity confirmation utilizing multimodal biometrics.',
  },
  {
    title: 'Real-Time Monitoring Feed',
    desc: 'Low-latency video and screen capture streams with automated flagging.',
  },
  {
    title: 'Secure Browser Lock',
    desc: 'Prevents unauthorized application access and systemic navigation.',
  },
]

export default function AuthLayout({ title, subtitle, children, maxWidth = '440px' }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* ── Left Panel (Hero & Features - Zinc / Dark aesthetic) ── */}
      <div className="lg:flex-1 bg-card border-r border-border p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden hidden lg:flex">
        {/* Background mesh grid effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm transition-transform group-hover:scale-105">
              <Shield size={18} />
            </div>
            <span className="font-semibold tracking-tight text-foreground text-lg">
              ProctorNet
            </span>
          </Link>
          <Badge variant="outline" className="font-mono text-xs">
            v2.0 • Enterprise
          </Badge>
        </div>

        {/* Middle Feature Highlights */}
        <div className="relative z-10 my-12 max-w-lg">
          <Badge variant="secondary" className="mb-4">
            Next-Gen Exam Integrity
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-4 leading-tight">
            Secure, Intelligent Online Examination Platform.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Empower your organization with automated proctoring, live incident response, and end-to-end encryption.
          </p>

          <div className="space-y-4">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-background/50 backdrop-blur-sm">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{f.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center gap-4 text-xs text-muted-foreground">
          <span>© 2025 ProctorNet Inc.</span>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Support</a>
        </div>
      </div>

      {/* ── Right Panel (Auth Form) ── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 relative bg-background">
        {/* Top bar on form side */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} />
            Back to Home
          </Link>
          <ThemeToggle />
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mx-auto my-auto">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            {(title || subtitle) && (
              <div className="mb-6">
                {title && <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>}
                {subtitle && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-muted-foreground mt-8">
          Need help signing in? Contact your institution administrator.
        </div>
      </div>
    </div>
  )
}
