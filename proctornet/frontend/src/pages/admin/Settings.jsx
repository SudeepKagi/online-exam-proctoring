import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Save,
  RefreshCw,
  Camera,
  Wifi,
  Eye,
  Shield,
  Monitor,
  User,
  Key,
  Sliders,
  CheckCircle2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const DEFAULT_SETTINGS = {
  faceMatchThreshold: 85,
  reverifyIntervalMins: 10,
  faceAbsenceWarnSecs: 10,
  faceAbsencePauseSecs: 20,
  collusionThreshold: 80,
  vpnEnforced: true,
  watermarkVisible: true,
  faceVerificationEnabled: true,
  idCardVerificationEnabled: true,
  vmDetectionEnabled: true,
  collusionDetectionEnabled: true,
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/settings')
        if (res.data) setSettings({ ...DEFAULT_SETTINGS, ...res.data })
      } catch {
        toast.error('Could not load settings — using default values')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const setKey = (key) => (val) => setSettings((prev) => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/admin/settings', settings)
      toast.success('Platform settings updated successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Face Verification', icon: Camera, desc: 'AI Face detection & match thresholds' },
    { id: 'account', label: 'ID & OCR Credentials', icon: Key, desc: 'PaddleOCR ID document verification' },
    { id: 'vpn', label: 'VPN & Routing', icon: Wifi, desc: 'WireGuard network tunnel requirements' },
    { id: 'proctoring', label: 'Security & Probes', icon: Shield, desc: 'VM & Collusion security rules' },
    { id: 'display', label: 'Display & Watermark', icon: Monitor, desc: 'Watermark overlay preferences' },
  ]

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6 max-w-6xl mx-auto font-sans">
        {/* Header Title Section (Matches Shadcn Admin) */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your exam platform proctoring rules, thresholds, and security preferences.
          </p>
        </div>

        {/* Horizontal Separator */}
        <div className="h-[1px] bg-[#27272A] w-full" />

        {/* Main 2-Column Settings Layout */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left Column: Vertical Navigation Tabs */}
          <aside className="w-full md:w-64 shrink-0 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#18181B] text-slate-100 border border-[#27272A] shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#141416]'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </aside>

          {/* Right Column: Tab Panels Content */}
          <div className="flex-1 w-full bg-[#141416] border border-[#27272A] rounded-2xl p-6 sm:p-8 space-y-8 shadow-xl">
            {/* TAB 1: Face Verification */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Face & Biometric Verification</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure continuous camera identity checks powered by self-hosted Exadel CompreFace REST API.
                  </p>
                </div>
                <div className="h-[1px] bg-[#27272A]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Enable Live Face Verification</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Continuously verify candidate identity via webcam feed.</p>
                    </div>
                    <Switch
                      checked={!!settings.faceVerificationEnabled}
                      onCheckedChange={setKey('faceVerificationEnabled')}
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">Face Match Confidence Threshold</label>
                      <Badge variant="outline" className="font-mono text-xs text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                        {settings.faceMatchThreshold}%
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">Minimum similarity score required to pass automatic face verification.</p>
                    <input
                      type="range"
                      min={70}
                      max={100}
                      value={settings.faceMatchThreshold}
                      onChange={(e) => setKey('faceMatchThreshold')(Number(e.target.value))}
                      className="w-full h-2 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">Background Re-verification Interval</label>
                      <Badge variant="outline" className="font-mono text-xs text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                        {settings.reverifyIntervalMins} min
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">Frequency of background biometric probes during live exam sessions.</p>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      value={settings.reverifyIntervalMins}
                      onChange={(e) => setKey('reverifyIntervalMins')(Number(e.target.value))}
                      className="w-full h-2 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ID & OCR Credentials */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">ID & OCR Document Verification</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure PaddleOCR and MTCNN face-crop rules for institutional ID card validation.
                  </p>
                </div>
                <div className="h-[1px] bg-[#27272A]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">ID Card OCR Verification</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Require students to upload and verify ID card credentials prior to exam entry.</p>
                    </div>
                    <Switch
                      checked={!!settings.idCardVerificationEnabled}
                      onCheckedChange={setKey('idCardVerificationEnabled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VPN & Routing */}
            {activeTab === 'vpn' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">VPN & Network Tunnel Configuration</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enforce WireGuard VPN connectivity to ensure secure exam transport.
                  </p>
                </div>
                <div className="h-[1px] bg-[#27272A]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Enforce WireGuard VPN Connection</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Block exam entrance unless candidate's traffic is routed through encrypted WireGuard tunnel.</p>
                    </div>
                    <Switch
                      checked={!!settings.vpnEnforced}
                      onCheckedChange={setKey('vpnEnforced')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Security & Probes */}
            {activeTab === 'proctoring' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Proctoring Security & Machine Audits</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure virtual machine hypervisor detection and collusion pattern thresholds.
                  </p>
                </div>
                <div className="h-[1px] bg-[#27272A]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Virtual Machine Detection</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Block execution on virtual hypervisors (VirtualBox, VMware, SwiftShader).</p>
                    </div>
                    <Switch
                      checked={!!settings.vmDetectionEnabled}
                      onCheckedChange={setKey('vmDetectionEnabled')}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Collusion Detection Engine</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Detect suspicious answer similarity patterns across candidates.</p>
                    </div>
                    <Switch
                      checked={!!settings.collusionDetectionEnabled}
                      onCheckedChange={setKey('collusionDetectionEnabled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Display & Watermark */}
            {activeTab === 'display' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Display & Watermark Settings</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure anti-leak tracking watermarks overlaid during exams.
                  </p>
                </div>
                <div className="h-[1px] bg-[#27272A]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Dynamic Candidate Watermark</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Overlay candidate USN, IP, and session ID dynamically across the viewport.</p>
                    </div>
                    <Switch
                      checked={!!settings.watermarkVisible}
                      onCheckedChange={setKey('watermarkVisible')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Action Button */}
            <div className="pt-4 border-t border-[#27272A] flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="text-xs font-mono font-bold px-6 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                {saving ? 'Saving...' : 'Update Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
