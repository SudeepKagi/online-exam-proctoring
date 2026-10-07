/**
 * media.js
 * R4 — Media Driver Abstraction (MEDIA_DRIVER=snapshot|livekit-selfhost|livekit-cloud)
 */

'use strict'

const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

class MediaDriver {
  constructor(driverType = null) {
    this.name = (driverType || config.mediaDriver || 'snapshot').toLowerCase().trim()
  }

  isSnapshot() {
    return this.name === 'snapshot'
  }

  isLiveKit() {
    return this.name.startsWith('livekit')
  }

  async getCadence(attemptState) {
    if (this.name === 'snapshot') {
      // Server-driven cadence: 30s base, 5s when tile visible, 1-2s when focused
      if (attemptState?.isFocused) return 2
      if (attemptState?.isTileVisible) return 5
      return 30
    }
    return 0 // Continuous WebRTC
  }
}

let activeMediaDriver = null

function getMediaDriver(driverName = null) {
  const chosen = (driverName || config.mediaDriver || 'snapshot').toLowerCase().trim()
  if (activeMediaDriver && activeMediaDriver.name === chosen) {
    return activeMediaDriver
  }
  activeMediaDriver = new MediaDriver(chosen)
  logger.info({ driver: chosen }, 'Media driver initialized')
  return activeMediaDriver
}

module.exports = {
  MediaDriver,
  getMediaDriver
}
