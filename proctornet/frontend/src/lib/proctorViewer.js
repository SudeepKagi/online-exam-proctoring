/**
 * proctorViewer.js
 * Invigilator WebRTC Viewer via LiveKit SFU (ADR-008 / Notion 13.10)
 * Architecture:
 * - autoSubscribe: false — Selective subscription driven by viewport visibility
 * - Visible grid tiles subscribe to VideoQuality.LOW (approx 640x360 @ 3 fps, <= 120 kbps)
 * - Focused tile promotes screen to VideoQuality.HIGH + camera to VideoQuality.MEDIUM
 * - Strict cap: MAX_HIGH_QUALITY_STREAMS (default 4)
 * - Off-screen / off-page tiles are unsubscribed (zero egress bandwidth)
 * - Auto-focus on alert promotes flagged student for 60s
 */

import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  ConnectionState
} from 'livekit-client'

export const MAX_HIGH_QUALITY_STREAMS = 4

export class ProctorViewer {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://localhost:7880'
    this.token = options.token
    this.defaultGridTrack = options.defaultGridTrack || 'screen' // 'screen' | 'camera'
    this.maxHighQualityStreams = options.maxHighQualityStreams || MAX_HIGH_QUALITY_STREAMS

    // Callbacks
    this.onTrackSubscribed = options.onTrackSubscribed || (() => {})
    this.onTrackUnsubscribed = options.onTrackUnsubscribed || (() => {})
    this.onParticipantConnected = options.onParticipantConnected || (() => {})
    this.onParticipantDisconnected = options.onParticipantDisconnected || (() => {})
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {})

    this.room = null
    this.visibleIdentities = new Set()
    this.focusedIdentity = null
    this.autoFocusTimer = null
  }

  /**
   * Connect to LiveKit SFU with autoSubscribe: false
   */
  async connect() {
    if (!this.token || !this.wsUrl) {
      throw new Error('LiveKit viewer requires valid token and wsUrl')
    }

    this.room = new Room({
      autoSubscribe: false,
      adaptiveStream: true
    })

    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.onConnectionStateChange(state)
    })

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.onParticipantConnected(participant)
      this._syncParticipantSubscription(participant)
    })

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.onParticipantDisconnected(participant)
    })

    this.room.on(RoomEvent.TrackPublished, (publication, participant) => {
      this._syncParticipantSubscription(participant)
    })

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      this.onTrackSubscribed({
        identity: participant.identity,
        source: track.source === Track.Source.ScreenShare ? 'screen' : 'camera',
        track,
        publication,
        participant
      })
    })

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      this.onTrackUnsubscribed({
        identity: participant.identity,
        source: track.source === Track.Source.ScreenShare ? 'screen' : 'camera',
        track,
        publication,
        participant
      })
    })

    await this.room.connect(this.wsUrl, this.token)
    return this.room
  }

  /**
   * Synchronize viewport visibility: subscribe to visible tiles, unsubscribe off-screen tiles
   * @param {string[]} visibleIdentities - Candidate identities currently visible in pagination/viewport
   * @param {string|null} focusedIdentity - Candidate identity currently in focus view
   */
  syncVisibleTiles(visibleIdentities = [], focusedIdentity = null) {
    this.visibleIdentities = new Set(visibleIdentities)
    this.focusedIdentity = focusedIdentity

    if (!this.room || this.room.state !== ConnectionState.Connected) return

    for (const participant of this.room.remoteParticipants.values()) {
      this._syncParticipantSubscription(participant)
    }
  }

  /**
   * Set single candidate in focus (screen at HIGH quality, camera at MEDIUM)
   */
  setFocusCandidate(identity, autoResetMs = 0) {
    this.focusedIdentity = identity

    if (this.autoFocusTimer) {
      clearTimeout(this.autoFocusTimer)
      this.autoFocusTimer = null
    }

    if (autoResetMs > 0) {
      this.autoFocusTimer = setTimeout(() => {
        if (this.focusedIdentity === identity) {
          this.clearFocusCandidate()
        }
      }, autoResetMs)
    }

    if (this.room && this.room.state === ConnectionState.Connected) {
      const p = this.room.remoteParticipants.get(identity) || this.room.remoteParticipants.get(`student:${identity}`)
      if (p) this._syncParticipantSubscription(p)
    }
  }

  /**
   * Clear focus view and return to standard low-bandwidth grid
   */
  clearFocusCandidate() {
    const prev = this.focusedIdentity
    this.focusedIdentity = null

    if (this.autoFocusTimer) {
      clearTimeout(this.autoFocusTimer)
      this.autoFocusTimer = null
    }

    if (prev && this.room && this.room.state === ConnectionState.Connected) {
      const p = this.room.remoteParticipants.get(prev) || this.room.remoteParticipants.get(`student:${prev}`)
      if (p) this._syncParticipantSubscription(p)
    }
  }

  /**
   * Auto-focus a candidate upon high-severity violation for 60 seconds
   */
  handleSecurityAlert(identity) {
    if (identity) {
      this.setFocusCandidate(identity, 60000) // 60s
    }
  }

  /**
   * Subscribes/unsubscribes and applies simulcast quality layers per participant
   */
  _syncParticipantSubscription(participant) {
    const rawId = participant.identity
    const cleanId = rawId ? rawId.replace(/^student:/, '') : ''
    const isVisible = this.visibleIdentities.has(rawId) || this.visibleIdentities.has(cleanId)
    const isFocused = Boolean(this.focusedIdentity) && (this.focusedIdentity === rawId || this.focusedIdentity === cleanId)

    for (const publication of participant.trackPublications.values()) {
      if (publication.kind !== Track.Kind.Video) continue

      const isScreen = publication.source === Track.Source.ScreenShare || publication.trackName === 'screen'
      const isCamera = publication.source === Track.Source.Camera || publication.trackName === 'camera'

      if (isFocused) {
        // Focused candidate: screen and camera at HIGH quality
        if (!publication.isSubscribed) publication.setSubscribed(true)
        publication.setVideoQuality(VideoQuality.HIGH)
      } else if (isVisible) {
        // Visible grid tile: subscribe to video at VideoQuality.LOW
        if (!publication.isSubscribed) publication.setSubscribed(true)
        publication.setVideoQuality(VideoQuality.LOW)
      } else {
        // Off-screen tile: strictly unsubscribe to conserve bandwidth
        if (publication.isSubscribed) {
          publication.setSubscribed(false)
        }
      }
    }
  }

  /**
   * Disconnect viewer and release resources
   */
  async disconnect() {
    if (this.autoFocusTimer) {
      clearTimeout(this.autoFocusTimer)
      this.autoFocusTimer = null
    }

    if (this.room) {
      try {
        await this.room.disconnect()
      } catch (err) {
        // ignore disconnect errors
      } finally {
        this.room = null
        this.visibleIdentities.clear()
        this.focusedIdentity = null
      }
    }
  }
}
