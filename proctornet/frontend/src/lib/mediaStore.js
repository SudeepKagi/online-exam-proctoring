/**
 * mediaStore.js
 * Typed reactive media store for candidate WebRTC publisher via LiveKit SFU (Q6).
 * Zero window.* globals, reactive via useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react'
import { ConnectionState } from 'livekit-client'
import { ProctorPublisher } from './proctorMedia'
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

class MediaStoreManager {
  constructor() {
    this.state = {
      status: MEDIA_STATUS.IDLE,
      publisher: null,
      screenPublished: false,
      cameraPublished: false,
      isReconnecting: false,
      error: null,
      lastEvent: null
    }
    this.listeners = new Set()
  }

  getSnapshot = () => {
    return this.state
  }

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setState(updates) {
    this.state = { ...this.state, ...updates }
    this.listeners.forEach((listener) => {
      try {
        listener(this.state)
      } catch (_) {}
    })
  }

  /**
   * Start ProctorPublisher for an active attempt
   */
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

      // 1. Authoritative Token Request (D-03 compliant)
      const tokenRes = await api.post('/proctoring/token', {
        examId,
        attemptId
      })

      const { token, wsUrl } = tokenRes.data
      if (!token) {
        throw new Error('Failed to retrieve media token from server')
      }

      // Neutral media path resolution
      const resolvedWsUrl = wsUrl?.startsWith('http') || wsUrl?.startsWith('ws')
        ? wsUrl
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsUrl || '/media/'}`

      this.setState({
        status: MEDIA_STATUS.CONNECTING,
        lastEvent: 'CONNECTING'
      })

      // 2. Instantiate ProctorPublisher
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
        onViolation: ({ eventType, metadata }) => {
          onViolation({ eventType, metadata })
        },
        onError: (type, message) => {
          this.setState({ error: message, lastEvent: type })
        }
      })

      this.setState({
        publisher,
        status: MEDIA_STATUS.PUBLISHING,
        lastEvent: 'PUBLISHING'
      })

      // 3. Connect to SFU and publish screen (primary) + camera (low-bitrate)
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
      // "Publish failures are events, not accusations"
      this.setState({
        status: MEDIA_STATUS.ERROR,
        error: err.message || 'Media connection failure',
        lastEvent: 'PublishFailure'
      })
      throw err
    }
  }

  /**
   * Re-share screen after user pause/stop
   */
  async reShareScreen() {
    if (!this.state.publisher) {
      throw new Error('No active publisher to re-share screen')
    }
    try {
      await this.state.publisher.reShareScreen()
      this.setState({
        screenPublished: true,
        error: null,
        lastEvent: 'SCREEN_SHARE_RESUMED'
      })
    } catch (err) {
      this.setState({
        error: err.message,
        lastEvent: 'ReShareFailed'
      })
      throw err
    }
  }

  /**
   * Clean teardown and release of all hardware devices
   */
  async disconnect() {
    if (this.state.publisher) {
      try {
        await this.state.publisher.disconnect()
      } catch (_) {}
    }
    this.setState({
      status: MEDIA_STATUS.IDLE,
      publisher: null,
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
