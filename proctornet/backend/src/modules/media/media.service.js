/**
 * media.service.js
 * Production LiveKit SFU Token & Media Service (ADR-008 / Notion 13.10)
 * Replaces hand-rolled JWT with livekit-server-sdk; enforces strict role-based grants:
 * - Students: publish only, no subscribe, bounded TTL (attempt expiry + 5m)
 * - Invigilators: subscribe only, no publish, hidden: true (students cannot see staff)
 * - Authoritative webhook receiver for track_unpublished (SCREEN_SHARE_STOPPED)
 */

const crypto = require('crypto')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { ForbiddenError, NotFoundError } = require('../../shared/errors')
const { ROLES } = require('../../shared/roles')
const { proctoringService } = require('../proctoring/service')

let _livekit = null
function getLiveKit() {
  if (!_livekit) {
    _livekit = require('livekit-server-sdk')
  }
  return _livekit
}

class MediaService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.LIVEKIT_API_KEY || 'proctornet_livekit_key'
    this.apiSecret = options.apiSecret || process.env.LIVEKIT_API_SECRET || 'proctornet_livekit_secret_at_least_32_chars'
    this.wsUrl = options.wsUrl || process.env.LIVEKIT_URL || 'ws://localhost:7880'
    this.httpUrl = options.httpUrl || process.env.LIVEKIT_HTTP_URL || this.wsUrl.replace(/^ws/, 'http')

    this._roomServiceClient = options.roomServiceClient || null
    this._webhookReceiver = options.webhookReceiver || null

    // Debounce map for SCREEN_SHARE_STOPPED webhook events (5s cooldown)
    this.screenShareCooldowns = new Map()
  }

  get roomServiceClient() {
    if (this._roomServiceClient) return this._roomServiceClient
    const { RoomServiceClient } = getLiveKit()
    this._roomServiceClient = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret)
    return this._roomServiceClient
  }

  get webhookReceiver() {
    if (this._webhookReceiver) return this._webhookReceiver
    const { WebhookReceiver } = getLiveKit()
    this._webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret)
    return this._webhookReceiver
  }

  /**
   * Lazily ensure room exists on LiveKit SFU
   */
  async ensureRoom(roomName) {
    try {
      await this.roomServiceClient.createRoom({
        name: roomName,
        emptyTimeout: 300,
        maxParticipants: 1200
      })
    } catch (err) {
      // Room already exists or LiveKit service unreachable in tests
      logger.debug({ roomName, error: err.message }, 'LiveKit ensureRoom result')
    }
  }

  /**
   * Issue LiveKit Access Token (Task 7.2)
   */
  async issueToken(user, { examId, attemptId }) {
    const { AccessToken, TrackSource } = getLiveKit()
    if (!examId) {
      throw new ForbiddenError('examId is required')
    }

    const roomName = `exam:${examId}`
    let identity
    let metadata
    let grant
    let ttlSeconds

    if (user.role === ROLES.STUDENT) {
      // 1. Student authorization check via SQL
      const attempt = await prisma.examAttempt.findFirst({
        where: {
          examId,
          studentId: user.id,
          ...(attemptId ? { id: attemptId } : {})
        },
        include: {
          student: { select: { id: true, name: true, usn: true } }
        }
      })

      if (!attempt) {
        throw new NotFoundError('No authorized exam attempt found for this student and exam')
      }

      // Strict state guard: must be ACTIVE or SUSPENDED
      if (!['ACTIVE', 'SUSPENDED'].includes(attempt.status)) {
        throw new ForbiddenError(`Cannot join media session for attempt in terminal or invalid state '${attempt.status}'`)
      }

      identity = `student:${attempt.id}`
      metadata = {
        name: user.name || attempt.student?.name,
        usn: user.usn || attempt.student?.usn,
        attemptId: attempt.id,
        examId
      }

      // TTL: remaining attempt duration + 5 minutes grace
      const now = Date.now()
      const expiresAtMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : (now + 3600 * 1000)
      const remainingSec = Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
      ttlSeconds = remainingSec + 300 // + 5 min grace

      // Sources: Screen share primary; camera low-bitrate enabled by default
      const publishSources = [TrackSource.SCREEN_SHARE]
      if (process.env.PROCTOR_CAMERA_PUBLISH !== 'false') {
        publishSources.push(TrackSource.CAMERA)
      }

      grant = {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishData: false,
        canSubscribe: false, // Strict: students cannot spy on other participants
        canPublishSources: publishSources
      }
    } else {
      // 2. Staff authorization check via SQL (Faculty must own exam; Invigilator scope; Admin explicit)
      await proctoringService.assertStaffExamAccess(user, examId)

      const randSuffix = crypto.randomBytes(4).toString('hex')
      identity = `inv:${user.id}:${randSuffix}`
      metadata = {
        name: user.name,
        role: user.role
      }
      ttlSeconds = 4 * 3600 // 4 hours

      grant = {
        roomJoin: true,
        room: roomName,
        canPublish: false,
        canPublishData: false,
        canSubscribe: true,
        hidden: true // Hidden so candidates cannot see proctors in participant list
      }
    }

    // 3. Create AccessToken
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl: `${ttlSeconds}s`,
      metadata: JSON.stringify(metadata)
    })
    token.addGrant(grant)

    const jwt = await token.toJwt()

    // 4. Ensure room asynchronously
    this.ensureRoom(roomName).catch(() => {})

    return {
      token: jwt,
      wsUrl: this.wsUrl,
      roomName,
      identity,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    }
  }

  /**
   * Remove a participant from an active room (e.g. on TERMINATED / SUBMITTED / EXPIRED)
   */
  async removeParticipant(examId, identity) {
    try {
      await this.roomServiceClient.removeParticipant(`exam:${examId}`, identity)
      logger.info({ examId, identity }, 'Removed participant from LiveKit room')
    } catch (err) {
      logger.debug({ examId, identity, error: err.message }, 'Failed to remove participant from LiveKit room')
    }
  }

  /**
   * Process incoming LiveKit webhook with cryptographic signature verification
   */
  async handleWebhook(rawBody, authHeader) {
    if (!authHeader) {
      throw new ForbiddenError('Missing authorization header for LiveKit webhook')
    }

    let event
    try {
      const bodyStr = Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf-8')
        : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {}))
      event = await this.webhookReceiver.receive(bodyStr, authHeader)
    } catch (err) {
      logger.warn({ error: err.message }, 'LiveKit webhook signature verification failed')
      throw new ForbiddenError('Invalid LiveKit webhook signature')
    }

    const { event: eventName, room, participant, track } = event || {}
    logger.info({ eventName, room: room?.name, participant: participant?.identity }, 'LiveKit webhook event received')

    if (eventName === 'track_unpublished') {
      const { TrackSource } = getLiveKit()
      const isScreenShare = track?.source === TrackSource.SCREEN_SHARE || track?.source === 3 || track?.name === 'screen'
      if (isScreenShare && participant?.identity?.startsWith('student:')) {
        const attemptId = participant.identity.replace(/^student:/, '')
        await this._handleScreenShareStopped(attemptId, room?.name)
      }
    }

    return { success: true, event: eventName }
  }

  async _handleScreenShareStopped(attemptId, roomName) {
    const cooldownKey = `screen_stopped:${attemptId}`
    const now = Date.now()
    const lastTime = this.screenShareCooldowns.get(cooldownKey) || 0
    if (now - lastTime < 5000) {
      return // 5s debounce window
    }
    this.screenShareCooldowns.set(cooldownKey, now)

    try {
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, studentId: true, status: true }
      })

      if (attempt && attempt.status === 'ACTIVE') {
        await proctoringService.recordViolation(
          attempt.id,
          attempt.studentId,
          'SCREEN_SHARE_STOPPED',
          { source: 'livekit_webhook', roomName, timestamp: new Date().toISOString() }
        )
        logger.warn({ attemptId }, 'Authoritative SCREEN_SHARE_STOPPED violation recorded from LiveKit webhook')
      }
    } catch (err) {
      logger.error({ attemptId, error: err.message }, 'Failed to record SCREEN_SHARE_STOPPED from webhook')
    }
  }
}

const mediaService = new MediaService()

module.exports = {
  MediaService,
  mediaService
}
