/**
 * TestVerifierDriver - Driver for unit and contract testing with programmable fixtures
 */

class TestVerifierDriver {
  constructor() {
    this.providerName = 'test-driver'
    this.modelVersion = 'test-v1'
    this._detectHandler = null
    this._compareHandler = null
  }

  setDetectHandler(fn) {
    this._detectHandler = fn
  }

  setCompareHandler(fn) {
    this._compareHandler = fn
  }

  reset() {
    this._detectHandler = null
    this._compareHandler = null
  }

  async detect(imageRef) {
    if (typeof this._detectHandler === 'function') {
      return this._detectHandler(imageRef)
    }
    // Default valid clean face
    return {
      faceCount: 1,
      boundingBox: { top: 0.1, left: 0.1, width: 0.6, height: 0.6 },
      quality: { brightness: 80, sharpness: 85 },
      pose: { yaw: 0, pitch: 0, roll: 0 },
      eyesOpen: true,
      occluded: false,
      requestId: 'test-detect-req',
      provider: this.providerName
    }
  }

  async compare(srcRef, tgtRef) {
    if (typeof this._compareHandler === 'function') {
      return this._compareHandler(srcRef, tgtRef)
    }
    if (tgtRef && (tgtRef.includes('outage') || srcRef?.includes('outage'))) {
      throw new Error('Simulated biometric provider outage')
    }
    if (tgtRef && (tgtRef.includes('impostor') || srcRef?.includes('impostor'))) {
      return {
        similarity: 42.0,
        faceConfidence: 99.0,
        requestId: 'test-compare-impostor-req',
        provider: this.providerName,
        modelVersion: this.modelVersion
      }
    }
    // Default valid matching face for test driver
    return {
      similarity: 98.0,
      faceConfidence: 99.5,
      requestId: 'test-compare-req',
      provider: this.providerName,
      modelVersion: this.modelVersion
    }
  }
}

module.exports = {
  TestVerifierDriver
}
