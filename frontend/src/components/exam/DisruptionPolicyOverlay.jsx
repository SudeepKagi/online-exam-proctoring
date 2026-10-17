import { useState } from 'react'
import {
  Clock,
  ShieldCheck,
  WifiOff,
  AlertTriangle,
  HelpCircle,
  Send,
  RefreshCw,
  Lock,
  CheckCircle2,
  Cpu
} from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * DisruptionPolicyOverlay Component (Phase 3 - Item 18)
 * Displays authoritative disruption state, formal academic safeguards,
 * time preservation status, encrypted answer safety, and proctor escalation.
 */
export default function DisruptionPolicyOverlay({
  suspendedState,
  user,
  exam,
  onSendHelpMessage,
  onRefreshState
}) {
  const [helpMessage, setHelpMessage] = useState('')
  const [sendingHelp, setSendingHelp] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  const isVpn = Boolean(suspendedState?.isVpn)
  const reason = suspendedState?.reason || 'The proctoring system or invigilator has temporarily suspended this examination session.'

  const handleSendHelp = async (e) => {
    e?.preventDefault()
    if (!helpMessage.trim() || sendingHelp) return

    setSendingHelp(true)
    try {
      const formatted = `[DISRUPTION ASSISTANCE REQUEST] ${helpMessage.trim()}`
      if (onSendHelpMessage) {
        await onSendHelpMessage(formatted)
      }
      setSentSuccess(true)
      toast.success('Assistance request sent to invigilator.')
      setHelpMessage('')
      setTimeout(() => setSentSuccess(false), 5000)
    } catch {
      toast.error('Unable to send request. Checking network connection...')
    } finally {
      setSendingHelp(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-left shadow-2xl space-y-6 my-auto text-slate-100">
        
        {/* Status Header */}
        <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            {isVpn ? (
              <WifiOff className="w-6 h-6 text-amber-400" />
            ) : (
              <Clock className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                Session Paused
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {user?.usn || 'Candidate'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {isVpn
                ? 'Secure Network Disconnected'
                : 'Examination Session Suspended'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              {reason}
            </p>
          </div>
        </div>


        {/* Formal Disruption Policy Safeguards (Item 18) */}
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                ProctorNet Disruption Policy & Academic Safeguards
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Protected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Timer Preserved</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Official countdown is frozen while suspended. You will receive all remaining time upon reconnection.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypted Answer Safety</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                All selected answers are encrypted (AES-GCM) in local browser IndexedDB. Zero progress is lost.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>15-Minute Recovery Window</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Candidates have a 15-minute grace window to resolve camera or network interruptions.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-violet-400 font-semibold">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Proctor Escalation & Waivers</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                The invigilator can grant an authorized technical waiver or re-enable access if hardware fails.
              </p>
            </div>
          </div>
        </div>

        {/* Proctor Assistance Channel */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Need invigilator assistance or a technical waiver?
            </span>
            {sentSuccess && (
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Request Transmitted
              </span>
            )}
          </div>

          <form onSubmit={handleSendHelp} className="flex gap-2">
            <input
              type="text"
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
              placeholder="Briefly state your technical issue to the invigilator..."
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sendingHelp || !helpMessage.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingHelp ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-500">
            Do not close this tab. The examination will automatically resume once conditions are met.
          </p>
          {onRefreshState && (
            <button
              onClick={onRefreshState}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Check Status Now
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
