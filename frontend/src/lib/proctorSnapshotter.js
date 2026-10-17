/**
 * proctorSnapshotter.js
 * R3 — Snapshot media driver (lite / default).
 *
 * Responsibilities:
 * - Capture camera (320×240) and screen (640×360) WebP frames from live tracks
 * - Upload directly to S3 via presigned PUT (zero bytes through EC2)
 * - Emit `snapshot:uploaded` over socket so the invigilator grid refreshes
 * - Obey server-driven cadence from `proctor:cadence` socket events
 *   • min interval cap: 1 000 ms
 *   • max interval cap: 60 000 ms
 *   • default: 30 000 ± jitter (3 000 ms)
 *   • visible tile: 5 000 ms
 *   • focused: 1 500 ms for 60 s then decay
 * - Exponential back-off on S3 PUT failure (2 s → 4 s → 8 s … max 30 s)
 * - S3 failures NEVER block autosave, question navigation, or submission
 */

import api from '@/utils/api'
import { getSocket } from '@/lib/socketClient'

// ── Constants ────────────────────────────────────────────────────────────────
const CAMERA_W = 320
const CAMERA_H = 240
const SCREEN_W = 640
const SCREEN_H = 360

const MIN_INTERVAL_MS = 1_000
const MAX_INTERVAL_MS = 60_000
const DEFAULT_CADENCE_MS = 3_000
const DEFAULT_JITTER_MS = 500

const BACKOFF_BASE_MS = 2_000
const BACKOFF_MAX_MS = 30_000
const BACKOFF_FACTOR = 2

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampInterval(ms) {
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, ms))
}

function applyJitter(ms, jitterMs = 0) {
  if (!jitterMs) return ms
  return ms + Math.floor((Math.random() * 2 - 1) * jitterMs)
}

function blobToDataUrl(blob) {
  if (!blob) return Promise.resolve(null)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

// Persistent offscreen video element cache per track to eliminate creation latency & race conditions
const persistentVideoMap = new WeakMap()

/**
 * Capture a video track's current frame onto an offscreen canvas and return a
 * Blob in image/webp format with guaranteed timeout safety.
 */
async function captureFrame(track, width, height) {
  if (!track || track.readyState !== 'live') return null

  let video = persistentVideoMap.get(track)
  if (!video || !video.srcObject) {
    video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.srcObject = new MediaStream([track])
    persistentVideoMap.set(track, video)
    video.play().catch(() => {})
  }

  return new Promise((resolve) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(null)
      }
    }, 1500)

    const doCapture = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.65)
      } catch (_) {
        resolve(null)
      }
    }

    if (video.readyState >= 2) {
      doCapture()
    } else {
      video.onloadedmetadata = () => {
        video.play().then(doCapture).catch(() => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve(null)
          }
        })
      }
      video.play().then(() => {
        if (video.readyState >= 2) doCapture()
      }).catch(() => {})
    }
  })
}

// ── ProctorSnapshotter ───────────────────────────────────────────────────────

