import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
import { ArrowRight, GraduationCap } from 'lucide-react'

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Science and Engineering',
  'Electronics & Communication Engineering',
  'Artificial Intelligence & Data Science',
  'Mechanical Engineering',
  'Civil Engineering'
]

export default function StudentAcademicStep({ initialData, onNext }) {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    institutionId: initialData?.institutionId || '',
    department: initialData?.department || DEPARTMENTS[0],
    semester: initialData?.semester || '6',
    phone: initialData?.phone || ''
  })
  const [error, setError] = useState('')

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }))
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.password || formData.password.length < 8) {
      setError('Permanent password must be at least 8 characters long.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!formData.institutionId.trim()) {
      setError('University Roll Number (USN) is required.')
      return
    }
    if (!formData.phone.trim()) {
      setError('Contact phone number is required.')
      return
    }
    onNext(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      <div className="bg-[#edecfb] rounded-xl p-3 text-xs text-[#28253b] flex items-start gap-2.5 border-0">
        <GraduationCap className="w-4 h-4 shrink-0 text-[#5266eb] mt-0.5" />
        <span>Configure your permanent account password and verify your institutional student records.</span>
      </div>

      {error && (
        <div className="p-3 bg-[#edecfb] text-xs text-[#28253b] rounded-xl font-[420] border-0">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Permanent Password" required>
          <PasswordInput
            showStrength
            required
            placeholder="Min 8 characters"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </FormField>

        <FormField label="Confirm Password" required>
          <PasswordInput
            required
            placeholder="Repeat password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Roll Number / USN" required hint="Your official university registration number">
          <Input
            type="text"
            required
            placeholder="e.g., 1BM22CS104"
            value={formData.institutionId}
            onChange={(e) => handleChange('institutionId', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl uppercase font-mono tracking-wider"
          />
        </FormField>

        <FormField label="Contact Phone Number" required>
          <Input
            type="tel"
            required
            placeholder="+91 98765 43210"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <FormField label="Department" required>
            <Select value={formData.department} onValueChange={(val) => handleChange('department', val)}>
              <SelectTrigger className="h-10 text-xs border-slate-300 rounded-xl">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div>
          <FormField label="Semester" required>
            <Select value={formData.semester} onValueChange={(val) => handleChange('semester', val)}>
              <SelectTrigger className="h-10 text-xs border-slate-300 rounded-xl">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <SelectItem key={s} value={String(s)} className="text-xs">{`Semester ${s}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button
          type="submit"
          className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer"
        >
          Proceed to Face Verification <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  )
}
