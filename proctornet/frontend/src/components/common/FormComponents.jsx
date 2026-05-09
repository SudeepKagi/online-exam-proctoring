import { useState } from 'react'

/**
 * FormInput — styled input for all auth forms
 */
export function FormInput({
  label, id, type = 'text', value, onChange, placeholder,
  error, required = false, autoComplete, hint,
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword && show ? 'text' : type

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <label htmlFor={id} style={{
          display: 'block',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          marginBottom: '0.375rem',
          letterSpacing: '0.02em',
        }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: '100%',
            background: 'var(--color-bg-elevated)',
            border: `1px solid ${error ? '#ef4444' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: isPassword ? '0.625rem 2.75rem 0.625rem 0.875rem' : '0.625rem 0.875rem',
            fontSize: '0.9375rem',
            color: 'var(--color-text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }}
          onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '1rem',
              padding: 0,
            }}
          >
            {show ? '🙈' : '👁️'}
          </button>
        )}
      </div>
      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>⚠ {error}</p>
      )}
      {hint && !error && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{hint}</p>
      )}
    </div>
  )
}

/**
 * SelectInput — styled select dropdown
 */
export function SelectInput({ label, id, value, onChange, options, error, required }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <label htmlFor={id} style={{
          display: 'block', fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--color-text-secondary)', marginBottom: '0.375rem',
        }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <select
        id={id} value={value} onChange={onChange}
        style={{
          width: '100%',
          background: 'var(--color-bg-elevated)',
          border: `1px solid ${error ? '#ef4444' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.875rem',
          fontSize: '0.9375rem',
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>⚠ {error}</p>
      )}
    </div>
  )
}

/**
 * SubmitButton — loading-aware primary button
 */
export function SubmitButton({ loading, children, disabled, style }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="btn-primary"
      style={{
        width: '100%',
        padding: '0.75rem',
        fontSize: '0.9375rem',
        fontWeight: 700,
        opacity: loading || disabled ? 0.7 : 1,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        ...style,
      }}
    >
      {loading && <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />}
      {children}
    </button>
  )
}

/**
 * Alert — success / error banner
 */
export function Alert({ type = 'error', message }) {
  if (!message) return null
  const styles = {
    error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   icon: '⚠️', color: '#fca5a5' },
    success: { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  icon: '✅', color: '#6ee7b7' },
    info:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  icon: 'ℹ️', color: '#93c5fd' },
    warning: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', icon: '⚡', color: '#fde68a' },
  }
  const s = styles[type] || styles.error
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      fontSize: '0.875rem',
      color: s.color,
      lineHeight: 1.5,
    }}>
      <span style={{ flexShrink: 0 }}>{s.icon}</span>
      <span>{message}</span>
    </div>
  )
}
