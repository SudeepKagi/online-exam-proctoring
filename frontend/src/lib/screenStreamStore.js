// Shared CameraStream Store for pre-check -> arena handoff
let activeCameraStream = null

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
  setCameraStream,
  getCameraStream,
  clearCameraStream,
}
