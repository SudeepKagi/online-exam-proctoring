const { DRIVERS, DECISIONS, LIVENESS_ACTIONS } = require('./types')
const { RekognitionDriver } = require('./rekognitionDriver')
const { OnnxDriver } = require('./onnxDriver')
const { OffDriver } = require('./offDriver')
const { TestVerifierDriver } = require('./testDriver')

let currentVerifier = null

function createFaceVerifier(driverType = null, options = {}) {
  const driver = driverType || process.env.FACE_DRIVER || process.env.FACE_VERIFIER_DRIVER || DRIVERS.REKOGNITION

  switch (driver.toLowerCase()) {
    case DRIVERS.REKOGNITION:
      return new RekognitionDriver(options)
    case DRIVERS.ONNX:
      return new OnnxDriver(options)
    case DRIVERS.OFF:
      return new OffDriver()
    case 'test':
    case DRIVERS.MOCK:
      return new TestVerifierDriver()
    default:
      return new RekognitionDriver(options)
  }
}

function getFaceVerifier(driverType = null, options = {}) {
  if (driverType) {
    return createFaceVerifier(driverType, options)
  }
  if (!currentVerifier) {
    currentVerifier = createFaceVerifier()
  }
  return currentVerifier
}

function setGlobalFaceVerifier(verifier) {
  currentVerifier = verifier
}

function resetGlobalFaceVerifier() {
  currentVerifier = null
}

module.exports = {
  DRIVERS,
  DECISIONS,
  LIVENESS_ACTIONS,
  createFaceVerifier,
  getFaceVerifier,
  setGlobalFaceVerifier,
  resetGlobalFaceVerifier,
  RekognitionDriver,
  RekognitionVerifierDriver: RekognitionDriver,
  OnnxDriver,
  OnnxVerifierDriver: OnnxDriver,
  OffDriver,
  OffVerifierDriver: OffDriver,
  TestVerifierDriver
}
