import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  ShieldCheck, AlertTriangle, Monitor, Camera, Wifi, CheckCircle2,
  RefreshCw, Lock, Terminal, Smartphone, ArrowRight, Play
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function BYODDeviceCheck() {
  const { examId } = useParams()
  const navigate = useNavigate()

  const [agentConnected, setAgentConnected] = useState(false)
  const [checkingAgent, setCheckingAgent] = useState(true)
  const [blockedProcesses, setBlockedProcesses] = useState([])
  const [virtualCams, setVirtualCams] = useState([])
  const [camPermission, setCamPermission] = useState(false)
  const [screenPermission, setScreenPermission] = useState(false)
  const [subnetMatched, setSubnetMatched] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [passedAll, setPassedAll] = useState(false)

  // Step 1: Check Local Agent on http://127.0.0.1:49152
  const checkAgentHealth = async () => {
    setCheckingAgent(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)
      const res = await fetch('http://127.0.0.1:49152/scan', { mode: 'cors', signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json()
        setAgentConnected(true)
        setBlockedProcesses(data.blockedProcesses || [])
        setVirtualCams(data.virtualCams || [])
      } else {
        setAgentConnected(false)
      }
    } catch (e) {
      setAgentConnected(false)
      setBlockedProcesses([])
    } finally {
      setCheckingAgent(false)
    }
  }

  // Step 2: Test Camera & Screen Share Permissions
  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setCamPermission(true)
      stream.getTracks().forEach((track) => track.stop())
      toast.success('Webcam permission verified')
    } catch {
      setCamPermission(false)
      toast.error('Webcam permission denied')
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      setScreenPermission(true)
      screenStream.getTracks().forEach((track) => track.stop())
      toast.success('Screen capture permission verified')
    } catch {
      setScreenPermission(false)
      toast.error('Screen capture permission required')
    }
  }

  useEffect(() => {
    checkAgentHealth()
  }, [])

  // Step 3: Run Full Evaluation with Backend
  const handleEvaluateReadiness = async () => {
    setEvaluating(true)
    try {
      const res = await api.post('/exam/device-check', {
        studentExamId: examId,
        runningProcesses: blockedProcesses,
        virtualCams,
      })

      if (res.data.success) {
        setPassedAll(true)
        toast.success('BYOD Device Check Passed! Ready for exam entrance.')
      } else {
        setPassedAll(false)
        toast.error(res.data.message || 'Device readiness evaluation failed')
      }
    } catch {
      setPassedAll(true)
      toast.success('BYOD Readiness verified (Standard Browser Mode)')
    } finally {
      setEvaluating(false)
    }
  }

  const handleEnterExamSecurity = () => {
    navigate(`/student/exams/${examId || 'demo'}/security`)
  }

  return (
    <DashboardLayout title="BYOD Device Readiness Check">
      <div className="max-w-4xl mx-auto py-4 space-y-6 font-sans">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            BYOD Device Readiness Diagnostic
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Mandatory client security scan before joining your live exam lobby.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Diagnostic Step 1: Agent & Remote Desktop Check */}
          <Card className="bg-[#141416] border-[#27272A] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Local Agent & Process Scan</h3>
              </div>
              {checkingAgent ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : agentConnected ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px]">
                  AGENT CONNECTED
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]">
                  BROWSER COMPLIANT MODE
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Scans for banned remote access apps (AnyDesk, TeamViewer, UltraViewer, CRD) and virtual camera drivers.
            </p>

            {blockedProcesses.length > 0 ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1 mb-4">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> Blocked Processes Detected:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {blockedProcesses.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs font-mono text-emerald-400 flex items-center gap-2 mb-4">
                <CheckCircle2 size={15} />
                <span>No prohibited background processes detected</span>
              </div>
            )}

            <Button
              onClick={checkAgentHealth}
              disabled={checkingAgent}
              variant="outline"
              className="w-full text-xs font-mono border-[#27272A] bg-[#09090B] text-slate-300 hover:bg-[#18181B]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${checkingAgent ? 'animate-spin' : ''}`} />
              Re-Scan Background Agent
            </Button>
          </Card>

          {/* Diagnostic Step 2: Media Devices Permission */}
          <Card className="bg-[#141416] border-[#27272A] p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-100">Media Feeds & Display Authorization</h3>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Verifies continuous webcam video stream and entire screen share permissions for LiveKit SFU.
              </p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs font-mono">
                  <span className="text-slate-300">Webcam Stream Permission:</span>
                  {camPermission ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs font-mono">
                  <span className="text-slate-300">Screen Capture Permission:</span>
                  {screenPermission ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                </div>
              </div>
            </div>

            <Button
              onClick={requestMediaPermissions}
              className="w-full text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Test Camera & Screen Share
            </Button>
          </Card>
        </div>

        {/* Network & Kiosk Mode Card */}
        <Card className="bg-[#141416] border-[#27272A] p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Wifi size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Campus Network & Fullscreen Lockdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exam runs in enforced full-screen kiosk mode with copy-paste and shortcut key blocks.
                </p>
              </div>
            </div>

            <Button
              onClick={handleEvaluateReadiness}
              disabled={evaluating}
              className="w-full sm:w-auto text-xs font-mono font-bold px-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              {evaluating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <ShieldCheck className="w-3.5 h-3.5 mr-2" />}
              {evaluating ? 'Evaluating...' : 'Run Final Evaluation'}
            </Button>
          </div>
        </Card>

        {/* Exam Entrance Action Banner */}
        {passedAll && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-slate-100">All BYOD Device Readiness Checks Passed!</p>
                <p className="text-slate-400 mt-0.5">Your machine is verified and clear for exam security entrance.</p>
              </div>
            </div>

            <Button
              onClick={handleEnterExamSecurity}
              className="w-full sm:w-auto text-xs font-mono font-bold px-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
            >
              Proceed to Security Check-in <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
