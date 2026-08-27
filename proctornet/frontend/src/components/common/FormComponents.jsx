/**
 * FormComponents — Shared form primitives styled for the Stitch light SaaS theme.
 * FormInput, SubmitButton, Alert
 */
import { useState } from 'react'

function Icon({ name, size = 20 }) {
  return (
    <span
      style={{
        fontFamily: "'Material Symbols Outlined'",
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        fontSize: size,
        lineHeight: 1,
        userSelect: 'none',
        display: 'inline-block',
      }}
    >
      {name}
    </span>
  )
}

/* ── Text / Email / Password Input ── */
export function FormInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  disabled,
  prefixIcon,
  hint,
}) {
  const [showPw, setShowPw] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPw ? 'text' : 'password') : type

  return (
    <div style={{ marginBottom: '1.125rem' }}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {prefixIcon && (
          <div style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--outline)', pointerEvents: 'none',
          }}>
            <Icon name={prefixIcon} size={18} />
          </div>
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="input-field"
          style={{
            paddingLeft: prefixIcon ? '2.5rem' : undefined,
            paddingRight: isPassword ? '2.75rem' : undefined,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--outline)',
              display: 'flex', alignItems: 'center',
            }}
            tabIndex={-1}
          >
            <Icon name={showPw ? 'visibility' : 'visibility_off'} size={18} />
          </button>
        )}
      </div>
      {hint && (
        <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.375rem' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

/* ── Submit Button ── */
export function SubmitButton({ children, loading, disabled, variant = 'primary', style: extraStyle = {} }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`btn-${variant}`}
      style={{ width: '100%', marginTop: '1rem', padding: '0.75rem 1rem', fontSize: '0.9375rem', borderRadius: '12px', ...extraStyle }}
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
          Loading…
        </>
      ) : children}
    </button>
  )
}

/* ── Alert / Error Banner ── */
export function Alert({ type = 'danger', message }) {
  if (!message) return null
  const alertStyles = {
    danger: 'bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c]',
    success: 'bg-[#ecfdf5] border border-[#bbf7d0] text-[#166534]',
    info: 'bg-[#eff6ff] border border-[#d5e6fb] text-[#1c4d8e]',
  }
  const currentStyle = alertStyles[type] || alertStyles.info

  return (
    <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 mb-4 ${currentStyle}`}>
      <Icon name={type === 'danger' ? 'error' : type === 'success' ? 'check_circle' : 'info'} size={18} />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

/* ── InfoBox ── */
export function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-3 p-3.5 bg-[#eff6ff] border border-[#d5e6fb] rounded-xl mb-4 text-[#1c4d8e]">
      <Icon name="info" size={18} className="text-[#2f80ed] shrink-0 mt-0.5" />
      <div className="text-xs font-medium leading-relaxed text-[#1c4d8e]">
        {children}
      </div>
    </div>
  )
}

/* ── Select field ── */
export function FormSelect({ id, label, value, onChange, options = [], required, disabled }) {
  return (
    <div style={{ marginBottom: '1.125rem' }}>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="input-field"
        style={{ cursor: 'pointer', appearance: 'auto' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

/* ── Textarea ── */
export function FormTextarea({ id, label, value, onChange, placeholder, rows = 4, required }) {
  return (
    <div style={{ marginBottom: '1.125rem' }}>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="input-field"
        style={{ resize: 'vertical', minHeight: '6rem' }}
      />
    </div>
  )
}

/* ── SelectInput — backward-compat alias for FormSelect ── */
export function SelectInput({ id, label, value, onChange, options = [], required, disabled, children }) {
  return (
    <div style={{ marginBottom: '1.125rem' }}>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="input-field"
        style={{ cursor: 'pointer', appearance: 'auto' }}
      >
        {children || options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
