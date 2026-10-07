/**
 * proctorMedia.js
 * Student WebRTC Publisher via LiveKit SFU (ADR-008 / Notion 13.10)
 * Architecture:
 * - Single upstream stream to SFU (never P2P mesh)
 * - VP8 simulcast: 720p @ 5 fps (screen) + 180p @ 15 fps (camera, if enabled)
 * - Automatic detection of screen share termination with violation reporting and prompt
 * - Strict dynacast & adaptive bandwidth control
 */

import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  ConnectionState
} from 'livekit-client'

export class ProctorPublisher {
  constructor(options = {}) {
    this.examId = options.examId
    this.attemptId = options.attemptId
    this.token = options.token
    this.wsUrl = options.wsUrl || 'ws://localhost:7880'
    this.enableCamera = Boolean(options.enableCamera)
    this.onViolation = options.onViolation || (() => {})
    this.onScreenShareStopped = options.onScreenShareStopped || (() => {})
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {})
    this.onError = options.onError || (() => {})

    this.room = null
    this.screenTrack = null
    this.cameraTrack = null
    this.isReconnecting = false
  }

  /**
   * Connect to LiveKit SFU and publish media streams
   */
  async connect() {
    if (!this.token || !this.wsUrl) {
      throw new Error('LiveKit connection requires valid token and wsUrl')
    }

    // 1. Initialize Room with publisher-optimized options
    this.room = new Room({
      adaptiveStream: false,
      dynacast: true,
      publishDefaults: {
        videoCodec: 'vp8',
        simulcast: true,
        dtx: true,
        red: false,
        degradationPreference: 'maintain-resolution'
      }
    })

    // 2. Wire Room event handlers
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.onConnectionStateChange(state)
    })

    this.room.on(RoomEvent.Disconnected, (reason) => {
      this.onConnectionStateChange(ConnectionState.Disconnected, reason)
    })

    this.room.on(RoomEvent.Reconnecting, () => {
      this.isReconnecting = true
      this.onConnectionStateChange(ConnectionState.Reconnecting)
    })

    this.room.on(RoomEvent.Reconnected, () => {
      this.isReconnecting = false
      this.onConnectionStateChange(ConnectionState.Connected)
    })

    // 3. Connect to SFU
    await this.room.connect(this.wsUrl, this.token)

    // 4. Publish Screen Share (Mandatory for proctored exams)
    await this.publishScreen()

    // 5. Publish Camera if enabled
    if (this.enableCamera) {
      await this.publishCamera().catch(err => {
        this.onError('CameraPublishError', err.message)
      })
    }

    return this.room
  }

  /**
   * Publish screen capture stream with simulcast and bitrate caps
   */
  async publishScreen() {
    if (!this.room || !this.room.localParticipant) return

    try {
      await this.room.localParticipant.setScreenShareEnabled(
        true,
        {
          resolution: { width: 1280, height: 720, frameRate: 5 },
          contentHint: 'detail'
        },
        {
          screenShareEncoding: {
            maxBitrate: 400_000,
            maxFramerate: 5
          },
          screenShareSimulcastLayers: [
            { width: 640, height: 360, maxBitrate: 120_000, maxFramerate: 3 }
          ]
        }
      )

      const screenPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
      this.screenTrack = screenPub?.track

      if (this.screenTrack?.mediaStreamTrack) {
        this.screenTrack.mediaStreamTrack.onended = () => {
          this.handleScreenShareStopped()
        }
      }
    } catch (err) {
      this.handleScreenShareStopped(err.message)
      throw err
    }
  }

  /**
   * Publish camera stream (320x180 @ 15fps, no simulcast, audio off)
   */
  async publishCamera() {
    if (!this.room || !this.room.localParticipant) return

    await this.room.localParticipant.setCameraEnabled(
      true,
      {
        resolution: { width: 320, height: 180, frameRate: 15 },
        contentHint: 'motion'
      },
      {
        videoEncoding: {
          maxBitrate: 150_000,
          maxFramerate: 15
        },
        simulcast: false
      }
    )

    const cameraPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera)
    this.cameraTrack = cameraPub?.track
  }

  /**
   * Handle screen share stoppage: report violation and alert UI
   */
  handleScreenShareStopped(reason = 'User stopped screen share') {
    // Notify application UI to prompt candidate immediately
    this.onScreenShareStopped({ reason })

    // Report violation through official API (Non-cheating, medium severity)
    this.onViolation({
      eventType: 'SCREEN_SHARE_STOPPED',
      metadata: { reason, timestamp: new Date().toISOString() }
    })
  }

  /**
   * Candidate re-shares their screen after stoppage
   */
  async reShareScreen() {
    if (!this.room || this.room.state !== ConnectionState.Connected) {
      throw new Error('Cannot re-share screen while room is disconnected')
    }
    return await this.publishScreen()
  }

  /**
   * Disconnect and release all hardware devices
   */
  async disconnect() {
    if (this.room) {
      try {
        if (this.room.localParticipant) {
          await this.room.localParticipant.setScreenShareEnabled(false)
          await this.room.localParticipant.setCameraEnabled(false)
        }
        await this.room.disconnect()
      } catch (err) {
        // ignore teardown errors
      } finally {
        this.room = null
        this.screenTrack = null
        this.cameraTrack = null
      }
    }
  }
}

/**
 * Pre-check media network probe (UDP -> TCP -> TURN/TLS)
 */
export async function checkMediaConnectivity(wsUrl, testToken) {
  const result = {
    connected: false,
    protocol: 'unknown',
    error: null
  }

  const probeRoom = new Room({
    adaptiveStream: false,
    dynacast: false
  })

  try {
    await probeRoom.connect(wsUrl, testToken)
    result.connected = true
    result.protocol = 'webrtc-sfu'
    await probeRoom.disconnect()
  } catch (err) {
    result.connected = false
    result.error = err.message
  }

  return result
}
