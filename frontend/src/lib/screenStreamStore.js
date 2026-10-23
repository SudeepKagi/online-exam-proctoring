// Shared ScreenStream and CameraStream Store for pre-check -> arena handoff
let activeStream = null
let activeCameraStream = null

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

export function setCameraStream(stream) {
  activeCameraStream = stream
  if (typeof window !== 'undefined') {
    window.__proctorCameraStream = stream
  }
}

export function getCameraStream() {
  if (activeCameraStream && activeCameraStream.active) return activeCameraStream
  if (typeof window !== 'undefined' && window.__proctorCameraStream?.active) {
    return window.__proctorCameraStream
  }
  return activeCameraStream || null
}

export function clearCameraStream() {
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach((t) => t.stop())
    } catch (_) {}
    activeCameraStream = null
  }
  if (typeof window !== 'undefined') {
    window.__proctorCameraStream = null
  }
}

export default {
  setScreenStream,
  getScreenStream,
  clearScreenStream,
  setCameraStream,
  getCameraStream,
  clearCameraStream,
}
