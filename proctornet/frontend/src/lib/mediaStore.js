/**
 * mediaStore.js
 * Driver-aware reactive media store (R3).
 *
 * mediaDriver === 'snapshot'           → ProctorSnapshotter (direct S3 WebP)
 * mediaDriver === 'livekit-selfhost'   → ProctorPublisher  (LiveKit SFU)
 * mediaDriver === 'livekit-cloud'      → ProctorPublisher  (LiveKit Cloud demo)
 *
 * The UI never changes design between drivers — only the backing class differs.
 * Driver is fetched once from /api/v1/config on first startPublisher call.
 */

import { useSyncExternalStore } from 'react'
import { ConnectionState } from 'livekit-client'
import { ProctorPublisher } from './proctorMedia'
import { ProctorSnapshotter } from './proctorSnapshotter'
import api from '@/utils/api'

export const MEDIA_STATUS = Object.freeze({
  IDLE: 'IDLE',
  REQUESTING_TOKEN: 'REQUESTING_TOKEN',
  CONNECTING: 'CONNECTING',
  PUBLISHING: 'PUBLISHING',
  ACTIVE: 'ACTIVE',
  RECONNECTING: 'RECONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR'
})

// ── Config cache ─────────────────────────────────────────────────────────────
let _cachedMediaDriver = null

async function resolveMediaDriver() {
  if (_cachedMediaDriver) return _cachedMediaDriver
  try {
    const res = await api.get('/config')
    _cachedMediaDriver = res.data?.mediaDriver || 'snapshot'
  } catch {
    _cachedMediaDriver = 'snapshot'
  }
  return _cachedMediaDriver
}

// ── Store ────────────────────────────────────────────────────────────────────

class MediaStoreManager {
  constructor() {
    this.state = {
      status: MEDIA_STATUS.IDLE,
      driver: null,           // 'snapshot' | 'livekit-selfhost' | 'livekit-cloud'
      publisher: null,        // ProctorPublisher instance (livekit drivers)
      snapshotter: null,      // ProctorSnapshotter instance (snapshot driver)
      screenPublished: false,
      cameraPublished: false,
      isReconnecting: false,
      error: null,
      lastEvent: null
    }
    this.listeners = new Set()
  }

  getSnapshot = () => this.state

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setState(updates) {
    this.state = { ...this.state, ...updates }
    this.listeners.forEach((l) => {
      try { l(this.state) } catch (_) {}
    })
  }

  // ── Snapshot driver ─────────────────────────────────────────────────────

  async startSnapshotter({ examId, attemptId, cameraTrack, screenTrack, socket, onError }) {
    if (!examId || !attemptId) {
      throw new Error('examId and attemptId are required to start snapshotter')
    }

    // Teardown existing session if any
    if (this.state.snapshotter) {
      this.state.snapshotter.stop()
    }

    this.setState({
      status: MEDIA_STATUS.CONNECTING,
      driver: 'snapshot',
      error: null,
      lastEvent: 'SNAPSHOT_INIT'
    })

    const snapshotter = new ProctorSnapshotter({
      examId,
      attemptId,
      cameraTrack,
      screenTrack,
      socket,
      onError: (err) => {
        // Non-fatal: log but never crash the exam
        this.setState({ error: err.message, lastEvent: 'SnapshotUploadError' })
        if (onError) onError(err)
      }
    })

    snapshotter.start()

    this.setState({
      snapshotter,
      status: MEDIA_STATUS.ACTIVE,
      screenPublished: !!screenTrack,
      cameraPublished: !!cameraTrack,
      lastEvent: 'SNAPSHOT_ACTIVE'
    })

    return snapshotter
  }

  // ── LiveKit publisher driver ─────────────────────────────────────────────

