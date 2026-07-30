import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Save, RefreshCw, Shield, Camera, Wifi, Eye, Cpu, CheckCircle2, Lock, SlidersHorizontal } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function SliderInput({ label, value, min, max, step = 1, unit, onChange, desc }) {
  return (
    <div className="space-y-2.5 p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-slate-200">{label}</label>
          {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
        </div>
        <Badge variant="outline" className="font-mono text-xs text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
          {value}{unit}
        </Badge>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
      />
      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/settings')
        if (res.data) setSettings({ ...DEFAULT_SETTINGS, ...res.data })
      } catch {
        toast.error('Could not load settings — using defaults')
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
      toast.success('Platform security settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    {
      title: 'Face & Biometric Verification',
      icon: Camera,
      badge: 'Exadel CompreFace',
      items: [
        { type: 'toggle', label: 'Enable Face Verification', key: 'faceVerificationEnabled', desc: 'Continuously verify student identity via camera and CompreFace AI' },
        { type: 'slider', label: 'Face Match Threshold', key: 'faceMatchThreshold', min: 70, max: 100, unit: '%', desc: 'Minimum confidence score required to auto-pass face check' },
        { type: 'slider', label: 'Re-verify Interval', key: 'reverifyIntervalMins', min: 5, max: 30, unit: ' min', desc: 'Frequency of background face verification during exam' },
        { type: 'slider', label: 'Face Absence Warning', key: 'faceAbsenceWarnSecs', min: 5, max: 30, unit: 's', desc: 'Seconds before displaying candidate absence warning' },
        { type: 'slider', label: 'Face Absence Pause', key: 'faceAbsencePauseSecs', min: 10, max: 60, unit: 's', desc: 'Seconds before pausing exam session due to face absence' },
      ],
    },
    {
      title: 'Identity & Watermarking',
      icon: Eye,
      badge: 'PaddleOCR Engine',
      items: [
        { type: 'toggle', label: 'ID Card OCR Verification', key: 'idCardVerificationEnabled', desc: 'Require students to upload & verify ID card credentials' },
        { type: 'toggle', label: 'Dynamic Tracked Watermark', key: 'watermarkVisible', desc: 'Overlay candidate identity watermark across exam interface' },
      ],
    },
    {
      title: 'VPN & Network Routing',
      icon: Wifi,
      badge: 'WireGuard Tunnel',
      items: [
        { type: 'toggle', label: 'Enforce VPN Connection', key: 'vpnEnforced', desc: 'Require active WireGuard VPN tunnel prior to exam lobby entrance' },
      ],
    },
    {
      title: 'Proctoring & Machine Audits',
      icon: Shield,
      badge: 'Proctor Shield',
      items: [
        { type: 'toggle', label: 'Virtual Machine Detection', key: 'vmDetectionEnabled', desc: 'Block access from virtualized hypervisors and WebGL software renderers' },
        { type: 'toggle', label: 'Collusion Pattern Engine', key: 'collusionDetectionEnabled', desc: 'Detect suspicious submission pattern similarities between candidates' },
        { type: 'slider', label: 'Collusion Similarity Threshold', key: 'collusionThreshold', min: 70, max: 100, unit: '%', desc: 'Answer similarity percentage that flags collusion reports' },
      ],
    },
  ]

  return (
    <DashboardLayout title="Platform Settings">
      <div className="flex flex-col gap-6 py-2 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              Platform Security Settings
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure global proctoring thresholds, biometric rules, and AI verification features
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="text-xs font-mono font-bold px-5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-44 bg-[#141416] border border-[#27272A] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map(({ title, icon: Icon, badge, items }) => (
              <Card key={title} className="bg-[#141416] border-[#27272A] shadow-xl">
                <CardHeader className="pb-3 border-b border-[#27272A]/80 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Icon size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-100">{title}</CardTitle>
                      <CardDescription className="text-[11px] text-slate-400">Configure parameters for {title.toLowerCase()}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-slate-400 border-[#27272A] bg-[#09090B]">
                    {badge}
                  </Badge>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {items.map((item) => (
                    <div key={item.key}>
                      {item.type === 'toggle' ? (
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] hover:border-[#3F3F46] transition">
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                          </div>
                          <Switch
                            checked={!!settings[item.key]}
                            onCheckedChange={setKey(item.key)}
                          />
                        </div>
                      ) : (
                        <SliderInput
                          label={item.label}
                          value={settings[item.key]}
                          min={item.min}
                          max={item.max}
                          unit={item.unit}
                          desc={item.desc}
                          onChange={setKey(item.key)}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* Bottom Sticky Action Banner */}
            <div className="p-4 rounded-2xl bg-[#141416] border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2.5 text-xs text-indigo-300">
                <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                <span>Security configuration changes take effect immediately across all active and scheduled exam lobbies.</span>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? 'Saving...' : 'Apply All Security Policies'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
