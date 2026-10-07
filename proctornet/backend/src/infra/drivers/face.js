/**
 * face.js
 * R4 — Face Verifier Driver Abstraction (FACE_DRIVER=rekognition|onnx|off|test)
 */

'use strict'

const config = require('../../shared/config')
const { createFaceVerifier, getFaceVerifier: baseGetVerifier } = require('../../modules/media/faceVerifier')

function getFaceDriver(driverName = null) {
  const chosen = (driverName || config.faceDriver || 'off').toLowerCase().trim()
  return baseGetVerifier(chosen)
}

module.exports = {
  getFaceDriver,
  createFaceVerifier
}
