/**
 * FaceVerifier Types & Constants (ADR-013 / Section R1)
 */

const DRIVERS = {
  REKOGNITION: 'rekognition',
  ONNX: 'onnx',
  OFF: 'off',
  MOCK: 'mock'
}

const DECISIONS = {
  PASS: 'PASS',
  REVIEW: 'REVIEW',
  FAIL: 'FAIL',
  ERROR: 'ERROR'
}

const LIVENESS_ACTIONS = {
  TURN_LEFT: 'TURN_LEFT',
  TURN_RIGHT: 'TURN_RIGHT',
  LOOK_UP: 'LOOK_UP',
  LOOK_DOWN: 'LOOK_DOWN'
}

module.exports = {
  DRIVERS,
  DECISIONS,
  LIVENESS_ACTIONS
}
