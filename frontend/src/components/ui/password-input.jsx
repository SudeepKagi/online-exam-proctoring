import React, { useState, useId } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

export function calculatePasswordStrength(pass) {
  if (!pass) return { score: 0, label: '', color: 'bg-slate-200' }
  let score = 0
  if (pass.length >= 8) score += 1
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1
  if (/\d/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1

  switch (score) {
    case 1:
      return { score: 1, label: 'Weak', barColor: 'bg-rose-500', textColor: 'text-rose-600' }
    case 2:
      return { score: 2, label: 'Fair', barColor: 'bg-amber-500', textColor: 'text-amber-600' }
    case 3:
      return { score: 3, label: 'Good', barColor: 'bg-blue-600', textColor: 'text-blue-600' }
    case 4:
      return { score: 4, label: 'Strong', barColor: 'bg-emerald-600', textColor: 'text-emerald-600' }
    default:
      return { score: 0, label: 'Very Weak', barColor: 'bg-rose-400', textColor: 'text-rose-500' }
  }
}

export function PasswordInput({
  id,
  value = '',
  onChange,
  placeholder = '••••••••••••',
  showStrength = false,
  autoComplete = 'current-password',
  disabled = false,
  required = false,
  className = '',
  name,
  ...props
}) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id || generatedId

  const strength = calculatePasswordStrength(value)

  return (
    <div className="w-full space-y-1.5 font-sans">
      <div className="relative flex items-center">
        <div className="absolute left-3 text-[#70707d] pointer-events-none flex items-center">
          <Lock className="w-4 h-4" />
        </div>

        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full h-10 pl-9 pr-10 text-xs text-[#28253b] font-[420] bg-white border border-[#c3c3cc]/60 rounded-xl transition-colors placeholder:text-[#70707d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5266eb]/20 focus-visible:border-[#5266eb] disabled:opacity-50 disabled:bg-[#fbfbff] ${className}`}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 p-1 text-[#70707d] hover:text-[#28253b] rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#5266eb] cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {showStrength && value && (
        <div className="pt-1 space-y-1" aria-live="polite">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step <= strength.score ? strength.barColor : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Security Strength</span>
            <span className={`font-bold ${strength.textColor}`}>{strength.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PasswordInput
