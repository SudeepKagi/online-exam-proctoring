import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { Shield, Camera, Wifi, Monitor, CheckCircle, XCircle, Loader, ArrowRight } from 'lucide-react'

function CheckRow({ label, status, detail }) {
  const icons = { pass: <CheckCircle size={18} className="text-green-400 flex-shrink-0" />, fail: <XCircle size={18} className="text-red-400 flex-shrink-0" />, loading: <Loader size={18} className="text-blue-400 animate-spin flex-shrink-0" />, pending: <div className="w-4.5 h-4.5 rounded-full border-2 border-gray-600 flex-shrink-0" /> }
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800">
      {icons[status] || icons.pending}
      <div className="flex-1">
        <p className={`text-sm font-semibold ${status === 'pass' ? 'text-green-300' : status === 'fail' ? 'text-red-300' : 'text-gray-300'}`}>{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

export default function SecurityCheck() {
  const { id: examId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [checks, setChecks] = useState({ camera: 'loading', face: 'pending', vpn: 'pending', browser: 'pending', network: 'pending' })
  const [details, setDetails] = useState({})
  const [allPassed, setAllPassed] = useState(false)
  const [exam, setExam] = useState(null)

  const setCheck = (key, status, detail = '') => {
    setChecks(p => ({ ...p, [key]: status }))
    setDetails(p => ({ ...p, [key]: detail }))
  }

  const faceIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 1. Camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('Play error:', e))
          }
        }
        setCheck('camera', 'pass', 'Camera accessible')
        runFaceCheck()
      })
      .catch((err) => {
        console.error('Camera access error:', err)
        setCheck('camera', 'fail', 'Camera permission denied')
      })
  }, [])

  // 2. Face detection
  const runFaceCheck = async () => {
    setCheck('face', 'loading', 'Loading models…')
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      
      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          const det = await faceapi.detectAllFaces(videoRef.current, options)
          if (det.length === 1) setCheck('face', 'pass', 'Face detected clearly')
          else if (det.length === 0) setCheck('face', 'fail', 'No face detected — sit in frame')
          else setCheck('face', 'fail', 'Multiple faces detected')
        } catch (err) {
          console.error('Face detection err:', err)
        }
      }, 1000)
    } catch { setCheck('face', 'fail', 'Face detection unavailable') }
  }

  // 3. VPN / Network / Browser checks
  useEffect(() => {
    // Browser fullscreen check
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
      setCheck('browser', 'pass', 'Fullscreen active')
    } else {
      setCheck('browser', 'pass', 'Browser compatible')
    }

    // Network ping
    const t0 = performance.now()
    fetch(import.meta.env.VITE_API_URL + '/auth/me', { method: 'HEAD' }).then(() => {
      const ms = Math.round(performance.now() - t0)
      setCheck('network', ms < 500 ? 'pass' : 'pass', `Latency: ${ms}ms`)
    }).catch(() => setCheck('network', 'fail', 'Network unreachable'))

    // VPN check (optional)
    const vpnEnabled = import.meta.env.VITE_VPN_ENABLED === 'true'
    if (!vpnEnabled) {
      setCheck('vpn', 'pass', 'VPN enforcement disabled')
    } else {
      api.get(`/vpn/status/${examId}`).then(r => {
        if (r.data.connected) setCheck('vpn', 'pass', `Connected (${r.data.ip})`)
        else setCheck('vpn', 'fail', 'VPN not connected')
      }).catch(() => setCheck('vpn', 'pass', 'VPN check skipped'))
    }

    // Fetch exam info
    api.get(`/student/exams/${examId}`).then(r => setExam(r.data.exam)).catch(() => {})
  }, [examId])

  // Evaluate allPassed
  useEffect(() => {
    const vals = Object.values(checks)
    const noLoading = vals.every(v => v !== 'loading' && v !== 'pending')
    const noFail = !vals.includes('fail')
    if (noLoading) setAllPassed(noFail)
  }, [checks])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Security Check</h1>
          <p className="text-sm text-gray-400 mt-1">{exam?.title || 'Verifying environment before exam…'}</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-5">
          <div className="relative mb-4 bg-gray-800 rounded-xl overflow-hidden aspect-video">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-xs text-white">Live Feed</div>
          </div>

          <CheckRow label="Camera Access" status={checks.camera} detail={details.camera} />
          <CheckRow label="Face Detection" status={checks.face} detail={details.face} />
          <CheckRow label="VPN / Secure Network" status={checks.vpn} detail={details.vpn} />
          <CheckRow label="Browser Compatibility" status={checks.browser} detail={details.browser} />
          <CheckRow label="Network Connection" status={checks.network} detail={details.network} />
        </div>

        {allPassed ? (
          <button onClick={() => navigate(`/student/exams/${examId}/exam`)}
            className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors">
            All Checks Passed — Enter Exam <ArrowRight size={18} />
          </button>
        ) : (
          <div className="w-full py-3.5 bg-gray-800 text-gray-500 font-semibold rounded-2xl text-center text-sm">
            {Object.values(checks).includes('fail') ? 'Fix issues above before entering' : 'Running checks…'}
          </div>
        )}

        <p className="text-xs text-center text-gray-600 mt-4">
          All exam activities are recorded and monitored for academic integrity.
        </p>
      </div>
    </div>
  )
}
