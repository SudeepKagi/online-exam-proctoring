import React from 'react'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'

export function FormField({
  label,
  htmlFor,
  required = false,
  action,
  description,
  error,
  children,
  className = ''
}) {
  return (
    <div className={`space-y-1.5 font-sans ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={htmlFor} className="text-xs font-[420] text-[#28253b] flex items-center">
            {label}
            {required && <span className="text-[#5266eb] ml-0.5" aria-hidden="true">*</span>}
          </Label>
          {action && (
            <div className="text-xs font-[420] text-[#5266eb] hover:text-[#4353c7]">
              {action}
            </div>
          )}
        </div>
      )}

      {children}

      {description && !error && (
        <p className="text-xs text-[#554e7b] leading-normal font-[360]">
          {description}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs font-[420] text-[#554e7b] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#5266eb]" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export default FormField
