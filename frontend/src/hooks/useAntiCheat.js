import { useEffect } from 'react'

export function useAntiCheat({ onViolation }) {
  useEffect(() => {
    // 1. Prevent Context Menu
    const handleContextMenu = (e) => e.preventDefault()
    
    // 2. Prevent Keyboard Shortcuts
    const handleKeyDown = (e) => {
      const blockedKeys = ['F12', 'PrintScreen']
      const isSystemShortcut = (e.ctrlKey || e.metaKey) && 
        ['c', 'v', 'u', 's', 'p', 'i', 'j'].includes(e.key.toLowerCase())
      
      if (blockedKeys.includes(e.key) || isSystemShortcut) {
        e.preventDefault()
        onViolation('KEYBOARD_SHORTCUT', { key: e.key })
      }
    }

    // 3. Detect Tab Switch / Window Blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onViolation('TAB_SWITCH')
      }
    }

    const handleWindowBlur = () => {
      onViolation('WINDOW_BLUR')
    }

    // 4. Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onViolation('FULLSCREEN_EXIT')
      }
    }

    // Attach listeners
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      // Cleanup listeners
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [onViolation])
}
