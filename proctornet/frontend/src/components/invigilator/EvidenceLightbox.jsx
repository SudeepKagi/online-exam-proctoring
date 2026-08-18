import { X } from 'lucide-react'

export default function EvidenceLightbox({ snapshot, onClose }) {
  if (!snapshot) return null

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl max-w-3xl w-full p-4 relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#27272A] pb-3 mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100">{snapshot.title || 'Security Violation Snapshot'}</h4>
            <p className="text-xs font-mono text-slate-400">{snapshot.subtitle || new Date().toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#27272A] rounded-lg text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="bg-[#09090B] rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-[#27272A]">
          <img src={snapshot.url} alt="Evidence Snapshot" className="max-w-full max-h-full object-contain" />
        </div>
      </div>
    </div>
  )
}
