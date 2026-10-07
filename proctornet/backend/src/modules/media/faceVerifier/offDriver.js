/**
 * OffDriver - Explicitly disabled face verifier
 * Requirement: Feature disabled visibly, NEVER auto-pass.
 */

class OffDriver {
  constructor() {
    this.providerName = 'off'
    this.modelVersion = 'none'
  }

  async detect() {
    return {
      faceCount: 0,
      boundingBox: null,
      quality: { brightness: 0, sharpness: 0 },
      pose: { yaw: 0, pitch: 0, roll: 0 },
      eyesOpen: false,
      occluded: false,
      confidence: 0,
      requestId: null,
      provider: this.providerName,
      disabled: true,
      error: 'VERIFIER_DISABLED'
    }
  }

  async compare() {
    return {
      similarity: 0.0,
      faceConfidence: 0.0,
      requestId: null,
      provider: this.providerName,
      modelVersion: this.modelVersion,
      disabled: true,
      error: 'VERIFIER_DISABLED'
    }
  }
}

module.exports = {
  OffDriver
}
