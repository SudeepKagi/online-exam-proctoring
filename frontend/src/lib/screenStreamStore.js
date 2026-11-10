import cameraStore from './cameraStore'

// Shared CameraStream Store for pre-check -> arena handoff
// Backwards compatible wrapper backed by unified cameraStore

export function setCameraStream(stream) {
  if (stream && cameraStore.getStream() !== stream) {
    // If external code sets a stream directly, mirror it in cameraStore
    cameraStore.state.stream = stream
    cameraStore.state.status = 'live'
    if (typeof window !== 'undefined') {
      window.__proctorCameraStream = stream
    }
    cameraStore._notify()
  }
}

export function getCameraStream() {
  return cameraStore.getStream()
}

export function clearCameraStream() {
  cameraStore.releaseCamera('submit')
}

export default {
  setCameraStream,
  getCameraStream,
  clearCameraStream,
}
