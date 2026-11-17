import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Lock, Database, Clock, EyeOff, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppFooter from '@/components/common/AppFooter'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy & Data Map')
  const navigate = useNavigate()

  const dataInventory = [
    {
      element: 'Student Identity & Profile',
      fields: 'Full Name, University Email, Institution ID / USN, Role, Status',
      storage: 'PostgreSQL users table',
      encryption: 'AWS RDS AES-256 at rest',
      access: 'Student (own), Faculty (enrolled courses), Admin',
      retention: 'Enrollment duration + 1 year'
    },
    {
      element: 'Authentication Credentials',
      fields: 'Scrypt / Bcrypt password_hash, Session Refresh Tokens',
      storage: 'PostgreSQL users table; HTTP-only SameSite cookies',
      encryption: 'Cryptographic hash with salt; signed HMAC-SHA256',
      access: 'Auth service only (never exposed)',
      retention: 'Account lifetime; tokens expire in 7 days'
    },
    {
      element: 'Institutional Reference Photo',
      fields: 'Student onboarding webcam portrait',
      storage: 'AWS S3 (reference-photos/{userId}/*)',
      encryption: 'S3 Server-Side Encryption (SSE-S3 / SSE-KMS)',
      access: 'Student (own), Faculty & Proctors for pre-check',
      retention: 'Enrollment duration or re-verification'
    },
    {
      element: 'Pre-Exam Consent Records',
      fields: 'Student ID, Exam ID, Version v1.0, Policy Text, Timestamp',
      storage: 'PostgreSQL student_consents table',
      encryption: 'PostgreSQL RDS AES-256 at rest',
      access: 'Student (own), Faculty owner, Admin',
      retention: 'Duration of exam audit compliance'
    },
    {
      element: 'System Readiness Telemetry',
      fields: 'OS family, Browser family, Camera status, Latency category',
      storage: 'PostgreSQL student_readiness_reports table',
      encryption: 'PostgreSQL RDS AES-256 at rest',
      access: 'Student (own), Faculty owner, Admin',
      retention: '90 days post-exam completion'
    },
    {
      element: 'Exam Assessment Answers',
      fields: 'Selected option indices, bookmarks, timestamps, calculated score',
      storage: 'PostgreSQL exam_attempts, attempt_answers tables',
      encryption: 'PostgreSQL RDS AES-256 at rest',
      access: 'Student (own after publish), Faculty creator, Admin',
      retention: 'Academic grade retention (university policy)'
    },
    {
      element: 'Proctoring Violation Evidence',
      fields: 'Webcam snapshots, anomaly event types, severity rating',
      storage: 'AWS S3 (evidence/{attemptId}/*), proctoring_logs',
      encryption: 'S3 SSE-KMS at rest, presigned URLs (600s TTL)',
      access: 'Faculty exam creator, Assigned Invigilators, Admin',
      retention: 'Configurable (default: 90 days), then purged'
    },
    {
      element: 'AI Question PDF Extraction',
      fields: 'Uploaded PDF syllabus/questions text buffer',
      storage: 'In-memory buffer only (ephemeral)',
      encryption: 'TLS 1.3 in transit to LLM API (zero disk/S3 write)',
      access: 'Faculty creator only',
      retention: 'Immediate release upon question extraction'
    }
  ]

  const exclusions = [
    {
      title: 'Zero IP Address Logging in Business Tables',
      desc: 'Telemetry reports do not store client public or private IP addresses.'
    },
    {
      title: 'Zero Device Fingerprints or Hardware Serial Numbers',
      desc: 'CPU serials, MAC addresses, and persistent device GUIDs are never probed or recorded.'
    },
    {
      title: 'Zero Raw Biometric Descriptor Storage',
      desc: '128-dimensional facial vector descriptors are ephemeral in-memory representations and never saved to persistent storage.'
    },
    {
      title: 'Zero Continuous Screen Video Streaming',
      desc: 'Screen sharing is completely removed; application integrity is enforced via Safe Exam Browser kiosk lockdown and fullscreen validation.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] font-sans antialiased flex flex-col justify-between">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#c3c3cc]/20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[72px] flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-full bg-[#5266eb] flex items-center justify-center text-white font-[480]">
              P
            </div>
            <div>
              <span className="text-base font-[480] tracking-wide text-[#28253b]">
                Proctor<span className="text-[#5266eb]">Net</span>
              </span>
              <span className="block text-[10px] font-[500] text-[#554e7b] uppercase tracking-widest -mt-1">
                Enterprise
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#5266eb]" /> Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 sm:px-8 py-12 flex-1 w-full space-y-12">
        {/* Title */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#edecfb] text-xs font-[420] text-[#5266eb] mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> FERPA & GDPR Compliance Architecture
          </div>
          <h1 className="text-3xl font-[480] text-[#28253b] tracking-tight">
            Privacy Policy & Data Map
          </h1>
          <p className="text-sm text-[#554e7b] font-[360] mt-2 leading-relaxed max-w-3xl">
            ProctorNet operates under strict data minimization, purpose limitation, and storage limitation principles. This document details all collected data elements, encryption standards, retention windows, and privacy protections.
          </p>
        </div>

        {/* Architectural Principles */}
        <section className="space-y-4">
          <h2 className="text-lg font-[480] text-[#28253b] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#5266eb]" /> Core Privacy Principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-[16px] shadow-xs space-y-1.5">
              <h3 className="text-xs font-[500] uppercase text-[#5266eb]">Minimal Telemetry</h3>
              <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
                Hardware and network readiness checks record only coarse categorical buckets (e.g., OS family, latency bucket) without device serials or arbitrary client inspection.
              </p>
            </div>
            <div className="p-5 bg-white rounded-[16px] shadow-xs space-y-1.5">
              <h3 className="text-xs font-[500] uppercase text-[#5266eb]">Ephemeral Biometrics</h3>
              <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
                Facial verification performs 1:1 identity checks. Raw 128-dimensional biometric embeddings are ephemeral and never stored in relational or vector databases.
              </p>
            </div>
            <div className="p-5 bg-white rounded-[16px] shadow-xs space-y-1.5">
              <h3 className="text-xs font-[500] uppercase text-[#5266eb]">Role-Based Access (RBAC)</h3>
              <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
                Students can only view their own submissions; faculty inspect enrolled cohort evidence; administrators maintain system audit trails. Zero public data exposure.
              </p>
            </div>
            <div className="p-5 bg-white rounded-[16px] shadow-xs space-y-1.5">
              <h3 className="text-xs font-[500] uppercase text-[#5266eb]">Finite Retention & Deletion</h3>
              <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
                All automated proctoring snapshots, telemetry, and evidence are subject to a 90-day institutional retention schedule with automated nightly purge routines.
              </p>
            </div>
          </div>
        </section>

        {/* Data Inventory Table */}
        <section className="space-y-4">
          <h2 className="text-lg font-[480] text-[#28253b] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#5266eb]" /> Personal Data Inventory & Storage Map
          </h2>
          <div className="bg-white rounded-[16px] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#fbfbff] border-b border-[#c3c3cc]/20 text-[#554e7b] font-[480]">
                    <th className="py-3 px-4">Data Element</th>
                    <th className="py-3 px-4">Storage Location</th>
                    <th className="py-3 px-4">Encryption at Rest</th>
                    <th className="py-3 px-4">Retention Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c3cc]/15">
                  {dataInventory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#fbfbff]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-[480] text-[#28253b]">{item.element}</div>
                        <div className="text-[11px] text-[#554e7b] font-[360] mt-0.5">{item.fields}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#554e7b]">
                        {item.storage}
                      </td>
                      <td className="py-3.5 px-4 text-[#554e7b] font-[360]">
                        {item.encryption}
                      </td>
                      <td className="py-3.5 px-4 text-[#554e7b] font-[420]">
                        {item.retention}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Explicit Exclusions */}
        <section className="space-y-4">
          <h2 className="text-lg font-[480] text-[#28253b] flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-[#5266eb]" /> Explicit Telemetry Exclusions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exclusions.map((ex, idx) => (
              <div key={idx} className="p-4 bg-[#edecfb] rounded-[14px] space-y-1">
                <div className="text-xs font-[480] text-[#28253b] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5266eb]" /> {ex.title}
                </div>
                <p className="text-[11px] text-[#554e7b] font-[360] leading-relaxed pl-5">
                  {ex.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Student Rights: Erasure & Access */}
        <section className="space-y-4">
          <h2 className="text-lg font-[480] text-[#28253b] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#5266eb]" /> Data Rights & Erasure
          </h2>
          <div className="p-6 bg-white rounded-[16px] shadow-xs space-y-3">
            <h3 className="text-xs font-[480] text-[#28253b]">Right to Erasure & Access Protocols</h3>
            <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
              Institutional administrators can execute verified student data export requests (<code className="text-[#5266eb] font-mono">GET /api/v1/admin/users/:id/data-export</code>) to produce a portable machine-readable archive of all user records. Upon graduation or verified institutional erasure request, administrators execute evidence purges (<code className="text-[#5266eb] font-mono">DELETE /api/v1/admin/users/:id/evidence</code>) to permanently delete reference portraits, ID documents, and associated attempt logs from S3 and relational storage.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  )
}
