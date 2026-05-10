import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, FormTextarea, SubmitButton, Alert, InfoBox } from '@/components/common/FormComponents'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { Save, ArrowLeft, Shield, Clock, Users, CheckCircle } from 'lucide-react'

const DEPARTMENTS = ['CS', 'ECE', 'ME', 'CV', 'IS', 'EE']
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function CreateExam() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    startTime: '',
    endTime: '',
    duration: 90,
    totalMarks: 100,
    questionsPerStudent: 0, // 0 for all
    negativeMarking: false,
    negativeValue: 0.25,
    randomiseQuestions: true,
    randomiseOptions: true,
    allowedDepartments: [],
    allowedSemesters: [],
    cameraRequired: true,
    micRequired: false,
    browserLock: true,
    fullScreenMode: true,
    watermarkRequired: true,
    tabSwitchLimit: 3
  })

  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    if(!formData.title.trim()) newErrors.title = 'Exam title is required'
    if(!formData.subject.trim()) newErrors.subject = 'Subject is required'
    if(!formData.startTime) newErrors.startTime = 'Start time is required'
    if(!formData.endTime) newErrors.endTime = 'End time is required'
    if(new Date(formData.startTime) >= new Date(formData.endTime))
      newErrors.endTime = 'End time must be after start'
    if(formData.duration < 10) newErrors.duration = 'Minimum 10 minutes'
    if(formData.totalMarks < 1) newErrors.totalMarks = 'Must have marks'
    if(formData.allowedDepartments.length === 0)
      newErrors.allowedDepartments = 'Select at least one department'
    if(formData.allowedSemesters.length === 0)
      newErrors.allowedSemesters = 'Select at least one semester'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const toggleSelection = (field, value) => {
    const current = formData[field]
    const updated = current.includes(value)
      ? current.filter(i => i !== value)
      : [...current, value]
    handleChange(field, updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(!validate()) {
      toast.error('Please fix the errors before submitting')
      return
    }
    
    setIsSubmitting(true)
    try {
      // Map 'duration' to 'durationMinutes' if backend expects it, 
      // but my backend fix used 'duration'. 
      // I'll stick to 'duration' as per schema.
      const res = await api.post('/faculty/exams', formData)
      toast.success('Exam created successfully!')
      setSuccessData(res.data)
    } catch(err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successData) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Created Successfully!</h1>
          <p className="text-gray-600 mb-10">
            The exam "<span className="font-semibold text-gray-800">{successData.exam.title}</span>" is now scheduled. 
            Provide these credentials to the physical invigilator for dashboard access.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-left shadow-inner">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield size={14} /> Invigilator Access Portal
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Invigilator ID</label>
                <div className="text-2xl font-mono font-bold tracking-wider text-gray-900">{successData.invCredentials.invId}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Access Password</label>
                <div className="text-2xl font-mono font-bold tracking-wider text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded inline-block">
                  {successData.invCredentials.password}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-6 py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-all" onClick={() => navigate('/faculty/exams')}>
              View All Exams
            </button>
            <button className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all" onClick={() => navigate(`/faculty/exams/${successData.exam.id}/questions`)}>
              Assign Questions →
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <Link to="/faculty/exams" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-2 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Exams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Examination</h1>
        <p className="text-gray-500 text-sm">Configure security, timing, and eligibility for your assessment.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
              <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><CheckCircle size={18} /></span>
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <FormInput 
                  label="Exam Title" 
                  value={formData.title} 
                  onChange={(e) => handleChange('title', e.target.value)} 
                  placeholder="Midterm - Operating Systems" 
                  error={errors.title}
                />
              </div>
              <div>
                <FormInput 
                  label="Subject Code" 
                  value={formData.subject} 
                  onChange={(e) => handleChange('subject', e.target.value)} 
                  placeholder="CS402" 
                  error={errors.subject}
                />
              </div>
            </div>

            <div className="mt-4">
              <FormTextarea 
                label="General Instructions" 
                value={formData.description} 
                onChange={(e) => handleChange('description', e.target.value)} 
                placeholder="Instructions for students (Optional)" 
                rows={3} 
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
              <span className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><Clock size={18} /></span>
              Timing & Scale
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormInput 
                label="Start Time" 
                type="datetime-local" 
                value={formData.startTime} 
                onChange={(e) => handleChange('startTime', e.target.value)} 
                error={errors.startTime}
              />
              <FormInput 
                label="End Time" 
                type="datetime-local" 
                value={formData.endTime} 
                onChange={(e) => handleChange('endTime', e.target.value)} 
                error={errors.endTime}
              />
              <FormInput 
                label="Duration (Minutes)" 
                type="number" 
                value={formData.duration} 
                onChange={(e) => handleChange('duration', Number(e.target.value))} 
                error={errors.duration}
              />
              <FormInput 
                label="Total Marks" 
                type="number" 
                value={formData.totalMarks} 
                onChange={(e) => handleChange('totalMarks', Number(e.target.value))} 
                error={errors.totalMarks}
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
              <span className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Users size={18} /></span>
              Candidate Eligibility
            </h2>
            
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Allowed Departments</label>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleSelection('allowedDepartments', dept)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.allowedDepartments.includes(dept)
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
                {errors.allowedDepartments && <p className="text-red-500 text-xs mt-2">{errors.allowedDepartments}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Target Semesters</label>
                <div className="flex flex-wrap gap-2">
                  {SEMESTERS.map(sem => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => toggleSelection('allowedSemesters', sem)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                        formData.allowedSemesters.includes(sem)
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {sem}
                    </button>
                  ))}
                </div>
                {errors.allowedSemesters && <p className="text-red-500 text-xs mt-2">{errors.allowedSemesters}</p>}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2 border-b pb-4">
              <span className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center"><Shield size={18} /></span>
              Security Profile
            </h2>
            
            <div className="space-y-4">
              {[
                { key: 'cameraRequired', label: 'Face AI Monitoring', desc: 'Continuous camera verification' },
                { key: 'browserLock', label: 'Browser Lockdown', desc: 'Block multi-tab navigation' },
                { key: 'fullScreenMode', label: 'Enforce Fullscreen', desc: 'Exit terminates session' },
                { key: 'watermarkRequired', label: 'Dynamic Watermark', desc: 'Overlay USN on screen' },
                { key: 'randomiseQuestions', label: 'Randomise Pool', desc: 'Unique question order' },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:bg-gray-50 cursor-pointer transition-colors group">
                  <div className="mt-1">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      checked={formData[item.key]} 
                      onChange={(e) => handleChange(item.key, e.target.checked)}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </label>
              ))}

              <div className="pt-4 mt-4 border-t">
                <FormInput 
                  label="Tab Switch Limit" 
                  type="number" 
                  value={formData.tabSwitchLimit} 
                  onChange={(e) => handleChange('tabSwitchLimit', Number(e.target.value))} 
                />
              </div>
            </div>
          </section>

          <div className="sticky top-8 space-y-4">
            <InfoBox>
              You can add MCQs, Code, and Subjective questions after creating the exam shell.
            </InfoBox>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Finalizing Exam...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Deploy Examination
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
