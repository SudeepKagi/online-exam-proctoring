import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api, errorMessage } from '@/lib/apiClient'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import StudentAcademicStep from '@/components/onboarding/StudentAcademicStep'
import FacultyDetailsStep from '@/components/onboarding/FacultyDetailsStep'
import WebcamCaptureStep from '@/components/onboarding/WebcamCaptureStep'
import IdCardUploadStep from '@/components/onboarding/IdCardUploadStep'
import { Shield, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react'

export default function OnboardingPage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const isStudent = user?.role !== 'FACULTY'
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const [formData, setFormData] = useState({
    password: '',
    institutionId: user?.institutionId || '',
    department: user?.profileMetadata?.department || '',
    semester: user?.profileMetadata?.semester || '',
    designation: user?.profileMetadata?.designation || '',
    phone: user?.profileMetadata?.phone || '',
    referencePhotoKey: user?.referencePhotoKey || null,
    idCardPhotoKey: user?.idCardPhotoKey || null
  })
  const [livePreview, setLivePreview] = useState(null)

  const rejectionReason = user?.profileMetadata?.rejectionReason

  const handleStep1Submit = (data) => {
    setFormData(prev => ({
      ...prev,
      password: data.password,
      institutionId: data.institutionId,
      department: data.department,
      semester: data.semester || prev.semester,
      designation: data.designation || prev.designation,
      phone: data.phone
    }))
    setStep(2)
  }

  const handleWebcamSubmit = (photoKey, previewUrl) => {
    setFormData(prev => ({ ...prev, referencePhotoKey: photoKey }))
    setLivePreview(previewUrl)
    setStep(3)
  }

  const handleFinalSubmit = async (idCardKey) => {
    setSubmitting(true)
    setGlobalError('')

    try {
      const payload = {
        password: formData.password,
        institutionId: formData.institutionId,
        department: formData.department,
        semester: formData.semester,
        designation: formData.designation,
        phone: formData.phone,
        referencePhotoKey: formData.referencePhotoKey,
        idCardPhotoKey: idCardKey
      }

      const res = await api.post('/auth/onboarding', payload)
      if (res.data?.user) {
        updateUser(res.data.user)
      }
      navigate('/pending-approval')
    } catch (err) {
      setGlobalError(errorMessage(err, 'Failed to submit onboarding profile.'))
    } finally {
      setSubmitting(false)
    }
  }

  const totalSteps = isStudent ? 3 : 2

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="w-full max-w-2xl mx-auto pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-bold text-slate-900 text-sm">ProctorNet Onboarding</span>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto my-auto py-6">
        <Card className="border-slate-200 shadow-md bg-white rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900">
                  {isStudent ? 'Student Identity Verification' : 'Faculty Profile Setup'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Step {step} of {totalSteps}: {
                    step === 1 ? (isStudent ? 'Academic Information & Password' : 'Faculty Details & Password') :
                    step === 2 && isStudent ? 'Webcam Face Reference' : 'College ID Card Photo'
                  }
                </CardDescription>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all ${
                      step === i + 1 ? 'w-6 bg-blue-600' : (step > i + 1 ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-200')
                    }`}
                  />
                ))}
              </div>
            </div>

            {user?.status === 'REJECTED' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <span className="font-bold">Previous Submission Rejected: </span>
                  <span>{rejectionReason || 'Please provide clearer photos and verify your details.'}</span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
                {globalError}
              </div>
            )}

            {step === 1 && (
              isStudent ? (
                <StudentAcademicStep initialData={formData} onNext={handleStep1Submit} />
              ) : (
                <FacultyDetailsStep initialData={formData} onNext={handleStep1Submit} />
              )
            )}

            {step === 2 && isStudent && (
              <WebcamCaptureStep
                initialPreview={livePreview}
                onNext={handleWebcamSubmit}
                onBack={() => setStep(1)}
              />
            )}

            {((step === 3 && isStudent) || (step === 2 && !isStudent)) && (
              <IdCardUploadStep
                onBack={() => setStep(step - 1)}
                onSubmit={handleFinalSubmit}
                submitting={submitting}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-slate-400 pb-2">
        Institutional Identity Verification Powered by AWS Rekognition
      </div>
    </div>
  )
}
