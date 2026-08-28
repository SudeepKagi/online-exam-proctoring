import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  Save, RefreshCw, Camera, Shield, Monitor, Key,
  CheckCircle2, Sliders, AlertTriangle, Eye, Lock, Volume2
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

const DEFAULT_SETTINGS = {
  faceVerificationEnabled: true,
  faceMatchThreshold: 85,
  reverifyIntervalMins: 10,
  faceAbsenceWarnSecs: 10,
  multipleFaceAlertEnabled: true,

  idCardVerificationEnabled: true,
  ocrToleranceThreshold: 80,
  requireUsnMatch: true,
  manualBiometricOverrideAllowed: true,

  vmDetectionEnabled: true,
  collusionDetectionEnabled: true,
  collusionThreshold: 80,
  dualFeedEnabled: true,
  audioAnomalyEnabled: true,

  watermarkVisible: true,
  watermarkOpacity: 15,
  kioskLockdownEnabled: true,
  preventClipboardCopy: true
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('face')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/settings')
        const loaded = res.data?.settings || res.data || {}
        setSettings(prev => ({ ...prev, ...loaded }))
      } catch (err) {
        console.error('[AdminSettings] Could not load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const setKey = (key) => (val) => {
    setSettings(prev => ({ ...prev, [key]: val }))
    setSavedSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSavedSuccess(false)
    try {
      await api.patch('/admin/settings', settings)
      setSavedSuccess(true)
      toast.success('Platform proctoring rules updated successfully')
      setTimeout(() => setSavedSuccess(false), 4000)
    } catch (err) {
      console.error('[AdminSettings] Failed to save settings:', err)
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'face', label: 'Face Verification', icon: Camera, desc: 'AI Face detection & match thresholds' },
    { id: 'ocr', label: 'ID & OCR Credentials', icon: Key, desc: 'PaddleOCR ID document verification' },
    { id: 'security', label: 'Security & Probes', icon: Shield, desc: 'VM & Collusion security rules' },
    { id: 'display', label: 'Display & Watermark', icon: Monitor, desc: 'Watermark & Kiosk lockdown preferences' },
  ]

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6 max-w-6xl font-sans">
        {/* Header Title Section */}
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">Settings</h1>
          <p className="text-xs text-[#64748b] mt-1 font-normal">
            Manage your exam platform proctoring rules, thresholds, and security preferences.
          </p>
        </div>

        <div className="h-[1px] bg-[#e2e8f0] w-full" />

        {/* Success Banner */}
        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#dcfce7] text-[#15803d] text-xs font-medium flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#16a34a]" />
              <span>Platform settings updated successfully and deployed to all active clusters.</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#16a34a]">Live Deployed</span>
          </div>
        )}

        {/* 2-Column Settings Layout */}
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe] shadow-2xs'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </aside>

          {/* Right Column: Tab Panels Content */}
          <div className="flex-1 w-full bg-white border border-[#e2e8f0] rounded-2xl p-6 sm:p-8 space-y-8 shadow-2xs">
            {/* TAB 1: Face Verification */}
            {activeTab === 'face' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">Face & Biometric Verification</h3>
                  <p className="text-xs text-[#64748b] mt-1">
                    Configure continuous camera identity checks powered by self-hosted Exadel CompreFace REST API.
                  </p>
                </div>
                <div className="h-[1px] bg-[#f1f5f9]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Enable Live Face Verification</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Continuously verify candidate identity via webcam feed.</p>
                    </div>
                    <Switch
                      checked={!!settings.faceVerificationEnabled}
                      onCheckedChange={setKey('faceVerificationEnabled')}
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">Face Match Confidence Threshold</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.faceMatchThreshold}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Minimum similarity score required to pass automatic face verification.</p>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      value={Number(settings.faceMatchThreshold)}
                      onChange={(e) => setKey('faceMatchThreshold')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">Background Re-verification Interval</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.reverifyIntervalMins} min
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Frequency of background biometric probes during live exam sessions.</p>
                    <input
                      type="range"
                      min={2}
                      max={30}
                      value={Number(settings.reverifyIntervalMins)}
                      onChange={(e) => setKey('reverifyIntervalMins')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">Face Absence Warning Threshold</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.faceAbsenceWarnSecs} sec
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Number of seconds face can be absent from frame before warning is triggered.</p>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      value={Number(settings.faceAbsenceWarnSecs)}
                      onChange={(e) => setKey('faceAbsenceWarnSecs')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Multiple Face Detection Alert</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Flag candidate and notify invigilator immediately if more than one person is in frame.</p>
                    </div>
                    <Switch
                      checked={!!settings.multipleFaceAlertEnabled}
                      onCheckedChange={setKey('multipleFaceAlertEnabled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ID & OCR Credentials */}
            {activeTab === 'ocr' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">ID & OCR Document Verification</h3>
                  <p className="text-xs text-[#64748b] mt-1">
                    Configure institutional ID card optical character recognition rules for student pre-checks.
                  </p>
                </div>
                <div className="h-[1px] bg-[#f1f5f9]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">ID Card OCR Document Verification</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Require students to present and verify institutional ID cards prior to exam admission.</p>
                    </div>
                    <Switch
                      checked={!!settings.idCardVerificationEnabled}
                      onCheckedChange={setKey('idCardVerificationEnabled')}
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">OCR Name Matching Tolerance</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.ocrToleranceThreshold}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Minimum text string similarity between uploaded ID and student registered name.</p>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={Number(settings.ocrToleranceThreshold)}
                      onChange={(e) => setKey('ocrToleranceThreshold')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Strict USN & Department Validation</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Enforce strict character-for-character USN matching from OCR card text.</p>
                    </div>
                    <Switch
                      checked={!!settings.requireUsnMatch}
                      onCheckedChange={setKey('requireUsnMatch')}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Allow Manual Biometric Override by Invigilator</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Allow authorized proctors to manually verify and admit candidates if OCR fails.</p>
                    </div>
                    <Switch
                      checked={!!settings.manualBiometricOverrideAllowed}
                      onCheckedChange={setKey('manualBiometricOverrideAllowed')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Security & Probes */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">Proctoring Security & Machine Audits</h3>
                  <p className="text-xs text-[#64748b] mt-1">
                    Configure hardware hypervisor detection, collusion detection algorithms, and audio probes.
                  </p>
                </div>
                <div className="h-[1px] bg-[#f1f5f9]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Virtual Machine & Hypervisor Detection</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Block execution on virtual environments (VirtualBox, VMware, QEMU, SwiftShader).</p>
                    </div>
                    <Switch
                      checked={!!settings.vmDetectionEnabled}
                      onCheckedChange={setKey('vmDetectionEnabled')}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Collusion Detection Engine</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Detect synchronized answer submission patterns and code similarity across candidates.</p>
                    </div>
                    <Switch
                      checked={!!settings.collusionDetectionEnabled}
                      onCheckedChange={setKey('collusionDetectionEnabled')}
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">Collusion Similarity Score Threshold</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.collusionThreshold}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Flag submissions as suspected collusion if code/text cosine similarity exceeds this rate.</p>
                    <input
                      type="range"
                      min={50}
                      max={95}
                      value={Number(settings.collusionThreshold)}
                      onChange={(e) => setKey('collusionThreshold')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Dual-Feed (Webcam + Screen) Probing</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Enforce continuous synchronized screen feed recording alongside candidate webcam video.</p>
                    </div>
                    <Switch
                      checked={!!settings.dualFeedEnabled}
                      onCheckedChange={setKey('dualFeedEnabled')}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Hardware Audio Noise Anomaly Probe</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Flag sustained whisper patterns or room chatter using audio frequency analysis.</p>
                    </div>
                    <Switch
                      checked={!!settings.audioAnomalyEnabled}
                      onCheckedChange={setKey('audioAnomalyEnabled')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Display & Watermark */}
            {activeTab === 'display' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">Display, Watermark & Kiosk Lockdown</h3>
                  <p className="text-xs text-[#64748b] mt-1">
                    Configure anti-leak tracking watermarks and kiosk desktop containment parameters.
                  </p>
                </div>
                <div className="h-[1px] bg-[#f1f5f9]" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Dynamic Candidate Watermark</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Overlay candidate USN, IP, and session timestamp subtly across exam questions to prevent screen photography leaks.</p>
                    </div>
                    <Switch
                      checked={!!settings.watermarkVisible}
                      onCheckedChange={setKey('watermarkVisible')}
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#0f172a]">Watermark Opacity</label>
                      <span className="font-mono text-xs font-bold text-[#2563eb] border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                        {settings.watermarkOpacity}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Adjust visibility of the forensic watermark without impairing question readability.</p>
                    <input
                      type="range"
                      min={5}
                      max={40}
                      value={Number(settings.watermarkOpacity)}
                      onChange={(e) => setKey('watermarkOpacity')(Number(e.target.value))}
                      className="w-full h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#2f80ed]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Fullscreen Kiosk Lockdown (Esc Trap)</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Force browser into fullscreen mode and trap Escape key to prevent window minimizing.</p>
                    </div>
                    <Switch
                      checked={!!settings.kioskLockdownEnabled}
                      onCheckedChange={setKey('kioskLockdownEnabled')}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                    <div>
                      <p className="text-xs font-semibold text-[#0f172a]">Prevent Right-Click & Clipboard Copy/Paste</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">Disable context menus, developer inspection hotkeys, and external clipboard paste events.</p>
                    </div>
                    <Switch
                      checked={!!settings.preventClipboardCopy}
                      onCheckedChange={setKey('preventClipboardCopy')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Action Button */}
            <div className="pt-4 border-t border-[#f1f5f9] flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? 'Updating...' : 'Update Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
