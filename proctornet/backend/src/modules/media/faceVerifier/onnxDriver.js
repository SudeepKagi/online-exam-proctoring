/**
 * OnnxDriver - Optional on-box ONNX driver for Standard Profile
 */
const { logger } = require('../../../shared/logging')

class OnnxDriver {
  constructor(options = {}) {
    this.modelPath = options.modelPath || process.env.ONNX_FACE_MODEL_PATH || null
    this.providerName = 'onnx'
    this.modelVersion = 'onnx-insightface-v1'
  }

  async detect(imageRef) {
    if (!this.modelPath) {
      const err = new Error('ONNX face detection model not configured on this host profile')
      err.code = 'VERIFIER_UNAVAILABLE'
      logger.warn({ error: err.message }, 'OnnxDriver detect unavailable')
      throw err
    }

    // Standard profile on-box detection placeholder
    return {
      faceCount: 1,
      boundingBox: { top: 0.1, left: 0.1, width: 0.8, height: 0.8 },
      quality: { brightness: 75, sharpness: 80 },
      pose: { yaw: 0, pitch: 0, roll: 0 },
      eyesOpen: true,
      occluded: false,
      requestId: 'onnx-local',
      provider: this.providerName
    }
  }

  async compare(srcRef, tgtRef) {
    if (!this.modelPath) {
      const err = new Error('ONNX face comparison model not configured on this host profile')
      err.code = 'VERIFIER_UNAVAILABLE'
      logger.warn({ error: err.message }, 'OnnxDriver compare unavailable')
      throw err
    }

    return {
      similarity: 0.0,
      faceConfidence: 0.0,
      requestId: 'onnx-local',
      provider: this.providerName,
      modelVersion: this.modelVersion
    }
  }
}

module.exports = {
  OnnxDriver
}
