import { useState, useEffect } from 'react'
import axios from 'axios'
import { Wifi, WifiOff, Users, Server } from 'lucide-react'

export default function VPNStatus() {
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/vpn/server-status')
      setStatus(res.data)
    } catch(err) {
      setStatus({ isRunning: false })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          VPN Server Status
        </h3>
        <div className={`
          flex items-center gap-1.5 px-2.5 py-1 
          rounded-full text-xs font-medium
          ${status?.isRunning 
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'}
        `}>
          <div className={`
            w-1.5 h-1.5 rounded-full
            ${status?.isRunning 
              ? 'bg-green-500 animate-pulse'
              : 'bg-red-500'}
          `} />
          {status?.isRunning ? 'Online' : 'Offline'}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">
            Connected Students
          </p>
          <p className="text-lg font-bold text-gray-800">
            {status?.connectedPeers || 0}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">
            Server
          </p>
          <p className="text-xs font-mono text-gray-600 truncate" title={import.meta.env.VITE_VPN_SERVER_IP || 'Not configured'}>
            {import.meta.env.VITE_VPN_SERVER_IP || 'Not configured'}
          </p>
        </div>
      </div>
    </div>
  )
}
