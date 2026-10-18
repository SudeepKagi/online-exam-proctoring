import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, Building2 } from 'lucide-react'

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Science and Engineering',
  'Electronics and Communication Engineering',
  'Mechanical Engineering',
  'Electrical and Electronics Engineering',
  'Civil Engineering',
  'Artificial Intelligence & Data Science'
]

const DESIGNATIONS = [
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Head of Department (HoD)',
  'Senior Lecturer',
  'Visiting Faculty'
]

export default function FacultyDetailsStep({ initialData, onNext }) {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    institutionId: initialData?.institutionId || '',
    department: initialData?.department || DEPARTMENTS[0],
    designation: initialData?.designation || DESIGNATIONS[0],
    phone: initialData?.phone || ''
  })
  const [error, setError] = useState('')

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }))
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.password || formData.password.length < 6) {
      setError('Permanent password must be at least 6 characters long.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!formData.institutionId.trim()) {
      setError('Employee ID / Faculty Code is required.')
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
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2.5">
        <Building2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
        <span>Configure your permanent credentials and institutional faculty profile details.</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Permanent Password</Label>
          <Input
            type="password"
            required
            placeholder="Min 6 characters"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Confirm Password</Label>
          <Input
            type="password"
            required
            placeholder="Repeat password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Faculty Employee ID</Label>
          <Input
            type="text"
            required
            placeholder="e.g. EMP-9821"
            value={formData.institutionId}
            onChange={(e) => handleChange('institutionId', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl uppercase"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Contact Phone Number</Label>
          <Input
            type="tel"
            required
            placeholder="+91 98765 43210"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="h-10 text-xs border-slate-300 rounded-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Department</Label>
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
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Designation</Label>
          <Select value={formData.designation} onValueChange={(val) => handleChange('designation', val)}>
            <SelectTrigger className="h-10 text-xs border-slate-300 rounded-xl">
              <SelectValue placeholder="Select Designation" />
            </SelectTrigger>
            <SelectContent>
              {DESIGNATIONS.map(d => (
                <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button
          type="submit"
          className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
        >
          Proceed to College ID Upload <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  )
}
