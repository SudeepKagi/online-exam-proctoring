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

// ── Constants ────────────────────────────────────────────────────────────────
const CAMERA_W = 320
const CAMERA_H = 240
const SCREEN_W = 640
const SCREEN_H = 360

const MIN_INTERVAL_MS = 1_000
const MAX_INTERVAL_MS = 60_000
const DEFAULT_CADENCE_MS = 30_000
const DEFAULT_JITTER_MS = 3_000

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

/**
 * Capture a video track's current frame onto an offscreen canvas and return a
 * Blob in image/webp format.
 * @param {MediaStreamTrack} track  – a video track
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Blob|null>}
 */
async function captureFrame(track, width, height) {
  if (!track || track.readyState !== 'live') return null

  // Prefer ImageCapture when available (avoids video element)
  if (typeof ImageCapture !== 'undefined') {
    try {
      const ic = new ImageCapture(track)
      const bitmap = await ic.grabFrame()
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      return canvas.convertToBlob({ type: 'image/webp', quality: 0.75 })
    } catch (_) {
      // Fall through to video-element path
    }
  }

  // Fallback: create a hidden video element
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.srcObject = new MediaStream([track])
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      video.play().then(() => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, width, height)
        video.pause()
        video.srcObject = null
        canvas.toBlob(resolve, 'image/webp', 0.75)
      }).catch(() => resolve(null))
    }
    video.onerror = () => resolve(null)
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
    this.socket = socket
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
    if (socket) {
      socket.on('proctor:cadence', this._onCadence)
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

  async _captureAndUpload() {
    // 1. Get presigned PUT ticket from server (rate-limited server-side)
    const ticketRes = await api.post(`/attempts/${this.attemptId}/snapshots/ticket`)
    const { camera: camTicket, screen: scrTicket } = ticketRes.data

    const frameAt = Date.now()

    // 2. Capture frames concurrently
    const [cameraBlob, screenBlob] = await Promise.all([
      captureFrame(this.cameraTrack, CAMERA_W, CAMERA_H),
      captureFrame(this.screenTrack, SCREEN_W, SCREEN_H)
    ])

    // 3. Upload directly to S3 (PUT, zero EC2 transcoding)
    const uploads = []

    if (cameraBlob && camTicket?.putUrl) {
      uploads.push(
        fetch(camTicket.putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: cameraBlob
        }).then((r) => {
          if (!r.ok) throw new Error(`Camera S3 PUT failed: ${r.status}`)
        })
      )
    }

    if (screenBlob && scrTicket?.putUrl) {
      uploads.push(
        fetch(scrTicket.putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: screenBlob
        }).then((r) => {
          if (!r.ok) throw new Error(`Screen S3 PUT failed: ${r.status}`)
        })
      )
    }

    // Wait for both uploads; any error bubbles up to backoff handler
    await Promise.all(uploads)

    // 4. Notify server (metadata only — zero bytes of image)
    if (this.socket?.connected) {
      this.socket.emit('snapshot:uploaded', {
        attemptId: this.attemptId,
        frameAt
      })
    }
  }
}
