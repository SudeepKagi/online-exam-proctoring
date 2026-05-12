import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Save, RefreshCw, Shield, Camera, Wifi, Eye, Cpu, AlertTriangle, CheckCircle } from 'lucide-react'

function ToggleSwitch({ checked, onChange, id }) {
  return (
    <button id={id} type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function SliderInput({ label, value, min, max, step = 1, unit, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}{unit}</span><span>{max}{unit}</span>
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
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const set = (key) => (val) => setSettings(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/admin/settings', settings)
      toast.success('Settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally { setSaving(false) }
  }

  const sections = [
    {
      title: 'Face Verification',
      icon: Camera,
      color: 'bg-purple-50 text-purple-600',
      items: [
        { type: 'toggle', label: 'Enable Face Verification', key: 'faceVerificationEnabled', desc: 'Continuously verify student identity via camera' },
        { type: 'slider', label: 'Face Match Threshold', key: 'faceMatchThreshold', min: 70, max: 100, unit: '%', desc: 'Minimum confidence score required to pass face check' },
        { type: 'slider', label: 'Re-verify Interval', key: 'reverifyIntervalMins', min: 5, max: 30, unit: ' min', desc: 'How often to re-run face verification during exam' },
        { type: 'slider', label: 'Face Absence Warning', key: 'faceAbsenceWarnSecs', min: 5, max: 30, unit: 's', desc: 'Seconds before showing warning when no face detected' },
        { type: 'slider', label: 'Face Absence Pause', key: 'faceAbsencePauseSecs', min: 10, max: 60, unit: 's', desc: 'Seconds before pausing exam when no face detected' },
      ]
    },
    {
      title: 'Identity Verification',
      icon: Eye,
      color: 'bg-blue-50 text-blue-600',
      items: [
        { type: 'toggle', label: 'ID Card Verification', key: 'idCardVerificationEnabled', desc: 'Require students to show ID card before exam' },
        { type: 'toggle', label: 'Visible Watermark', key: 'watermarkVisible', desc: 'Show student USN watermark across exam screen' },
      ]
    },
    {
      title: 'VPN & Network',
      icon: Wifi,
      color: 'bg-green-50 text-green-600',
      items: [
        { type: 'toggle', label: 'Enforce VPN Connection', key: 'vpnEnforced', desc: 'Require WireGuard VPN before allowing exam access' },
      ]
    },
    {
      title: 'Security Detection',
      icon: Shield,
      color: 'bg-red-50 text-red-600',
      items: [
        { type: 'toggle', label: 'VM Detection', key: 'vmDetectionEnabled', desc: 'Block students running virtual machines' },
        { type: 'toggle', label: 'Collusion Detection', key: 'collusionDetectionEnabled', desc: 'Detect suspicious answer pattern similarities' },
        { type: 'slider', label: 'Collusion Threshold', key: 'collusionThreshold', min: 70, max: 100, unit: '%', desc: 'Similarity score above which answers are flagged' },
      ]
    }
  ]

  return (
    <DashboardLayout title="Platform Settings">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure proctoring rules, thresholds, and security features</p>
        </div>
        <button onClick={handleSave} disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Save size={15} />Save Settings</>}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(({ title, icon: Icon, color, items }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={18} />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              </div>
              <div className="p-6 space-y-6">
                {items.map(item => (
                  <div key={item.key} className={`${item.type === 'slider' ? 'border border-gray-100 rounded-xl p-4' : 'flex items-start justify-between gap-4'}`}>
                    {item.type === 'toggle' ? (
                      <>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <ToggleSwitch checked={settings[item.key]} onChange={set(item.key)} />
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-3">{item.desc}</p>
                        <SliderInput
                          label={item.label}
                          value={settings[item.key]}
                          min={item.min}
                          max={item.max}
                          unit={item.unit}
                          onChange={set(item.key)}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save bar */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle size={16} />
              <span>Changes are applied to all future exam sessions</span>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save All Settings'}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
