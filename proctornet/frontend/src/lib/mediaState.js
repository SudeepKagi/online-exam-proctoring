/**
 * mediaState.js
 * Scoped in-memory media state replacing deprecated window.screenShareStream (Q3.7)
 */

let sharedScreenStream = null

export function setSharedScreenStream(stream) {
  sharedScreenStream = stream
}

export function getSharedScreenStream() {
  if (sharedScreenStream && sharedScreenStream.active && sharedScreenStream.getVideoTracks().some(t => t.readyState === 'live')) {
    return sharedScreenStream
  }
  return null
}

export function clearSharedScreenStream() {
  if (sharedScreenStream) {
    try {
      sharedScreenStream.getTracks().forEach(t => t.stop())
    } catch (_) {}
    sharedScreenStream = null
  }
}
