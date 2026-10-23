import React from 'react'
import { Button } from '@/components/ui/button'

export function ProctoringInterruptedOverlay({
  isOpen,
  screenLost,
  cameraLost,
  onReShareScreen,
  onReEnableCamera
}) {
  if (!isOpen) return null

  return (
    <div
      data-testid="proctoring-interrupted-overlay"
      className="fixed inset-0 z-50 bg-[#fbfcfd]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-[#28253b] text-center font-sans"
    >
      <div className="w-16 h-16 rounded-full bg-[#edecfb] text-[#5266eb] flex items-center justify-center mb-4">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-[480] text-[#28253b] mb-2">Proctoring Interrupted</h2>
      <p className="text-sm font-[360] text-[#554e7b] max-w-md mb-6 leading-relaxed">
        You stopped screen/camera sharing. Continuous monitoring is strictly mandatory throughout the examination. Re-enable sharing immediately to continue your exam.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {screenLost && (
          <Button
            onClick={onReShareScreen}
            className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-6 h-10 shadow-xs cursor-pointer"
          >
            Re-Enable Screen Sharing
          </Button>
        )}
        {cameraLost && (
          <Button
            onClick={onReEnableCamera}
            className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-6 h-10 shadow-xs cursor-pointer"
          >
            Re-Enable Camera
          </Button>
        )}
      </div>
    </div>
  )
}

export default ProctoringInterruptedOverlay
