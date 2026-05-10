import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Camera, Lock, Key, AlertCircle, ArrowRight } from 'lucide-react'
import api from '@/utils/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

export default function InvigilatorLogin() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  
  const [formData, setFormData] = useState({
    examId: '',
    invId: '',
    invPassword: '',
    idCardFile: null
  })
  const [idCardPreview, setIdCardPreview] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if(!file) return
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setIdCardPreview(reader.result)
      setFormData({ ...formData, idCardFile: reader.result })
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if(!formData.examId || !formData.invId || !formData.invPassword) {
      setError('All fields are required')
      return
    }

    if(!formData.idCardFile) {
      setError('Please upload your Faculty/Invigilator ID card for verification')
      return
    }
    
    setIsVerifying(true)
    setError('')
    
    try {
      const res = await api.post('/auth/invigilator/login', {
        examId: formData.examId,
        invId: formData.invId,
        invPassword: formData.invPassword,
        idCardPhoto: formData.idCardFile
      })
      
      // Store session in AuthContext (mock user for invigilator)
      const invUser = {
        id: res.data.session.id,
        name: `Invigilator (${res.data.session.invId})`,
        role: 'invigilator',
        examId: formData.examId
      }
      
      // We use the same login logic from context but with specific role
      // Wait, the context 'login' expects credentials and role.
      // But we already have the token.
      
      localStorage.setItem('proctornet_token', res.data.token)
      localStorage.setItem('proctornet_user', JSON.stringify(invUser))
      localStorage.setItem('proctornet_role', 'invigilator')
      localStorage.setItem('inv_examId', formData.examId)
      
      // Dispatch to state via a modified login or manual storage
      window.location.href = `/invigilator/exam/${formData.examId}`
      toast.success('Identity verified! Accessing dashboard...')
      
    } catch(err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Verification failed. Check credentials.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Left: Branding & Info */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-400 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-400 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                <Shield size={24} className="text-blue-300" />
              </div>
              <span className="text-xl font-black tracking-tight italic">ProctorNet</span>
            </div>
            
            <h1 className="text-4xl font-bold leading-tight mb-6">Exam <br/><span className="text-blue-400">Security Access</span></h1>
            <p className="text-blue-100/70 text-lg leading-relaxed mb-8">
              Welcome to the Secure Monitoring Terminal. Authenticate with the unique session ID and credentials provided by the department.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-blue-200">
                <Lock size={16} /> <span>Encrypted Session Management</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-blue-200">
                <Camera size={16} /> <span>Identity Proofing Required</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-12 border-t border-white/10 text-xs text-blue-300/50">
            &copy; 2026 ProctorNet Security Systems. All Rights Reserved.
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="p-12">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Terminal Access</h2>
            <p className="text-gray-500 text-sm font-medium">Please enter the examination credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm animate-shake">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest transition-all group-focus-within:text-blue-600">Exam Session ID</label>
                <div className="flex items-center px-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:bg-white transition-all">
                  <Key size={18} className="text-gray-400 mr-3" />
                  <input 
                    type="text" 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-gray-900 placeholder:text-gray-300"
                    placeholder="Enter Exam UUID"
                    value={formData.examId}
                    onChange={(e) => setFormData({...formData, examId: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest transition-all group-focus-within:text-blue-600">Invigilator ID</label>
                  <div className="flex items-center px-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:bg-white transition-all">
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-gray-900"
                      value={formData.invId}
                      onChange={(e) => setFormData({...formData, invId: e.target.value})}
                    />
                  </div>
                </div>
                <div className="relative group">
                  <label className="absolute -top-2 left-4 px-1 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest transition-all group-focus-within:text-blue-600">Session Pass</label>
                  <div className="flex items-center px-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-blue-300 focus-within:bg-white transition-all">
                    <input 
                      type="password" 
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-gray-900"
                      value={formData.invPassword}
                      onChange={(e) => setFormData({...formData, invPassword: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700 ml-1">Identity Verification</label>
                <div className="relative border-2 border-dashed border-gray-200 rounded-3xl p-6 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-center cursor-pointer overflow-hidden group">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  
                  {idCardPreview ? (
                    <div className="relative inline-block">
                      <img src={idCardPreview} alt="Preview" className="h-32 w-auto rounded-xl object-cover shadow-lg border border-gray-100" />
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-bold uppercase">Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:scale-110 group-hover:text-blue-500 transition-all">
                        <Camera size={24} />
                      </div>
                      <p className="text-xs font-bold text-gray-400 group-hover:text-blue-600 uppercase tracking-widest">Capture/Upload Faculty ID</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 group"
            >
              {isVerifying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying Identity...
                </>
              ) : (
                <>
                  Establish Connection
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
