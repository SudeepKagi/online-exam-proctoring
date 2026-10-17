// Shared ScreenStream Store for pre-check -> arena handoff
let activeStream = null

export function setScreenStream(stream) {
  activeStream = stream
  if (typeof window !== 'undefined') {
    window.__proctorScreenStream = stream
  }
}

export function getScreenStream() {
  if (activeStream && activeStream.active) return activeStream
  if (typeof window !== 'undefined' && window.__proctorScreenStream?.active) {
    return window.__proctorScreenStream
  }
  return activeStream || null
}

export function clearScreenStream() {
  if (activeStream) {
    try {
      activeStream.getTracks().forEach((t) => t.stop())
    } catch (_) {}
    activeStream = null
  }
  if (typeof window !== 'undefined') {
    window.__proctorScreenStream = null
  }
}

export default {
  setScreenStream,
  getScreenStream,
  clearScreenStream,
}
