import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import { getExamDetails, startExam } from '@/services/student.api'
import { Alert } from '@/components/common/FormComponents'
import VPNSetup from '@/components/VPNSetup'
// face-api.js will be imported here or in utils

function Icon({ name, size = 20, style = {}, className = "" }) {
  return (
    <span className={`material-icon ${className}`} style={{ fontSize: size, ...style }}>
      {name}
    </span>
  )
}

const STEPS = [
  { id: 'vpn', label: 'VPN Connection', icon: 'security' },
  { id: 'browser', label: 'Browser Check', icon: 'web' },
  { id: 'fullscreen', label: 'Fullscreen', icon: 'fullscreen' },
  { id: 'camera', label: 'Camera Access', icon: 'videocam' },
  { id: 'face', label: 'Face Match', icon: 'face' },
  { id: 'id_card', label: 'ID Verification', icon: 'badge' },
  { id: 'evidence', label: 'Identity Proof', icon: 'camera_alt' },
  { id: 'vm', label: 'VM Detection', icon: 'desktop_windows' },
  { id: 'watermark', label: 'Watermark', icon: 'branding_watermark' },
]

export default function SecurityCheck() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepStatus, setStepStatus] = useState(STEPS.map(() => 'pending')) // pending, active, success, error
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    fetchExam()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [id])

  const fetchExam = async () => {
    try {
      const res = await getExamDetails(id)
      setExam(res.data.exam)
      setLoading(false)
      // Start the sequence
      runStep(0)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initialize security check.')
      setLoading(false)
    }
  }

  const updateStatus = (index, status) => {
    setStepStatus(prev => {
      const next = [...prev]
      next[index] = status
      return next
    })
  }

  const runStep = async (index) => {
    if (index >= STEPS.length) return
    
    setCurrentStepIndex(index)
    updateStatus(index, 'active')

    const stepId = STEPS[index].id
    let success = false

    try {
      switch (stepId) {
        case 'vpn':
          success = await checkVPN()
          if (success === 'wait') return // Wait for VPNSetup component
          break
        case 'browser':
          success = await checkBrowser()
          break
        case 'fullscreen':
          // Requires user interaction
          return 
        case 'camera':
          success = await checkCamera()
          break
        case 'face':
          success = await checkFaceMatch()
          break
        case 'id_card':
          success = await checkIDCard()
          break
        case 'evidence':
          success = await captureEvidence()
          break
        case 'vm':
          success = await checkVM()
          break
        case 'watermark':
          // Final acknowledgement
          return
      }

      if (success) {
        updateStatus(index, 'success')
        setTimeout(() => runStep(index + 1), 1000)
      } else {
        updateStatus(index, 'error')
      }
    } catch (err) {
      console.error(`Step ${stepId} failed:`, err)
      updateStatus(index, 'error')
    }
  }

  // Step Implementations
  const checkVPN = async () => {
    try {
      await startExam(id)
      return 'wait'
    } catch (err) {
      return false
    }
  }

  const checkBrowser = async () => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
    const isEdge = /Edg/.test(navigator.userAgent)
    return (isChrome || isEdge) && !!document.documentElement.requestFullscreen
  }

  const handleFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
      updateStatus(currentStepIndex, 'success')
      runStep(currentStepIndex + 1)
    } catch (err) {
      updateStatus(currentStepIndex, 'error')
    }
  }

  const checkCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      return true
    } catch (err) {
      return false
    }
  }

  const checkFaceMatch = async () => {
    // This will involve face-api.js
    // Simulation for now
    await new Promise(r => setTimeout(r, 2000))
    return true
  }

  const checkIDCard = async () => {
    // This will call the Python OCR
    await new Promise(r => setTimeout(r, 2000))
    return true
  }

  const captureEvidence = async () => {
    await new Promise(r => setTimeout(r, 1000))
    return true
  }

  const checkVM = async () => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return true // can't check
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      const isVM = /SwiftShader|llvmpipe|VirtualBox|VMware|VBOX/i.test(renderer)
      if (isVM) return false
    }
    return true
  }

  const handleFinish = () => {
    navigate(`/student/exam/${id}`)
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-container-low)', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-body" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--on-surface)' }}>Security Checkpoint</h1>
                <p style={{ color: 'var(--on-surface-variant)' }}>Step {currentStepIndex + 1} of {STEPS.length}: {STEPS[currentStepIndex].label}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {Math.round(((currentStepIndex) / STEPS.length) * 100)}%
                </div>
                <div style={{ width: '120px', height: '4px', background: 'var(--outline-variant)', borderRadius: '2px', marginTop: '0.5rem' }}>
                  <div style={{ 
                    width: `${((currentStepIndex) / STEPS.length) * 100}%`, 
                    height: '100%', 
                    background: 'var(--primary)', 
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>
              {/* Step List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {STEPS.map((step, i) => (
                  <div key={step.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: i === currentStepIndex ? 'var(--secondary-container)' : 'transparent',
                    color: i === currentStepIndex ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)',
                    opacity: i > currentStepIndex ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: stepStatus[i] === 'success' ? 'var(--success)' : (i === currentStepIndex ? 'var(--primary)' : 'var(--outline)'),
                      color: '#fff'
                    }}>
                      {stepStatus[i] === 'success' ? <Icon name="check" size={18} /> : <Icon name={step.icon} size={18} />}
                    </div>
                    <span style={{ fontWeight: i === currentStepIndex ? 600 : 400, fontSize: '0.9375rem' }}>{step.label}</span>
                  </div>
                ))}
              </div>

              {/* Active Step Content */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ 
                  aspectRatio: '16/9', 
                  background: '#000', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  position: 'relative',
                  marginBottom: '2rem',
                  boxShadow: 'var(--shadow-2)'
                }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: (currentStepIndex >= 3 && currentStepIndex <= 6) ? 'block' : 'none' }} 
                  />
                  
                  {/* Overlays for different steps */}
                  {currentStepIndex === 0 && (
                    <div style={{ background: '#fff', height: '100%', padding: '2rem', overflowY: 'auto' }}>
                      <VPNSetup 
                        examId={id} 
                        onSuccess={() => {
                          updateStatus(0, 'success')
                          setTimeout(() => runStep(1), 1000)
                        }}
                        onFail={(reason) => {
                          updateStatus(0, 'error')
                          setError(`VPN Check Failed: ${reason}`)
                        }}
                      />
                    </div>
                  )}

                  {currentStepIndex === 2 && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '2rem', textAlign: 'center' }}>
                      <Icon name="fullscreen" size={64} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                      <h3 style={{ marginBottom: '1rem' }}>Enter Fullscreen Mode</h3>
                      <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1.5rem' }}>To ensure a fair environment, the exam must be taken in fullscreen mode.</p>
                      <button className="btn-primary" onClick={handleFullscreen}>Enable Fullscreen</button>
                    </div>
                  )}

                  {currentStepIndex === 5 && (
                    <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', border: '2px dashed #fff', borderRadius: '8px', pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', bottom: '-40px', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: '0.875rem' }}>
                        Place your ID card within the frame
                      </div>
                    </div>
                  )}

                  {currentStepIndex === 8 && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '3rem', textAlign: 'center' }}>
                      <div style={{ 
                        padding: '2rem', 
                        background: 'rgba(255,255,255,0.1)', 
                        backdropFilter: 'blur(10px)', 
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}>
                        <h3 style={{ marginBottom: '1rem' }}>Security Acknowledgement</h3>
                        <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                          I understand that my session is being recorded and proctored. 
                          My USN <strong>{exam?.studentUsn || '1VE22CS888'}</strong> is embedded as an invisible watermark. 
                          Any violation will be logged and reported.
                        </p>
                        <button className="btn-primary" style={{ width: '100%' }} onClick={handleFinish}>I Understand — Start Exam</button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--surface-container-high)', borderRadius: '8px' }}>
                  <Icon name="info" style={{ color: 'var(--primary)' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                    {stepStatus[currentStepIndex] === 'active' ? 'Please wait while we verify this step...' : ''}
                    {stepStatus[currentStepIndex] === 'error' ? 'Verification failed. Please check the instructions and try again.' : ''}
                    {stepStatus[currentStepIndex] === 'success' ? 'Verification successful!' : ''}
                  </p>
                  {stepStatus[currentStepIndex] === 'error' && (
                    <button className="btn-text" onClick={() => runStep(currentStepIndex)}>Retry</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