  async startPublisher({ examId, attemptId, onViolation = () => {}, onScreenShareStopped = () => {} }) {
    if (!examId || !attemptId) {
      throw new Error('examId and attemptId are required to start media publisher')
    }

    // Teardown existing session if any
    if (this.state.publisher) {
      await this.disconnect()
    }

    try {
      this.setState({
        status: MEDIA_STATUS.REQUESTING_TOKEN,
        error: null,
        lastEvent: 'REQUESTING_TOKEN'
      })

      // Token request
      const tokenRes = await api.post('/proctoring/token', { examId, attemptId })
      const { token, wsUrl } = tokenRes.data
      if (!token) throw new Error('Failed to retrieve media token from server')

      const resolvedWsUrl = wsUrl?.startsWith('http') || wsUrl?.startsWith('ws')
        ? wsUrl
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsUrl || '/media/'}`

      this.setState({ status: MEDIA_STATUS.CONNECTING, lastEvent: 'CONNECTING' })

      const publisher = new ProctorPublisher({
        examId,
        attemptId,
        token,
        wsUrl: resolvedWsUrl,
        enableCamera: true,
        onConnectionStateChange: (state) => {
          if (state === 'reconnecting' || state === ConnectionState.Reconnecting) {
            this.setState({ isReconnecting: true, status: MEDIA_STATUS.RECONNECTING, lastEvent: 'RECONNECTING' })
          } else if (state === 'connected' || state === ConnectionState.Connected) {
            this.setState({ isReconnecting: false, status: MEDIA_STATUS.ACTIVE, lastEvent: 'CONNECTED' })
          } else if (state === 'disconnected' || state === ConnectionState.Disconnected) {
            this.setState({ isReconnecting: false, status: MEDIA_STATUS.DISCONNECTED, lastEvent: 'DISCONNECTED' })
          }
        },
        onScreenShareStopped: ({ reason }) => {
          this.setState({ screenPublished: false, lastEvent: 'SCREEN_SHARE_STOPPED' })
          onScreenShareStopped({ reason })
        },
        onViolation: ({ eventType, metadata }) => onViolation({ eventType, metadata }),
        onError: (type, message) => this.setState({ error: message, lastEvent: type })
      })

      this.setState({ publisher, status: MEDIA_STATUS.PUBLISHING, lastEvent: 'PUBLISHING' })

      await publisher.connect()

      this.setState({
        status: MEDIA_STATUS.ACTIVE,
        screenPublished: Boolean(publisher.screenTrack),
        cameraPublished: Boolean(publisher.cameraTrack),
        error: null,
        lastEvent: 'ACTIVE'
      })

      return publisher
    } catch (err) {
      this.setState({
        status: MEDIA_STATUS.ERROR,
        error: err.message || 'Media connection failure',
        lastEvent: 'PublishFailure'
      })
      throw err
    }
  }

  /**
   * Driver-aware startup — reads /api/v1/config to decide which driver to use.
   * ExamInterface.jsx calls this unified entry point.
   */
  async start({ examId, attemptId, cameraTrack, screenTrack, socket,
                onViolation, onScreenShareStopped, onError }) {
    const driver = await resolveMediaDriver()
    this.setState({ driver })

    if (driver === 'snapshot') {
      return this.startSnapshotter({ examId, attemptId, cameraTrack, screenTrack, socket, onError })
    } else {
      // livekit-selfhost or livekit-cloud
      return this.startPublisher({ examId, attemptId, onViolation, onScreenShareStopped })
    }
  }

  // ── Re-share screen (livekit driver only) ────────────────────────────────

  async reShareScreen() {
    if (this.state.driver === 'snapshot') return // no-op for snapshot driver
    if (!this.state.publisher) throw new Error('No active publisher to re-share screen')
    try {
      await this.state.publisher.reShareScreen()
      this.setState({ screenPublished: true, error: null, lastEvent: 'SCREEN_SHARE_RESUMED' })
    } catch (err) {
      this.setState({ error: err.message, lastEvent: 'ReShareFailed' })
      throw err
    }
  }

  // ── Update tracks (snapshot driver only) ────────────────────────────────

  updateTracks({ cameraTrack, screenTrack } = {}) {
    if (this.state.snapshotter) {
      this.state.snapshotter.updateTracks({ cameraTrack, screenTrack })
      this.setState({
        cameraPublished: !!cameraTrack,
        screenPublished: !!screenTrack
      })
    }
  }

  // ── Disconnect / cleanup ─────────────────────────────────────────────────

  async disconnect() {
    if (this.state.snapshotter) {
      this.state.snapshotter.stop()
    }
    if (this.state.publisher) {
      try { await this.state.publisher.disconnect() } catch (_) {}
    }
    this.setState({
      status: MEDIA_STATUS.IDLE,
      driver: null,
      publisher: null,
      snapshotter: null,
      screenPublished: false,
      cameraPublished: false,
      isReconnecting: false,
      error: null,
      lastEvent: 'DISCONNECTED'
    })
  }

  reset() {
    this.disconnect()
  }
}

export const mediaStore = new MediaStoreManager()

export function useMediaStore() {
  return useSyncExternalStore(mediaStore.subscribe, mediaStore.getSnapshot, mediaStore.getSnapshot)
}