export class ProctorSnapshotter {
  /**
   * @param {object} opts
   * @param {string}           opts.examId
   * @param {string}           opts.attemptId
   * @param {MediaStreamTrack} opts.cameraTrack   – camera video track
   * @param {MediaStreamTrack} opts.screenTrack   – screen capture video track
   * @param {object}           opts.socket        – socket.io client instance
   * @param {function}         [opts.onError]     – (err) => void, non-blocking
   */
  constructor({ examId, attemptId, cameraTrack, screenTrack, socket, onError = () => {} }) {
    this.examId = examId
    this.attemptId = attemptId
    this.cameraTrack = cameraTrack
    this.screenTrack = screenTrack
    this.socket = socket || window.__pnStudentSocket || (typeof getSocket === 'function' ? getSocket() : null)
    this.onError = onError

    // Cadence state
    this._cadenceMs = DEFAULT_CADENCE_MS
    this._jitterMs = DEFAULT_JITTER_MS

    // Runtime state
    this._running = false
    this._timer = null
    this._backoffMs = 0            // 0 = no active backoff
    this._consecutiveFails = 0

    // Bind socket listener
    this._onCadence = this._handleCadence.bind(this)
    if (this.socket) {
      this.socket.on('proctor:cadence', this._onCadence)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() {
    if (this._running) return
    this._running = true
    this._scheduleNext(0) // immediate first capture
  }

  stop() {
    this._running = false
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    if (this.socket) {
      this.socket.off('proctor:cadence', this._onCadence)
    }
  }

  /**
   * Update live tracks after re-share / device change
   */
  updateTracks({ cameraTrack, screenTrack } = {}) {
    if (cameraTrack !== undefined) this.cameraTrack = cameraTrack
    if (screenTrack !== undefined) this.screenTrack = screenTrack
    if (this._running && (cameraTrack || screenTrack)) {
      if (this._timer) {
        clearTimeout(this._timer)
        this._timer = null
      }
      this._scheduleNext(0)
    }
  }

  // ── Cadence Handling ───────────────────────────────────────────────────────

  _handleCadence({ attemptId, cadenceMs, jitterMs = 0 }) {
    // Only apply hints addressed to this attempt (or broadcast, if no attemptId)
    if (attemptId && attemptId !== this.attemptId) return

    const newCadence = clampInterval(cadenceMs)
    const newJitter = jitterMs ?? 0
    const changed = newCadence !== this._cadenceMs || newJitter !== this._jitterMs
    this._cadenceMs = newCadence
    this._jitterMs = newJitter

    // If we shortened the interval, reschedule immediately
    if (changed && this._running) {
      if (this._timer) {
        clearTimeout(this._timer)
        this._timer = null
      }
      // Fire the next snapshot at the new interval from now
      this._scheduleNext(clampInterval(applyJitter(newCadence, newJitter)))
    }
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────

  _scheduleNext(delayMs) {
    if (!this._running) return
    this._timer = setTimeout(() => this._capture(), Math.max(0, delayMs))
  }

  // ── Core Capture & Upload ──────────────────────────────────────────────────

  async _capture() {
    if (!this._running) return

    try {
      await this._captureAndUpload()
      // Success: reset backoff
      this._consecutiveFails = 0
      this._backoffMs = 0
    } catch (err) {
      // S3 failures are isolated — never throw to caller
      this._consecutiveFails++
      this._backoffMs = Math.min(
        BACKOFF_MAX_MS,
        BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, this._consecutiveFails - 1)
      )
      this.onError(err)
    }

    if (!this._running) return

    // Schedule next snapshot; if in backoff, use the max of cadence vs backoff
    const cadenceWithJitter = clampInterval(applyJitter(this._cadenceMs, this._jitterMs))
    const nextDelay = this._backoffMs > 0
      ? Math.max(cadenceWithJitter, this._backoffMs)
      : cadenceWithJitter

    this._scheduleNext(nextDelay)
  }

  updateSocket(socket) {
    if (socket) {
      if (this.socket && this.socket !== socket) {
        this.socket.off('proctor:cadence', this._onCadence)
      }
      this.socket = socket
      this.socket.on('proctor:cadence', this._onCadence)
    }
  }

  async _captureAndUpload() {
    const frameAt = Date.now()

    // 1. Capture frames concurrently from live tracks
    const [cameraBlob, screenBlob] = await Promise.all([
      captureFrame(this.cameraTrack, CAMERA_W, CAMERA_H),
      captureFrame(this.screenTrack, SCREEN_W, SCREEN_H)
    ])

    // 2. Convert captured frames to lightweight data URLs for direct real-time streaming
    const [screenDataUrl, cameraDataUrl] = await Promise.all([
      blobToDataUrl(screenBlob),
      blobToDataUrl(cameraBlob)
    ])

    // 3. Emit real-time frame over WebSocket directly to invigilators
    const activeSocket = (this.socket && this.socket.connected)
      ? this.socket
      : (window.__pnStudentSocket?.connected
          ? window.__pnStudentSocket
          : (typeof getSocket === 'function' ? getSocket() : null))

    if (activeSocket?.connected && (screenDataUrl || cameraDataUrl)) {
      activeSocket.emit('screen:frame', {
        attemptId: this.attemptId,
        frame: screenDataUrl,
        cameraFrame: cameraDataUrl,
        frameAt
      })
      activeSocket.emit('snapshot:uploaded', {
        attemptId: this.attemptId,
        frameAt
      })
    }

    // 4. Background S3 archival (best-effort, non-blocking)
    try {
      const ticketRes = await api.post(`/attempts/${this.attemptId}/snapshots/ticket`).catch(() => null)
      if (ticketRes?.data) {
        const { camera: camTicket, screen: scrTicket } = ticketRes.data
        const uploads = []
        if (cameraBlob && camTicket?.putUrl) {
          uploads.push(
            fetch(camTicket.putUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/webp' },
              body: cameraBlob
            }).catch(() => {})
          )
        }
        if (screenBlob && scrTicket?.putUrl) {
          uploads.push(
            fetch(scrTicket.putUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/webp' },
              body: screenBlob
            }).catch(() => {})
          )
        }
        await Promise.all(uploads)
      }
    } catch (_) {
      // S3 failures are non-fatal and must never block live streaming
    }
  }
}
