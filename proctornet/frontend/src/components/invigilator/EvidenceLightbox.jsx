import { X } from 'lucide-react'

export default function EvidenceLightbox({ snapshot, onClose }) {
  if (!snapshot) return null

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full p-5 relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border pb-3.5 mb-3.5">
          <div>
            <h4 className="text-sm font-bold text-foreground">{snapshot.title || 'Security Violation Snapshot'}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{snapshot.subtitle || new Date().toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#eff6ff] rounded-xl text-muted-foreground hover:text-primary transition-colors cursor-pointer" aria-label="Close lightbox">
            <X size={18} />
          </button>
        </div>
        <div className="bg-neutral-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-border">
          <img src={snapshot.url} alt="Evidence Snapshot" className="max-w-full max-h-full object-contain" />
        </div>
      </div>
    </div>
  )
}
