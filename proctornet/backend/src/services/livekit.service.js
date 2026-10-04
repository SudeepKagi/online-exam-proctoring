/**
 * livekit.service.js (Secure livekit-server-sdk adapter)
 * Replaces hand-rolled JWT with cryptographic livekit-server-sdk AccessToken.
 * Fixes canSubscribe always-true bug (ADR-008 / Task 7.2).
 */

const { AccessToken, TrackSource } = require('livekit-server-sdk')

function createLiveKitToken(roomName, participantIdentity, isPublisher = true) {
  const apiKey = process.env.LIVEKIT_API_KEY || 'proctornet_livekit_key'
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'proctornet_livekit_secret_at_least_32_chars'

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    ttl: '4h'
  })

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: Boolean(isPublisher),
    canPublishData: false,
    canSubscribe: !isPublisher, // Fixed: Subscribers cannot publish; publishers cannot subscribe
    hidden: !isPublisher
  })

  return token.toJwt()
}

module.exports = { createLiveKitToken }
