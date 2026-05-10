import React, { useState } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, SubmitButton, Alert } from '@/components/common/FormComponents'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/faculty', icon: 'groups', label: 'Faculty Approval' },
  { to: '/admin/students', icon: 'school', label: 'Students' },
  { to: '/admin/exams', icon: 'assignment', label: 'Active Exams' },
  { to: '/admin/violations', icon: 'warning', label: 'Violations' },
  { to: '/admin/settings', icon: 'settings', label: 'Settings' },
]

export default function AdminSettings() {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 1000)
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Settings</h1>
          <p className="page-subtitle">Configure global security thresholds and system preferences.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Main Settings Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Security & Proctoring</h3>
          </div>
          <div className="card-body">
            {saved && <Alert type="success" message="Settings saved successfully." />}
            
            <form onSubmit={handleSave}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                Identity Verification
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <FormInput 
                  id="face-match-threshold" label="Face Match Threshold (%)" type="number" defaultValue="85"
                  required
                />
                <SelectInput
                  id="id-verification" label="ID Card Verification" defaultValue="auto"
                  options={[
                    { value: 'auto', label: 'Automated (OCR + Face Match)' },
                    { value: 'manual', label: 'Manual Review Required' },
                    { value: 'hybrid', label: 'Hybrid (Manual on Low Confidence)' },
                  ]} required
                />
              </div>

              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                VPN Infrastructure
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <SelectInput
                  id="vpn-mode" label="VPN Enforcement" defaultValue="strict"
                  options={[
                    { value: 'strict', label: 'Strict (Drop connection if disconnected)' },
                    { value: 'lenient', label: 'Lenient (Log disconnections)' },
                    { value: 'disabled', label: 'Disabled (Not recommended)' },
                  ]} required
                />
                <FormInput 
                  id="vpn-server" label="Primary OpenVPN Server" defaultValue="vpn-01.proctornet.local"
                  required
                />
              </div>

              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                System Behavior
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormInput 
                  id="session-timeout" label="Idle Session Timeout (mins)" type="number" defaultValue="30"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--outline-variant)', paddingTop: '1.5rem' }}>
                <SubmitButton loading={loading} style={{ width: 'auto', marginTop: 0 }}>
                  <Icon name="save" /> Save Settings
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>

        {/* Action Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">System Actions</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ justifyContent: 'flex-start', color: 'var(--on-surface)' }}>
                <Icon name="vpn_key" /> Regenerate VPN Certificates
              </button>
              <button className="btn-secondary" style={{ justifyContent: 'flex-start', color: 'var(--on-surface)' }}>
                <Icon name="sync" /> Sync External Database
              </button>
              <button className="btn-secondary" style={{ justifyContent: 'flex-start', color: 'var(--error)', borderColor: 'var(--error-container)' }}>
                <Icon name="delete_forever" /> Clear Session Logs
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">System Info</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Version</span>
                  <span style={{ fontWeight: 600 }}>v2.4.0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Environment</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Production</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Last Update</span>
                  <span style={{ fontWeight: 600 }}>2 hours ago</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  )
}
