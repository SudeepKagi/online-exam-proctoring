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
    if (!formData.password || formData.password.length < 8) {
      setGlobalError('New permanent password must be at least 8 characters long.')
      return
    }
    setSubmitting(true)
    setGlobalError('')

    try {
      const payload = {
        newPassword: formData.password,
        password: formData.password,
        fullName: formData.fullName || user?.fullName,
        institutionId: formData.institutionId,
        department: formData.department,
        semester: formData.semester,
        designation: formData.designation,
        phone: formData.phone,
        referencePhotoKey: formData.referencePhotoKey,
        idCardPhotoKey: idCardKey,
        profileMetadata: {
          department: formData.department,
          semester: formData.semester,
          designation: formData.designation,
          phone: formData.phone
        }
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
    <div className="min-h-screen bg-[#fbfcfd] text-[#28253b] flex flex-col justify-between font-sans">
      {/* Mercury Light Framing Nav Bar: 72px */}
      <header className="h-[72px] bg-white border-b border-[#e9eaf2] px-6 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#5266eb] text-white flex items-center justify-center font-[480] text-sm shadow-xs">P</div>
          <span className="font-[480] text-[#28253b] text-base tracking-wide">ProctorNet Onboarding</span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-[420] text-[#554e7b] hover:text-[#28253b] px-3.5 py-1.5 rounded-full bg-[#fbfbff] border border-[#e9eaf2] flex items-center gap-1.5 cursor-pointer transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </header>

      <div className="w-full max-w-2xl mx-auto my-auto py-8 px-4">
        <Card className="border-[#e9eaf2] bg-white rounded-xl shadow-[0_1px_3px_rgba(40,37,59,0.04)] overflow-hidden">
          <CardHeader className="border-b border-[#e9eaf2] bg-[#fbfbff] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-[480] text-[#28253b]">
                  {isStudent ? 'Student Identity Verification' : 'Faculty Profile Setup'}
                </CardTitle>
                <CardDescription className="text-xs text-[#554e7b] mt-0.5 font-[360]">
                  Step {step} of {totalSteps}: {
                    step === 1 ? (isStudent ? 'Academic Information & Password' : 'Faculty Details & Password') :
                    step === 2 && isStudent ? 'Reference Photo Verification' : 'Official ID Card Document'
                  }
                </CardDescription>
              </div>

              {/* Mercury Step Indicator */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all ${
                      step === i + 1 ? 'w-6 bg-[#5266eb]' : (step > i + 1 ? 'w-2 bg-emerald-500' : 'w-2 bg-[#edecfb]')
                    }`}
                  />
                ))}
              </div>
            </div>

            {user?.status === 'REJECTED' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 font-[420]">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <span className="font-[480]">Previous Submission Rejected: </span>
                  <span>{rejectionReason && rejectionReason !== 'null' && rejectionReason !== 'undefined' ? rejectionReason : 'Please provide clearer photos and verify your details.'}</span>
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

      {/* Mercury Light Footer */}
      <footer className="bg-white text-[#554e7b] border-t border-[#e9eaf2] px-6 sm:px-8 py-3.5 text-xs flex items-center justify-between font-[360]">
        <span className="text-[#28253b] font-[480]">ProctorNet Identity Assurance</span>
        <span className="text-[11px] text-[#554e7b]">Institutional Student Identity Verification</span>
      </footer>
    </div>
  )
}
