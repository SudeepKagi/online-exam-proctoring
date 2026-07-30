const jwt = require('jsonwebtoken')

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey'
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secretsecretsecretsecretsecretsecret'

/**
 * Generate a signed LiveKit Access Token for WebRTC Room Streaming
 * @param {string} roomName - Unique room ID (e.g., examId)
 * @param {string} participantIdentity - Identity string (e.g., student usn or invigilator ID)
 * @param {boolean} isPublisher - True for student publishing video/screen, false for invigilator subscriber
 */
function createLiveKitToken(roomName, participantIdentity, isPublisher = true) {
  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: participantIdentity,
    nbf: Math.floor(Date.now() / 1000) - 5,
    exp: Math.floor(Date.now() / 1000) + 4 * 3600, // 4 hours
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: isPublisher,
      canPublishData: true,
      canSubscribe: !isPublisher || true,
    },
  }

  return jwt.sign(payload, LIVEKIT_API_SECRET, { algorithm: 'HS256' })
}

module.exports = { createLiveKitToken }
