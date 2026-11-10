/**
 * ProctorNet Unified Camera Store
 *
 * Single-owner MediaStream manager across student dashboard checks, start page,
 * pre-check identity verification, and live exam arena.
 *
 * States:
 * - 'idle': Not yet requested or cleanly released
 * - 'requesting': getUserMedia prompt or device acquisition in-flight
 * - 'live': Active camera stream with live video tracks
 * - 'denied': User or browser denied camera permission (NotAllowedError)
 * - 'no_device': No video input hardware found (NotFoundError)
 * - 'in_use': Hardware locked by another application (NotReadableError)
 * - 'lost': Hardware disconnected or track ended unexpectedly
 */

class CameraStore {
  constructor() {
    this.state = {
      status: 'idle', // 'idle' | 'requesting' | 'live' | 'denied' | 'no_device' | 'in_use' | 'lost'
      stream: null,
      devices: [],
      selectedDeviceId: null,
      hasFrames: false,
      error: null
    }
    this.listeners = new Set()
    this.activeTrackEndedHandler = null

    // Sync from window if a stream was previously initialized
    if (typeof window !== 'undefined' && window.__proctorCameraStream?.active) {
      const tracks = window.__proctorCameraStream.getVideoTracks()
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        this.state = {
          ...this.state,
          stream: window.__proctorCameraStream,
          status: 'live'
        }
        this._bindTrackEnded(tracks[0])
      }
    }
  }

  getState() {
    return this.state
  }

  getStream() {
    if (this.state.stream && this.state.stream.active) {
      const track = this.state.stream.getVideoTracks()[0]
      if (track && track.readyState === 'live') {
        return this.state.stream
      }
    }
    if (typeof window !== 'undefined' && window.__proctorCameraStream?.active) {
      const track = window.__proctorCameraStream.getVideoTracks()[0]
      if (track && track.readyState === 'live') {
        return window.__proctorCameraStream
      }
    }
    return null
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  _setState(updates) {
    this.state = { ...this.state, ...updates }
    this._notify()
  }

  _notify() {
    const snapshot = this.state
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[CameraStore] Listener error:', err)
      }
    })
  }

  _bindTrackEnded(track) {
    if (this.activeTrackEndedHandler && this.state.stream) {
      const prevTrack = this.state.stream.getVideoTracks()[0]
      if (prevTrack) {
        prevTrack.removeEventListener('ended', this.activeTrackEndedHandler)
      }
    }

    this.activeTrackEndedHandler = () => {
      if (this.state.status === 'live') {
        this._setState({
          status: 'lost',
          hasFrames: false,
          error: 'Camera connection was lost or disconnected.'
        })
      }
    }
    track.addEventListener('ended', this.activeTrackEndedHandler, { once: true })
  }

  async enumerateDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return []
    }
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
      this._setState({ devices: videoDevices })
      return videoDevices
    } catch (_) {
      return []
    }
  }

  async requestCamera({ deviceId, forceNew = false } = {}) {
    // 1. If we already hold an active, live stream and no force-new requested
    const targetDeviceId = deviceId || this.state.selectedDeviceId
    if (!forceNew && this.state.stream && this.state.stream.active) {
      const track = this.state.stream.getVideoTracks()[0]
      if (track && track.readyState === 'live') {
        const settings = track.getSettings ? track.getSettings() : {}
        if (!targetDeviceId || !settings.deviceId || settings.deviceId === targetDeviceId) {
          this._setState({
            status: 'live',
            error: null
          })
          this.enumerateDevices().catch(() => {})
          return this.state.stream
        }
      }
    }

    // 2. Stop existing stream before re-acquiring if switching devices or forcing new
    if (this.state.stream) {
      try {
        this.state.stream.getTracks().forEach((t) => t.stop())
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.__proctorCameraStream = null
      }
    }

    this._setState({
      status: 'requesting',
      error: null,
      hasFrames: false,
      stream: null
    })

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this._setState({
        status: 'no_device',
        error: 'Your browser does not support webcam media access.'
      })
      throw new Error(this.state.error)
    }

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        ...(targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'user' })
      },
      audio: false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const track = stream.getVideoTracks()[0]

      if (!track || track.readyState !== 'live') {
        this._setState({
          status: 'lost',
          error: 'Video track was not active upon acquisition.'
        })
        throw new Error(this.state.error)
      }

      this._bindTrackEnded(track)

      if (typeof window !== 'undefined') {
        window.__proctorCameraStream = stream
      }

      this._setState({
        stream,
        status: 'live',
        selectedDeviceId: targetDeviceId || null,
        error: null
      })

      this.enumerateDevices().catch(() => {})
      return stream
    } catch (err) {
      const errName = err.name || ''
      let status = 'lost'
      let error = err.message || 'Unable to access camera.'

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        status = 'denied'
        error = 'Camera access was blocked. Please permit camera access to continue.'
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        status = 'no_device'
        error = 'No camera hardware found on this system.'
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        status = 'in_use'
        error = 'Camera is already in use by another program (e.g., Zoom, Teams, Meet).'
      }

      if (typeof window !== 'undefined') {
        window.__proctorCameraStream = null
      }

      this._setState({
        status,
        error,
        stream: null
      })
      throw err
    }
  }

  async selectDevice(deviceId) {
    if (this.state.selectedDeviceId === deviceId && this.state.status === 'live') {
      return this.state.stream
    }
    this._setState({ selectedDeviceId: deviceId })
    return this.requestCamera({ deviceId, forceNew: true })
  }

  setHasFrames(hasFrames) {
    if (this.state.hasFrames !== Boolean(hasFrames)) {
      this._setState({ hasFrames: Boolean(hasFrames) })
    }
  }

  checkFrameSample(videoEl) {
    if (!videoEl) return false
    if (videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0 || videoEl.readyState < 2) {
      return false
    }
    if (typeof document === 'undefined') return true

    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(videoEl.videoWidth || 64, 64)
      canvas.height = Math.min(videoEl.videoHeight || 48, 48)
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let hasColor = false
      for (let i = 0; i < imgData.length; i += 16) {
        if (imgData[i] > 10 || imgData[i + 1] > 10 || imgData[i + 2] > 10) {
          hasColor = true
          break
        }
      }
      return hasColor
    } catch (_) {
      // In case of canvas security taint or mock environment
      return true
    }
  }

  releaseCamera(reason = 'submit') {
    // Only release tracks on definitive termination events (submit, logout, leave_exam)
    const validTerminationReasons = ['submit', 'logout', 'leave_exam', 'manual']
    if (!validTerminationReasons.includes(reason)) {
      return
    }

    if (this.state.stream) {
      try {
        this.state.stream.getTracks().forEach((t) => t.stop())
      } catch (_) {}
    }

    if (typeof window !== 'undefined') {
      window.__proctorCameraStream = null
    }

    this._setState({
      stream: null,
      status: 'idle',
      hasFrames: false,
      selectedDeviceId: null,
      error: null
    })
  }
}

export const cameraStore = new CameraStore()
export default cameraStore
