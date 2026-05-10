import { useState, useEffect } from 'react'
import axios from 'axios'
import { 
  Wifi, WifiOff, Download, 
  CheckCircle, AlertCircle, 
  RefreshCw, Info
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function VPNSetup({ 
  examId, 
  onSuccess, 
  onFail 
}) {
  const [step, setStep] = useState('checking')
  // Steps: checking → downloading → 
  //        instructions → verifying → connected

  const [vpnConfig, setVpnConfig] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [checkCount, setCheckCount] = useState(0)
  const [os, setOs] = useState('windows')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Detect OS
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if(ua.includes('mac')) setOs('mac')
    else if(ua.includes('linux')) setOs('linux')
    else setOs('windows')
    
    // Start flow
    initVPN()
  }, [])

  // Step 1: Get VPN config from backend
  const initVPN = async () => {
    setStep('checking')
    setIsLoading(true)
    
    try {
      // First check if already connected
      const statusRes = await axios.get(`/api/vpn/status/${examId}`)
      
      if(statusRes.data.connected) {
        setIsConnected(true)
        setStep('connected')
        onSuccess()
        return
      }
      
      // Generate new VPN config
      const res = await axios.post(`/api/vpn/connect/${examId}`)
      
      setVpnConfig(res.data)
      setStep('downloading')
      
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to setup VPN')
      setStep('error')
      onFail('VPN setup failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Download config file
  const downloadConfig = () => {
    const link = document.createElement('a')
    link.href = `/api/vpn/config/${examId}`
    link.download = 'proctornet-exam.conf'
    link.click()
    
    // Move to instructions step
    setTimeout(() => setStep('instructions'), 500)
  }

  // Step 3: Verify connection
  const verifyConnection = async () => {
    setStep('verifying')
    setIsLoading(true)
    
    // Poll for connection status
    let attempts = 0
    const maxAttempts = 12 // 60 seconds
    
    const poll = setInterval(async () => {
      attempts++
      setCheckCount(attempts)
      
      try {
        const res = await axios.get(`/api/vpn/status/${examId}`)
        
        if(res.data.connected) {
          clearInterval(poll)
          setIsConnected(true)
          setStep('connected')
          setIsLoading(false)
          toast.success('VPN connected successfully!')
          onSuccess()
          return
        }
      } catch(err) {
        // Keep polling
      }
      
      if(attempts >= maxAttempts) {
        clearInterval(poll)
        setIsLoading(false)
        setStep('timeout')
      }
    }, 5000) // Check every 5 seconds
  }

  // OS-specific instructions
  const instructions = {
    windows: [
      'Download WireGuard from wireguard.com/install',
      'Open WireGuard application',
      'Click "Import tunnel(s) from file"',
      'Select the downloaded proctornet-exam.conf',
      'Click "Activate" to connect',
      'Click "Verify Connection" below'
    ],
    mac: [
      'Download WireGuard from Mac App Store',
      'Open WireGuard application',
      'Click "+" → "Import tunnel(s) from file"',
      'Select the downloaded proctornet-exam.conf',
      'Click the toggle to connect',
      'Click "Verify Connection" below'
    ],
    linux: [
      'Install: sudo apt install wireguard',
      'Copy config to: /etc/wireguard/wg0.conf',
      'Run: sudo wg-quick up wg0',
      'Verify: sudo wg show',
      'Click "Verify Connection" below'
    ]
  }

  // RENDER
  return (
    <div className="space-y-4">
      
      {/* STATUS HEADER */}
      <div className={`
        flex items-center gap-3 p-4 rounded-xl
        ${step === 'connected' 
          ? 'bg-green-50 border border-green-200'
          : step === 'error' || step === 'timeout'
          ? 'bg-red-50 border border-red-200'
          : 'bg-blue-50 border border-blue-200'}
      `}>
        {step === 'connected' 
          ? <CheckCircle className="text-green-500" size={24} />
          : step === 'error' || step === 'timeout'
          ? <WifiOff className="text-red-500" size={24}/>
          : <Wifi className="text-blue-500" size={24} />
        }
        <div>
          <p className="font-medium text-sm">
            {step === 'checking' && 'Setting up secure VPN connection...'}
            {step === 'downloading' && 'VPN config ready — Download required'}
            {step === 'instructions' && 'Connect WireGuard on your computer'}
            {step === 'verifying' && `Verifying connection... (${checkCount * 5}s)`}
            {step === 'connected' && '✅ VPN Connected — Internet restricted'}
            {step === 'error' && '❌ VPN setup failed'}
            {step === 'timeout' && '⚠️ Connection timeout — Try again'}
          </p>
          {step === 'connected' && (
            <p className="text-xs text-green-600 mt-0.5">
              Only ProctorNet is accessible. 
              All other sites blocked.
            </p>
          )}
        </div>
      </div>

      {/* STEP: DOWNLOAD */}
      {step === 'downloading' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Your unique VPN configuration has been 
            generated. Download and import it into 
            WireGuard to secure your exam session.
          </p>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                This config is unique to you and 
                this exam. Do not share it. 
                It expires when the exam ends.
              </p>
            </div>
          </div>

          {/* OS Selector */}
          <div className="flex gap-2">
            {['windows','mac','linux'].map(o => (
              <button
                key={o}
                onClick={() => setOs(o)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium capitalize border
                  ${os === o 
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200'}
                `}
              >
                {o === 'mac' ? 'macOS' : o === 'windows' ? 'Windows' : 'Linux'}
              </button>
            ))}
          </div>

          <button
            onClick={downloadConfig}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700"
          >
            <Download size={18} />
            Download WireGuard Config
          </button>
        </div>
      )}

      {/* STEP: INSTRUCTIONS */}
      {step === 'instructions' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Follow these steps on your computer:
          </p>
          
          <ol className="space-y-2">
            {instructions[os].map((inst, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-600">
                  {inst}
                </span>
              </li>
            ))}
          </ol>

          {/* Re-download link */}
          <button
            onClick={downloadConfig}
            className="text-xs text-blue-600 underline flex items-center gap-1"
          >
            <Download size={12} />
            Re-download config file
          </button>

          <button
            onClick={verifyConnection}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Wifi size={18} />
            Verify Connection →
          </button>
        </div>
      )}

      {/* STEP: VERIFYING */}
      {step === 'verifying' && (
        <div className="text-center space-y-3 py-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-600">
            Checking your VPN connection...
          </p>
          <p className="text-xs text-gray-400">
            Make sure WireGuard shows "Active" status on your computer
          </p>
          <p className="text-xs text-blue-600 font-medium">
            Check {checkCount} of 12 ({checkCount * 5} seconds elapsed)
          </p>
        </div>
      )}

      {/* STEP: TIMEOUT */}
      {step === 'timeout' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Could not detect VPN connection. Make sure:
          </p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
            <li>WireGuard app is installed</li>
            <li>Config file was imported correctly</li>
            <li>Toggle is switched ON in WireGuard</li>
            <li>No firewall blocking UDP port 51820</li>
          </ul>
          <div className="flex gap-2">
            <button
              onClick={verifyConnection}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
            <button
              onClick={downloadConfig}
              className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Re-download Config
            </button>
          </div>
        </div>
      )}

      {/* STEP: ERROR */}
      {(step === 'error') && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            {error}
          </p>
          <button
            onClick={initVPN}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* STEP: CONNECTED */}
      {step === 'connected' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">
                Your IP (VPN)
              </p>
              <p className="text-sm font-medium text-gray-700 font-mono">
                {vpnConfig?.peerIp}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">
                Session expires
              </p>
              <p className="text-sm font-medium text-gray-700">
                When exam ends
              </p>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-700">
              🔒 Internet is now restricted. 
              Only ProctorNet is accessible. 
              All other websites are blocked.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
