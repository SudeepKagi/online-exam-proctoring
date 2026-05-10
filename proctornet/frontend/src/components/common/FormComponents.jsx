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
      style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '0.9375rem', ...extraStyle }}
    >
      {loading ? (
        <>
          <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: 2 }} />
          Loading…
        </>
      ) : children}
    </button>
  )
}

/* ── Alert / Error Banner ── */
export function Alert({ type = 'danger', message }) {
  if (!message) return null
  return (
    <div className={`alert-${type}`} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
      <Icon name={type === 'danger' ? 'error' : type === 'success' ? 'check_circle' : 'info'} size={18} />
      <span>{message}</span>
    </div>
  )
}

/* ── InfoBox (like the Stitch "Registration requires admin approval" box) ── */
export function InfoBox({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '0.875rem 1rem',
      background: 'var(--surface-container)',
      border: '1px solid rgba(195,198,215,0.5)',
      borderRadius: 8,
      marginBottom: '1rem',
    }}>
      <Icon name="info" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
        {children}
      </p>
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
